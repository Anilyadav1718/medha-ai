import "server-only";

import {
    GoogleGenAI,
} from "@google/genai";

/* ======================================================
   CONFIG
====================================================== */

export const EMBEDDING_MODEL =
    "gemini-embedding-2";

export const EMBEDDING_DIMENSION =
    384;

const EMBEDDING_BATCH_SIZE =
    16;

/* ======================================================
   CLIENT
====================================================== */

let client:
    GoogleGenAI | null = null;

function getGeminiClient():
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
   RAG FORMATTING
====================================================== */

/*
 * Gemini Embedding 2 recommends
 * asymmetric formatting for retrieval.
 *
 * Document:
 * title: {title} | text: {content}
 *
 * Question:
 * task: question answering | query: {question}
 */

function prepareDocument(
    text: string,
    title?: string
): string {
    const cleanText =
        text.trim();

    const cleanTitle =
        title?.trim() ||
        "none";

    return (
        `title: ${cleanTitle} | ` +
        `text: ${cleanText}`
    );
}

function prepareQuery(
    query: string
): string {
    return (
        "task: question answering | " +
        `query: ${query.trim()}`
    );
}

/* ======================================================
   VALIDATION
====================================================== */

function validateEmbedding(
    values:
        number[] | undefined
): number[] {
    if (
        !values ||
        values.length === 0
    ) {
        throw new Error(
            "Gemini returned an empty embedding."
        );
    }

    if (
        values.length !==
        EMBEDDING_DIMENSION
    ) {
        throw new Error(
            `Invalid embedding dimension. ` +
            `Expected ${EMBEDDING_DIMENSION}, ` +
            `received ${values.length}.`
        );
    }

    return values.map(
        value =>
            Number(value)
    );
}

/* ======================================================
   SINGLE DOCUMENT EMBEDDING
====================================================== */

export async function createDocumentEmbedding(
    text: string,
    title?: string
): Promise<number[]> {
    if (!text?.trim()) {
        throw new Error(
            "Cannot embed empty document text."
        );
    }

    const ai =
        getGeminiClient();

    const response =
        await ai.models.embedContent({
            model:
                EMBEDDING_MODEL,

            contents:
                prepareDocument(
                    text,
                    title
                ),

            config: {
                outputDimensionality:
                    EMBEDDING_DIMENSION,
            },
        });

    const values =
        response.embeddings?.[0]
            ?.values;

    return validateEmbedding(
        values
    );
}

/* ======================================================
   MULTIPLE DOCUMENT EMBEDDINGS
====================================================== */

export async function createDocumentEmbeddings(
    texts: string[],
    title?: string
): Promise<number[][]> {
    const cleanTexts =
        texts
            .map(text =>
                text.trim()
            )
            .filter(Boolean);

    if (
        cleanTexts.length === 0
    ) {
        return [];
    }

    const ai =
        getGeminiClient();

    const allEmbeddings:
        number[][] = [];

    console.log(
        "[RAG EMBEDDINGS] Model:",
        EMBEDDING_MODEL
    );

    console.log(
        "[RAG EMBEDDINGS] Dimension:",
        EMBEDDING_DIMENSION
    );

    console.log(
        "[RAG EMBEDDINGS] Documents:",
        cleanTexts.length
    );

    for (
        let start = 0;
        start <
        cleanTexts.length;
        start +=
        EMBEDDING_BATCH_SIZE
    ) {
        const batch =
            cleanTexts.slice(
                start,
                start +
                EMBEDDING_BATCH_SIZE
            );

        console.log(
            `[RAG EMBEDDINGS] Batch ${Math.floor(
                start /
                EMBEDDING_BATCH_SIZE
            ) + 1
            }`
        );

        /*
         * Each chunk is wrapped in
         * its own Content object.
         *
         * This tells Gemini to return
         * one embedding per chunk.
         */
        const response =
            await ai.models.embedContent({
                model:
                    EMBEDDING_MODEL,

                contents:
                    batch.map(
                        text => ({
                            role: "user",

                            parts: [
                                {
                                    text:
                                        prepareDocument(
                                            text,
                                            title
                                        ),
                                },
                            ],
                        })
                    ),

                config: {
                    outputDimensionality:
                        EMBEDDING_DIMENSION,
                },
            });

        const embeddings =
            response.embeddings ||
            [];

        if (
            embeddings.length !==
            batch.length
        ) {
            throw new Error(
                `Gemini embedding count mismatch. ` +
                `Expected ${batch.length}, ` +
                `received ${embeddings.length}.`
            );
        }

        for (
            const embedding
            of embeddings
        ) {
            allEmbeddings.push(
                validateEmbedding(
                    embedding.values
                )
            );
        }
    }

    console.log(
        "[RAG EMBEDDINGS] Completed:",
        allEmbeddings.length
    );

    return allEmbeddings;
}

/* ======================================================
   QUERY EMBEDDING
====================================================== */

export async function createQueryEmbedding(
    query: string
): Promise<number[]> {
    if (!query?.trim()) {
        throw new Error(
            "Cannot embed an empty query."
        );
    }

    const ai =
        getGeminiClient();

    console.log(
        "[RAG EMBEDDINGS] Creating query embedding..."
    );

    const response =
        await ai.models.embedContent({
            model:
                EMBEDDING_MODEL,

            contents:
                prepareQuery(
                    query
                ),

            config: {
                outputDimensionality:
                    EMBEDDING_DIMENSION,
            },
        });

    const values =
        response.embeddings?.[0]
            ?.values;

    return validateEmbedding(
        values
    );
}