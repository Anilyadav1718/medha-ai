import "server-only";

import type {
    Message,
} from "@/types/chat";

/* =========================================================
   MODELS
========================================================= */

export const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

export const GEMINI_VISION_MODEL =
    process.env.GEMINI_VISION_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3.5-flash-lite";

/* =========================================================
   IMAGE TYPE
========================================================= */

export type GeminiImageInput = {
    mimeType: string;
    data: string;
};

/* =========================================================
   INTERNAL TYPES
========================================================= */

type GeminiPart =
    | {
        text: string;
    }
    | {
        inlineData: {
            mimeType: string;
            data: string;
        };
    };

type GeminiContent = {
    role: "user" | "model";
    parts: GeminiPart[];
};

/* =========================================================
   API KEY
========================================================= */

function getApiKey(): string {
    const apiKey =
        process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is missing."
        );
    }

    return apiKey;
}

/* =========================================================
   CLEAN BASE64
========================================================= */

function cleanBase64(
    data: string
): string {
    const trimmed =
        data.trim();

    /*
     * Accept both:
     *
     * raw base64
     *
     * AND:
     *
     * data:image/png;base64,AAAA...
     */

    const marker =
        ";base64,";

    const markerIndex =
        trimmed.indexOf(
            marker
        );

    if (markerIndex !== -1) {
        return trimmed.slice(
            markerIndex +
            marker.length
        );
    }

    return trimmed;
}

/* =========================================================
   BUILD GEMINI CONTENTS
========================================================= */

function buildContents(
    messages: Message[],
    image?: GeminiImageInput
): GeminiContent[] {
    /*
     * Keep enough conversational context
     * without sending unlimited history.
     */

    const recentMessages =
        messages
            .filter(
                (message) =>
                    message.content?.trim()
            )
            .slice(-14);

    const contents: GeminiContent[] =
        recentMessages.map(
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

    if (!image) {
        return contents;
    }

    /*
     * Add image to the most recent
     * USER turn.
     */

    for (
        let index =
            contents.length - 1;
        index >= 0;
        index -= 1
    ) {
        if (
            contents[index].role ===
            "user"
        ) {
            contents[index] = {
                ...contents[index],

                parts: [
                    {
                        inlineData: {
                            mimeType:
                                image.mimeType,

                            data:
                                cleanBase64(
                                    image.data
                                ),
                        },
                    },

                    ...contents[index]
                        .parts,
                ],
            };

            return contents;
        }
    }

    /*
     * Safety fallback.
     */

    contents.push({
        role: "user",

        parts: [
            {
                inlineData: {
                    mimeType:
                        image.mimeType,

                    data:
                        cleanBase64(
                            image.data
                        ),
                },
            },

            {
                text:
                    "Describe and analyze this image.",
            },
        ],
    });

    return contents;
}

/* =========================================================
   EXTRACT TEXT FROM GEMINI RESPONSE
========================================================= */

function extractText(
    payload: unknown
): string {
    if (
        typeof payload !==
        "object" ||
        payload === null
    ) {
        return "";
    }

    const response =
        payload as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{
                        text?: string;
                        thought?: boolean;
                    }>;
                };
            }>;
        };

    const parts =
        response
            .candidates?.[0]
            ?.content
            ?.parts || [];

    return parts
        .filter(
            (part) =>
                !part.thought &&
                typeof part.text ===
                "string"
        )
        .map(
            (part) =>
                part.text || ""
        )
        .join("");
}

/* =========================================================
   SSE PARSER
========================================================= */

async function* readGeminiSSE(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
    const reader =
        body.getReader();

    const decoder =
        new TextDecoder();

    let buffer = "";

    try {
        while (true) {
            const {
                done,
                value,
            } =
                await reader.read();

            if (done) {
                buffer +=
                    decoder.decode();

                break;
            }

            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true,
                    }
                );

            /*
             * SSE events are separated
             * by a blank line.
             */

            let eventEnd =
                buffer.indexOf(
                    "\n\n"
                );

            while (
                eventEnd !== -1
            ) {
                const eventBlock =
                    buffer.slice(
                        0,
                        eventEnd
                    );

                buffer =
                    buffer.slice(
                        eventEnd + 2
                    );

                const lines =
                    eventBlock.split(
                        /\r?\n/
                    );

                const dataLines =
                    lines
                        .filter(
                            (line) =>
                                line.startsWith(
                                    "data:"
                                )
                        )
                        .map(
                            (line) =>
                                line
                                    .slice(5)
                                    .trimStart()
                        );

                if (
                    dataLines.length >
                    0
                ) {
                    const data =
                        dataLines.join(
                            "\n"
                        );

                    if (
                        data &&
                        data !== "[DONE]"
                    ) {
                        try {
                            const payload =
                                JSON.parse(
                                    data
                                );

                            const text =
                                extractText(
                                    payload
                                );

                            if (text) {
                                /*
                                 * THIS IS REAL
                                 * GEMINI STREAMING.
                                 */
                                yield text;
                            }
                        } catch (
                        parseError
                        ) {
                            /*
                             * Do not kill the whole
                             * stream because of one
                             * malformed SSE event.
                             */

                            console.error(
                                "[GEMINI SSE] Parse error:",
                                parseError
                            );
                        }
                    }
                }

                eventEnd =
                    buffer.indexOf(
                        "\n\n"
                    );
            }
        }

        /*
         * Process final event if
         * server closed without an
         * additional blank line.
         */

        if (
            buffer.trim()
        ) {
            const lines =
                buffer.split(
                    /\r?\n/
                );

            const data =
                lines
                    .filter(
                        (line) =>
                            line.startsWith(
                                "data:"
                            )
                    )
                    .map(
                        (line) =>
                            line
                                .slice(5)
                                .trimStart()
                    )
                    .join("\n");

            if (
                data &&
                data !== "[DONE]"
            ) {
                try {
                    const payload =
                        JSON.parse(
                            data
                        );

                    const text =
                        extractText(
                            payload
                        );

                    if (text) {
                        yield text;
                    }
                } catch {
                    // Ignore incomplete trailing SSE.
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/* =========================================================
   START GEMINI SSE REQUEST
========================================================= */

async function createGeminiSSEStream(
    messages: Message[],
    systemPrompt: string,
    model: string,
    image?: GeminiImageInput
): Promise<
    AsyncIterable<string>
> {
    const apiKey =
        getApiKey();

    const contents =
        buildContents(
            messages,
            image
        );

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(
            model
        )}:streamGenerateContent?alt=sse`;

    console.log("");
    console.log(
        "===================================="
    );
    console.log(
        image
            ? "MEDHA GEMINI VISION STREAM STARTED"
            : "MEDHA GEMINI STREAM STARTED"
    );
    console.log(
        "===================================="
    );
    console.log(
        "Model:",
        model
    );

    /*
     * IMPORTANT:
     *
     * fetch happens HERE,
     * before returning the generator.
     *
     * Therefore HTTP errors such as
     * 429 can still be handled by
     * the provider router before
     * any answer text is emitted.
     */

    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "x-goog-api-key":
                        apiKey,
                },

                body:
                    JSON.stringify({
                        contents,

                        systemInstruction: {
                            parts: [
                                {
                                    text:
                                        systemPrompt,
                                },
                            ],
                        },

                        generationConfig: {
                            maxOutputTokens:
                                3000,

                            /*
                             * 3.5 Flash-Lite
                             * already defaults to
                             * minimal thinking.
                             *
                             * Explicitly keeping it
                             * minimal helps Vision
                             * stay responsive.
                             */
                            thinkingConfig: {
                                thinkingLevel:
                                    "MINIMAL",
                            },
                        },

                        store: false,
                    }),

                cache: "no-store",
            }
        );

    if (!response.ok) {
        const errorText =
            await response.text();

        throw new Error(
            `Gemini request failed (${response.status}): ${errorText}`
        );
    }

    if (!response.body) {
        throw new Error(
            "Gemini returned no response stream."
        );
    }

    return readGeminiSSE(
        response.body
    );
}

/* =========================================================
   NORMAL GEMINI
========================================================= */

export async function createGeminiStream(
    messages: Message[],
    systemPrompt: string
): Promise<
    AsyncIterable<string>
> {
    return createGeminiSSEStream(
        messages,
        systemPrompt,
        GEMINI_MODEL
    );
}

/* =========================================================
   GEMINI VISION
========================================================= */

export async function createGeminiVisionStream(
    messages: Message[],
    systemPrompt: string,
    image: GeminiImageInput
): Promise<
    AsyncIterable<string>
> {
    return createGeminiSSEStream(
        messages,
        systemPrompt,
        GEMINI_VISION_MODEL,
        image
    );
}