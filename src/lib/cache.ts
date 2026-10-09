import "server-only";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const CACHE_TTL_DAYS = 30;


/* ======================================================
   NORMALIZE / CANONICALIZE QUERY
====================================================== */

export function normalizeQuery(
    query: string
): string {
    let normalized = query
        .toLowerCase()
        .trim()
        .replace(/[?!.,;:]+$/g, "")
        .replace(/\s+/g, " ");

    /*
     * Convert common equivalent definition/explanation
     * questions into the same canonical query.
     *
     * Examples:
     *
     * RAG?                -> rag
     * What is RAG?        -> rag
     * Explain RAG         -> rag
     * Define RAG          -> rag
     * Tell me about RAG   -> rag
     *
     * Python?             -> python
     * What is Python?     -> python
     * Explain Python      -> python
     */

    const prefixes = [
        /^what is\s+/,
        /^what's\s+/,
        /^what are\s+/,
        /^explain to me\s+/,
        /^explain\s+/,
        /^define\s+/,
        /^tell me about\s+/,
        /^describe\s+/,
        /^give me an explanation of\s+/,
    ];

    for (const pattern of prefixes) {
        normalized =
            normalized.replace(
                pattern,
                ""
            );
    }

    return normalized
        .trim()
        .replace(/\s+/g, " ");
}


/* ======================================================
   CREATE CACHE KEY
====================================================== */

function createCacheKey(
    query: string
): string {
    const normalized =
        normalizeQuery(query);

    return crypto
        .createHash("sha256")
        .update(normalized)
        .digest("hex");
}


/* ======================================================
   CACHE BYPASS RULES
====================================================== */

export function shouldBypassCache(
    query: string,
    messageCount = 1
): boolean {
    const normalized =
        normalizeQuery(query);


    /*
     * ----------------------------------------------------
     * FOLLOW-UP / CONTEXTUAL CONVERSATIONS
     * ----------------------------------------------------
     *
     * Global cache should only be used when the request
     * can safely stand on its own.
     *
     * Example:
     *
     * User: Explain Python
     * User: Explain that more simply
     *
     * The second request depends on previous context.
     */

    if (messageCount > 1) {
        console.log(
            "[CACHE] BYPASS: conversation context"
        );

        return true;
    }


    /*
     * ----------------------------------------------------
     * CURRENT / FRESH INFORMATION
     * ----------------------------------------------------
     *
     * Never serve these from the 30-day cache.
     */

    const freshPatterns = [
        /\btoday\b/,
        /\bcurrent\b/,
        /\blatest\b/,
        /\brecent\b/,
        /\bnow\b/,
        /\bnews\b/,
        /\bweather\b/,
        /\bprice\b/,
        /\bstock\b/,
        /\bscore\b/,
        /\blive\b/,
        /\btrending\b/,
        /\bthis week\b/,
        /\bthis month\b/,
        /\byesterday\b/,
        /\btomorrow\b/,
        /\b2026\b/,
    ];

    if (
        freshPatterns.some(
            (pattern) =>
                pattern.test(normalized)
        )
    ) {
        console.log(
            "[CACHE] BYPASS: fresh/current information"
        );

        return true;
    }


    /*
     * ----------------------------------------------------
     * PERSONAL / CONTEXTUAL QUESTIONS
     * ----------------------------------------------------
     *
     * These should never be shared through a global cache.
     */

    const contextualPatterns = [
        /\bmy\b/,
        /\bmine\b/,
        /\bme\b/,
        /\bour\b/,
        /\bprevious\b/,
        /\bearlier\b/,
        /\babove\b/,
        /\bwhat did i\b/,
        /\bwhat did we\b/,
        /\bthis conversation\b/,
    ];

    if (
        contextualPatterns.some(
            (pattern) =>
                pattern.test(normalized)
        )
    ) {
        console.log(
            "[CACHE] BYPASS: personal/contextual query"
        );

        return true;
    }


    return false;
}


/* ======================================================
   GET CACHED RESPONSE
====================================================== */

export async function getCachedResponse(
    query: string
): Promise<string | null> {
    try {
        const supabase =
            createAdminClient();

        const normalizedQuery =
            normalizeQuery(query);

        const cacheKey =
            createCacheKey(query);


        /*
         * Anything older than 30 days is considered expired.
         */

        const expiryDate =
            new Date(
                Date.now() -
                CACHE_TTL_DAYS *
                24 *
                60 *
                60 *
                1000
            ).toISOString();


        const {
            data,
            error,
        } =
            await supabase
                .from("response_cache")
                .select(
                    "response, updated_at"
                )
                .eq(
                    "cache_key",
                    cacheKey
                )
                .gte(
                    "updated_at",
                    expiryDate
                )
                .maybeSingle();


        if (error) {
            console.error(
                "[CACHE] LOOKUP ERROR:",
                error
            );

            /*
             * Cache is an optimization.
             * A cache failure must never break chat.
             */

            return null;
        }


        if (!data?.response) {
            console.log(
                "[CACHE] MISS:",
                normalizedQuery
            );

            return null;
        }


        console.log(
            "[CACHE] HIT:",
            normalizedQuery
        );

        return data.response;

    } catch (error) {
        console.error(
            "[CACHE] LOOKUP FAILED:",
            error
        );

        return null;
    }
}


/* ======================================================
   SAVE RESPONSE TO CACHE
====================================================== */

export async function saveCachedResponse(
    query: string,
    response: string
): Promise<void> {
    const cleanResponse =
        response.trim();

    if (!cleanResponse) {
        return;
    }

    try {
        const supabase =
            createAdminClient();

        const normalizedQuery =
            normalizeQuery(query);

        const cacheKey =
            createCacheKey(query);


        const {
            error,
        } =
            await supabase
                .from("response_cache")
                .upsert(
                    {
                        cache_key:
                            cacheKey,

                        normalized_query:
                            normalizedQuery,

                        response:
                            cleanResponse,

                        updated_at:
                            new Date().toISOString(),
                    },
                    {
                        onConflict:
                            "cache_key",
                    }
                );


        if (error) {
            console.error(
                "[CACHE] SAVE ERROR:",
                error
            );

            return;
        }


        console.log(
            "[CACHE] SAVED:",
            normalizedQuery
        );

    } catch (error) {
        console.error(
            "[CACHE] SAVE FAILED:",
            error
        );
    }
}