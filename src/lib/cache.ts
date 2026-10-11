import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/* =========================================================
   NORMALIZE CACHE KEY
========================================================= */

export function normalizeCacheQuery(query: string): string {
    return query
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[“”"'`]/g, "")
        .replace(/[?!.,;:()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/* =========================================================
   CACHE BYPASS RULES
========================================================= */

/**
 * Cache only stable, standalone questions.
 *
 * IMPORTANT:
 * We do NOT bypass cache just because the conversation already
 * contains messages. That was preventing repeated stable prompts
 * from hitting cache inside an existing conversation.
 *
 * messageCount is used only when the current query clearly depends
 * on earlier conversation context.
 */
export function shouldBypassCache(
    query: string,
    messageCount = 1
): boolean {
    const raw = query.trim();
    const normalized = normalizeCacheQuery(raw);

    if (!normalized) {
        return true;
    }

    /* ---------------------------------------------------------
       CURRENT / LIVE / TIME-SENSITIVE INFORMATION
    --------------------------------------------------------- */

    const timeSensitivePatterns: RegExp[] = [
        /\blatest\b/i,
        /\brecent\b/i,
        /\bcurrently\b/i,
        /\bcurrent\b/i,
        /\btoday\b/i,
        /\btonight\b/i,
        /\btomorrow\b/i,
        /\byesterday\b/i,
        /\bthis week\b/i,
        /\bthis month\b/i,
        /\bthis year\b/i,
        /\bright now\b/i,
        /\bjust happened\b/i,
        /\bbreaking\b/i,
        /\blive\b/i,
        /\bnews\b/i,
        /\bweather\b/i,
        /\bscore\b/i,
        /\bprice\b/i,
        /\bstock price\b/i,
        /\bexchange rate\b/i,
        /\bwho won\b/i,
        /\bwho is winning\b/i,
    ];

    if (timeSensitivePatterns.some((pattern) => pattern.test(raw))) {
        console.log("[CACHE] BYPASS: time-sensitive query:", normalized);
        return true;
    }

    /* ---------------------------------------------------------
       CONTEXT-DEPENDENT FOLLOW-UPS
    --------------------------------------------------------- */

    if (messageCount > 1) {
        const contextualPatterns: RegExp[] = [
            /^(why|how|when|where|which one|what about it|what about that|what about this)\??$/i,
            /^(continue|go on|more|explain more|tell me more|elaborate)\.?$/i,
            /\b(previous answer|last answer|your answer|you said|you mentioned)\b/i,
            /\b(as above|from above|the above|earlier response|previous response)\b/i,
            /\b(this one|that one|same one|same thing)\b/i,
            /\b(explain|describe|summarize|fix|change|rewrite)\s+(it|that|this|them)\b/i,
            /\b(why|how|when|where)\s+(is|are|does|do|did|was|were)\s+(it|that|this|they|he|she)\b/i,
            /\bwhat about\s+(it|that|this|them|those|these)\b/i,
        ];

        if (contextualPatterns.some((pattern) => pattern.test(raw))) {
            console.log("[CACHE] BYPASS: contextual follow-up:", normalized);
            return true;
        }
    }

    return false;
}

/* =========================================================
   GET CACHED RESPONSE
========================================================= */

export async function getCachedResponse(
    query: string
): Promise<string | null> {
    const normalizedQuery = normalizeCacheQuery(query);

    if (!normalizedQuery) {
        return null;
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
        .from("response_cache")
        .select("response")
        .eq("normalized_query", normalizedQuery)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("[CACHE] LOOKUP ERROR:", error);
        return null;
    }

    const cachedResponse =
        typeof data?.response === "string"
            ? data.response.trim()
            : "";

    if (!cachedResponse) {
        console.log("[CACHE] MISS:", normalizedQuery);
        return null;
    }

    console.log("[CACHE] HIT:", normalizedQuery);

    return cachedResponse;
}

/* =========================================================
   SAVE CACHED RESPONSE
========================================================= */

export async function saveCachedResponse(
    query: string,
    response: string
): Promise<void> {
    const normalizedQuery = normalizeCacheQuery(query);
    const cleanResponse = response.trim();

    if (!normalizedQuery || !cleanResponse) {
        return;
    }

    const supabase = createAdminClient();

    /*
     * Do not depend on an ON CONFLICT constraint here.
     * First look for an existing row. If it exists, refresh it.
     * Otherwise insert a new cache entry.
     */
    const { data: existing, error: lookupError } = await supabase
        .from("response_cache")
        .select("id")
        .eq("normalized_query", normalizedQuery)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lookupError) {
        console.error("[CACHE] SAVE LOOKUP ERROR:", lookupError);
        return;
    }

    if (existing?.id) {
        const { error: updateError } = await supabase
            .from("response_cache")
            .update({
                response: cleanResponse,
                created_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

        if (updateError) {
            console.error("[CACHE] UPDATE ERROR:", updateError);
            return;
        }

        console.log("[CACHE] UPDATED:", normalizedQuery);
        return;
    }

    const { error: insertError } = await supabase
        .from("response_cache")
        .insert({
            normalized_query: normalizedQuery,
            response: cleanResponse,
        });

    if (insertError) {
        console.error("[CACHE] SAVE ERROR:", insertError);
        return;
    }

    console.log("[CACHE] SAVED:", normalizedQuery);
}
