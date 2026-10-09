import "server-only";

import {
    GoogleGenAI,
} from "@google/genai";

import type {
    Message,
} from "@/types/chat";


/* ======================================================
   GEMINI CLIENT
====================================================== */

let client:
    GoogleGenAI | null =
    null;


/* ======================================================
   GEMINI MODEL
====================================================== */

export const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";


/* ======================================================
   GET GEMINI CLIENT
====================================================== */

function getGemini():
    GoogleGenAI {
    const apiKey =
        process.env.GEMINI_API_KEY;


    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is missing."
        );
    }


    if (!client) {
        client =
            new GoogleGenAI({
                apiKey,
            });
    }


    return client;
}


/* ======================================================
   BUILD GEMINI CONTENTS
====================================================== */

function buildContents(
    messages: Message[]
) {
    return messages
        .slice(-14)
        .map(
            (message) => ({
                role:
                    message.role ===
                        "assistant"
                        ? "model"
                        : "user",

                parts: [
                    {
                        text:
                            message.content,
                    },
                ],
            })
        );
}


/* ======================================================
   SMALL DELAY HELPER
====================================================== */

function sleep(
    ms: number
): Promise<void> {
    return new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                ms
            )
    );
}


/* ======================================================
   PROGRESSIVE TEXT OUTPUT
====================================================== */

/*
 * Gemini generates the complete response first.
 *
 * After successful generation, Medha sends the text
 * progressively to the frontend.
 *
 * This gives us a smooth streaming-style UI without
 * using generateContentStream(), which previously
 * produced:
 *
 * "Incomplete JSON segment at the end"
 *
 * IMPORTANT:
 *
 * This is progressive delivery, not native Gemini
 * token streaming.
 */

async function* createTextChunks(
    text: string
): AsyncGenerator<string> {

    /*
     * Split into words while preserving the whitespace
     * following each word.
     *
     * This also preserves Markdown formatting and
     * newline characters contained in the response.
     */

    const pieces =
        text.match(
            /\S+\s*/g
        ) || [text];


    /*
     * Number of words sent to the browser at once.
     *
     * 4 gives a smooth ChatGPT-like progressive effect
     * without making the UI unnecessarily slow.
     */

    const wordsPerChunk =
        4;


    /*
     * Delay between chunks in milliseconds.
     *
     * Keep this small because Gemini has already finished
     * generating the complete answer.
     */

    const delayMs =
        20;


    for (
        let index = 0;
        index < pieces.length;
        index += wordsPerChunk
    ) {
        const chunk =
            pieces
                .slice(
                    index,
                    index +
                    wordsPerChunk
                )
                .join("");


        if (!chunk) {
            continue;
        }


        yield chunk;


        /*
         * Give the browser time to render each chunk,
         * producing smooth progressive output.
         */

        await sleep(
            delayMs
        );
    }
}


/* ======================================================
   CREATE GEMINI RESPONSE
====================================================== */

export async function createGeminiStream(
    messages: Message[],
    systemPrompt: string
): Promise<AsyncIterable<string>> {

    const ai =
        getGemini();


    const contents =
        buildContents(
            messages
        );


    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "MEDHA GEMINI STARTED"
    );

    console.log(
        "===================================="
    );

    console.log(
        "Model:",
        GEMINI_MODEL
    );


    /* ====================================================
       GENERATE COMPLETE RESPONSE
    ==================================================== */

    /*
     * We intentionally use generateContent()
     * instead of generateContentStream().
     *
     * generateContentStream() previously caused:
     *
     * Error: Incomplete JSON segment at the end
     *
     * after Gemini had already streamed part of an answer.
     *
     * Using generateContent() ensures Gemini finishes
     * successfully BEFORE anything is sent to the user.
     *
     * This also makes Gemini -> Groq fallback safe when
     * Gemini fails before producing output.
     */

    const response =
        await ai.models.generateContent({
            model:
                GEMINI_MODEL,

            contents,

            config: {
                systemInstruction:
                    systemPrompt,

                maxOutputTokens:
                    3000,

                temperature:
                    0.3,
            },
        });


    console.log(
        "Gemini generation completed."
    );


    /* ====================================================
       EXTRACT RESPONSE TEXT
    ==================================================== */

    const text =
        response.text ||
        "";


    if (
        !text.trim()
    ) {
        throw new Error(
            "Gemini returned an empty response."
        );
    }


    console.log(
        "Gemini characters:",
        text.length
    );


    /* ====================================================
       RETURN PROVIDER-NEUTRAL STREAM
    ==================================================== */

    /*
     * router.ts expects:
     *
     * AsyncIterable<string>
     *
     * Therefore Gemini returns the same interface as Groq.
     *
     * router.ts and route.ts do not need to know whether
     * the provider used native streaming or progressive
     * delivery.
     */

    return createTextChunks(
        text
    );
}