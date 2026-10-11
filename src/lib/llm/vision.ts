import "server-only";

import {
    GoogleGenAI,
    MediaResolution,
    ThinkingLevel,
} from "@google/genai";

import type {
    Message,
} from "@/types/chat";

import type {
    VisionImage,
} from "@/types/vision";

/* =========================================================
   MODEL
========================================================= */

export const VISION_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

/* =========================================================
   CLIENT
========================================================= */

let client:
    GoogleGenAI | null =
    null;

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

/* =========================================================
   VISION SYSTEM PROMPT
========================================================= */

const MEDHA_VISION_PROMPT = `
You are Medha AI.

Medha AI was founded and developed by Anil Panchitha.

You have multimodal vision capabilities.

The user has provided an image together with a question.

Analyze the image carefully and answer the user's actual request.

You can understand:

- screenshots
- software errors
- user interfaces
- architecture diagrams
- flowcharts
- charts and graphs
- code screenshots
- documents shown as images
- photographs
- technical diagrams
- visible text inside images

IMPORTANT RULES:

1. Use both the image and the user's question.
2. Read visible text only when relevant to the request.
3. Understand spatial relationships such as arrows, boxes, labels, grouping and layout.
4. Never claim to see information that is not visible.
5. If important text or visual details are unclear, explicitly say that they are unclear.
6. For error screenshots, identify the likely cause and provide practical fixes.
7. For architecture diagrams, explain components, relationships and data flow.
8. For charts and graphs, explain the important trends and observations.
9. For UI screenshots, provide practical UI/UX feedback when requested.
10. For code screenshots, explain the visible code and identify visible problems when requested.
11. For ordinary photographs or images, describe only what is useful for answering the user's question.
12. Use clean Markdown.
13. Never output raw HTML.
14. Do not mention OCR unless the user specifically asks about OCR.
15. Avoid unnecessary introductory text.
16. Keep simple image questions concise.
17. Give detailed explanations only when the task requires them.

Answer accurately, clearly and practically.
`;

/* =========================================================
   IMAGE DETAIL DETECTION

   Some images need more visual detail than others.

   LOW:
   - normal photographs
   - icons
   - logos
   - simple objects

   MEDIUM:
   - screenshots
   - code
   - diagrams
   - charts
   - errors
   - documents
   - UI
   - text-heavy images

   This helps reduce latency for simple images while
   preserving enough detail for technical screenshots.
========================================================= */

function getMediaResolution(
    question: string,
    imageName: string
): MediaResolution {

    const input =
        `${question} ${imageName}`
            .toLowerCase();

    const detailedImagePatterns = [
        "screenshot",
        "screen shot",
        "error",
        "code",
        "terminal",
        "console",
        "diagram",
        "architecture",
        "flowchart",
        "flow chart",
        "chart",
        "graph",
        "dashboard",
        "ui",
        "ux",
        "interface",
        "document",
        "resume",
        "text",
        "read",
        "explain this",
        "debug",
        "bug",
        "stack trace",
        "exception",
        "log",
        "table",
    ];

    const needsMoreDetail =
        detailedImagePatterns.some(
            (pattern) =>
                input.includes(
                    pattern
                )
        );

    if (needsMoreDetail) {
        return (
            MediaResolution
                .MEDIA_RESOLUTION_MEDIUM
        );
    }

    return (
        MediaResolution
            .MEDIA_RESOLUTION_LOW
    );
}

/* =========================================================
   SMALL PROGRESSIVE CHUNKS

   Gemini completes the response first.

   We then progressively deliver the completed response
   through the existing Medha streaming UI.

   This keeps the stable behavior we already have while
   avoiding the previous native Gemini streaming issue.
========================================================= */

function sleep(
    milliseconds: number
): Promise<void> {

    return new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}

async function* createTextChunks(
    text: string
): AsyncGenerator<string> {

    const pieces =
        text.match(
            /\S+\s*/g
        ) || [text];

    /*
     * Slightly larger chunks than before.
     *
     * This makes the answer appear faster
     * after Gemini completes.
     */

    const wordsPerChunk =
        6;

    const delayMs =
        10;

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

        await sleep(
            delayMs
        );
    }
}

/* =========================================================
   CONVERSATION HISTORY
========================================================= */

function buildPreviousContents(
    messages: Message[]
) {

    /*
     * The final message is the current
     * image request.
     *
     * We keep a small amount of previous
     * conversation context.
     *
     * Keeping this limited reduces request
     * size and latency.
     */

    const previousMessages =
        messages
            .slice(
                -8,
                -1
            );

    return previousMessages
        .filter(
            (message) =>
                Boolean(
                    message
                        .content
                        ?.trim()
                )
        )
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

/* =========================================================
   CREATE VISION STREAM
========================================================= */

export async function createGeminiVisionStream(
    messages: Message[],
    image: VisionImage
): Promise<
    AsyncIterable<string>
> {

    const ai =
        getGemini();

    /* =====================================================
       FIND CURRENT USER QUESTION
    ===================================================== */

    const latestUser =
        [...messages]
            .reverse()
            .find(
                (message) =>
                    message.role ===
                    "user"
            );

    const question =
        latestUser
            ?.content
            ?.trim() ||
        "Describe and analyze this image.";

    /* =====================================================
       PREVIOUS CHAT CONTEXT
    ===================================================== */

    const previousContents =
        buildPreviousContents(
            messages
        );

    /* =====================================================
       SELECT IMAGE RESOLUTION
    ===================================================== */

    const mediaResolution =
        getMediaResolution(
            question,
            image.name
        );

    /* =====================================================
       MULTIMODAL CONTENT

       Previous conversation
               +
       Current image
               +
       Current question
    ===================================================== */

    const contents = [
        ...previousContents,

        {
            role: "user",

            parts: [
                {
                    inlineData: {
                        mimeType:
                            image.mimeType,

                        data:
                            image.data,
                    },
                },

                {
                    text:
                        question,
                },
            ],
        },
    ];

    /* =====================================================
       LOGGING
    ===================================================== */

    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "MEDHA VISION STARTED"
    );

    console.log(
        "===================================="
    );

    console.log(
        "Vision model:",
        VISION_MODEL
    );

    console.log(
        "Image:",
        image.name
    );

    console.log(
        "MIME:",
        image.mimeType
    );

    console.log(
        "Question:",
        question
    );

    console.log(
        "Media resolution:",
        mediaResolution
    );

    console.log(
        "Thinking level:",
        ThinkingLevel.MINIMAL
    );

    console.log(
        "Previous messages:",
        previousContents.length
    );

    /* =====================================================
       START TIMER
    ===================================================== */

    const startTime =
        Date.now();

    /* =====================================================
       GEMINI MULTIMODAL REQUEST
    ===================================================== */

    try {

        const response =
            await ai.models.generateContent(
                {
                    model:
                        VISION_MODEL,

                    contents,

                    config: {

                        /* =================================
                           MEDHA VISION INSTRUCTIONS
                        ================================= */

                        systemInstruction:
                            MEDHA_VISION_PROMPT,

                        /* =================================
                           RESPONSE LENGTH

                           1200 is enough for normal vision
                           analysis while avoiding very long
                           unnecessary generations.
                        ================================= */

                        maxOutputTokens:
                            1200,

                        /* =================================
                           THINKING

                           Flash-Lite supports MINIMAL.

                           This is important for reducing
                           first-response latency.
                        ================================= */

                        thinkingConfig: {
                            thinkingLevel:
                                ThinkingLevel
                                    .MINIMAL,
                        },

                        /* =================================
                           IMAGE RESOLUTION

                           LOW for normal images.

                           MEDIUM for screenshots, code,
                           charts and technical diagrams.
                        ================================= */

                        mediaResolution,
                    },
                }
            );

        /* =================================================
           LATENCY
        ================================================= */

        const generationTime =
            Date.now() -
            startTime;

        /* =================================================
           RESPONSE TEXT
        ================================================= */

        const text =
            response.text || "";

        if (!text.trim()) {

            throw new Error(
                "Gemini Vision returned an empty response."
            );
        }

        /* =================================================
           SUCCESS LOGS
        ================================================= */

        console.log(
            "Vision characters:",
            text.length
        );

        console.log(
            "Gemini vision latency:",
            `${generationTime}ms`
        );

        console.log(
            "Gemini vision latency:",
            `${(
                generationTime /
                1000
            ).toFixed(
                2
            )}s`
        );

        console.log(
            "MEDHA VISION COMPLETED"
        );

        console.log(
            "===================================="
        );

        /* =================================================
           RETURN PROGRESSIVE RESPONSE
        ================================================= */

        return createTextChunks(
            text
        );

    } catch (error) {

        /* =================================================
           ERROR LATENCY
        ================================================= */

        const failureTime =
            Date.now() -
            startTime;

        console.error(
            "MEDHA VISION FAILED"
        );

        console.error(
            "Vision failure after:",
            `${(
                failureTime /
                1000
            ).toFixed(
                2
            )}s`
        );

        console.error(
            "Vision error:",
            error
        );

        console.log(
            "===================================="
        );

        throw error;
    }
}