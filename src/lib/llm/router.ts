import "server-only";

import type {
    Message,
} from "@/types/chat";

import type {
    LLMProviderName,
    LLMResult,
} from "./types";

import {
    createGeminiStream,
} from "./gemini";

import {
    createGroqProviderStream,
} from "./groq-provider";

import {
    isProviderAvailable,
    markProviderHealthy,
    markProviderLimited,
} from "./provider-health";

import {
    getLLMErrorText,
    getRetryAfterSeconds,
    isRateLimitError,
} from "./errors";


/* ======================================================
   PROVIDER PRIORITY
====================================================== */

const PROVIDER_PRIORITY: LLMProviderName[] = [
    "gemini",
    "groq",
];


/* ======================================================
   CALL PROVIDER
====================================================== */

async function callProvider(
    provider: LLMProviderName,
    messages: Message[],
    systemPrompt: string
): Promise<AsyncIterable<string>> {
    if (provider === "gemini") {
        return createGeminiStream(
            messages,
            systemPrompt
        );
    }

    return createGroqProviderStream(
        messages,
        systemPrompt
    );
}


/* ======================================================
   FALLBACK STREAM
====================================================== */

async function* createFallbackStream(
    messages: Message[],
    systemPrompt: string
): AsyncGenerator<string> {
    /*
     * Once text has been sent to the browser,
     * we must NOT switch providers.
     *
     * Otherwise:
     *
     * Gemini partial response
     * +
     * Groq full response
     *
     * would be mixed together.
     */

    let generatedAnyText = false;


    /* ====================================================
       TRY PROVIDERS
    ==================================================== */

    for (const provider of PROVIDER_PRIORITY) {
        /* ==================================================
           SKIP KNOWN RATE-LIMITED PROVIDER
        ================================================== */

        if (!isProviderAvailable(provider)) {
            console.log(
                `[LLM ROUTER] ${provider} currently unavailable. Skipping.`
            );

            continue;
        }


        console.log(
            `[LLM ROUTER] Trying ${provider}...`
        );


        try {
            /* ================================================
               CREATE PROVIDER STREAM
            ================================================ */

            const providerStream =
                await callProvider(
                    provider,
                    messages,
                    systemPrompt
                );


            let providerProducedText = false;


            /* ================================================
               CONSUME STREAM
            ================================================ */

            for await (const text of providerStream) {
                if (!text) {
                    continue;
                }


                /* ==============================================
                   FIRST SUCCESSFUL TOKEN
                ============================================== */

                if (!providerProducedText) {
                    providerProducedText = true;

                    console.log(
                        `[LLM ROUTER] ${provider} selected.`
                    );

                    markProviderHealthy(
                        provider
                    );
                }


                generatedAnyText = true;

                yield text;
            }


            /* ================================================
               SUCCESSFUL COMPLETION
            ================================================ */

            if (providerProducedText) {
                console.log(
                    `[LLM ROUTER] ${provider} completed successfully.`
                );

                return;
            }


            /* ================================================
               EMPTY RESPONSE
            ================================================ */

            console.warn(
                `[LLM ROUTER] ${provider} returned no text. Trying next provider.`
            );
        } catch (error) {
            const errorText =
                getLLMErrorText(
                    error
                );


            console.error(
                `[LLM ROUTER] ${provider} failed:`,
                error
            );


            /* ================================================
               FAILURE AFTER OUTPUT STARTED
            ================================================ */

            if (generatedAnyText) {
                console.error(
                    `[LLM ROUTER] ${provider} failed after output started.`
                );

                console.error(
                    "[LLM ROUTER] Fallback cancelled to prevent mixed responses."
                );

                throw error;
            }


            /* ================================================
               RATE LIMIT
            ================================================ */

            if (isRateLimitError(error)) {
                const retryAfter =
                    getRetryAfterSeconds(
                        error
                    );


                markProviderLimited(
                    provider,
                    retryAfter,
                    errorText
                );


                console.warn(
                    `[LLM ROUTER] ${provider} rate limited.`
                );

                console.log(
                    "[LLM ROUTER] Trying next available provider..."
                );

                continue;
            }


            /* ================================================
               OTHER PROVIDER FAILURE
            ================================================ */

            console.warn(
                `[LLM ROUTER] ${provider} failed before output.`
            );

            console.log(
                "[LLM ROUTER] Trying next available provider..."
            );
        }
    }


    /* ====================================================
       ALL PROVIDERS FAILED
    ==================================================== */

    console.error(
        "[LLM ROUTER] All LLM providers unavailable."
    );


    throw new Error(
        "ALL_LLM_PROVIDERS_UNAVAILABLE"
    );
}


/* ======================================================
   PUBLIC ROUTER
====================================================== */

export async function createLLMStream(
    messages: Message[],
    systemPrompt: string
): Promise<LLMResult> {
    console.log("");

    console.log(
        "===================================="
    );

    console.log(
        "MEDHA LLM ROUTER"
    );

    console.log(
        "===================================="
    );


    return {
        stream: createFallbackStream(
            messages,
            systemPrompt
        ),
    };
}