import "server-only";

import type {
    LLMProviderName,
    ProviderHealth,
} from "./types";


/* ======================================================
   PROVIDER HEALTH STATE
====================================================== */

/*
 * This state lives in the current server process.
 *
 * Example:
 *
 * Gemini -> 429
 *
 * Medha remembers Gemini is temporarily unavailable.
 *
 * Subsequent requests handled by the same server process
 * skip Gemini until the cooldown expires.
 *
 * On Vercel, different server instances may have
 * independent state. That is acceptable for v2.
 *
 * Later we can persist provider health in Supabase
 * if we want global quota coordination.
 */

const providerHealth:
    Record<
        LLMProviderName,
        ProviderHealth
    > = {

    gemini: {
        available: true,
        blockedUntil: 0,
    },


    groq: {
        available: true,
        blockedUntil: 0,
    },
};


/* ======================================================
   CHECK PROVIDER
====================================================== */

export function isProviderAvailable(
    provider: LLMProviderName
): boolean {

    const state =
        providerHealth[
        provider
        ];


    /*
     * Cooldown expired.
     *
     * Make the provider eligible again.
     */

    if (
        !state.available &&
        Date.now() >=
        state.blockedUntil
    ) {

        state.available =
            true;

        state.blockedUntil =
            0;

        state.lastError =
            undefined;


        console.log(
            `[LLM HEALTH] ${provider} cooldown expired. Provider enabled again.`
        );
    }


    return state.available;
}


/* ======================================================
   MARK HEALTHY
====================================================== */

export function markProviderHealthy(
    provider: LLMProviderName
) {

    providerHealth[
        provider
    ] = {
        available: true,
        blockedUntil: 0,
    };
}


/* ======================================================
   MARK RATE LIMITED
====================================================== */

export function markProviderLimited(
    provider:
        LLMProviderName,

    retryAfterSeconds =
        300,

    error?: string
) {

    /*
     * Minimum:
     * 30 seconds
     *
     * Maximum:
     * 1 hour
     */

    const safeRetry =
        Math.max(
            30,
            Math.min(
                retryAfterSeconds,
                60 * 60
            )
        );


    providerHealth[
        provider
    ] = {

        available:
            false,

        blockedUntil:
            Date.now() +
            safeRetry * 1000,

        lastError:
            error,
    };


    console.warn(
        `[LLM HEALTH] ${provider} blocked for ${safeRetry} seconds.`
    );
}