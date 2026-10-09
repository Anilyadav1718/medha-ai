/* ======================================================
   MEDHA AI IDENTITY ROUTER
====================================================== */

export function getIdentityResponse(
    query: string
): string | null {
    const normalized =
        query
            .toLowerCase()
            .trim()
            .replace(/[?!.,;:]+$/g, "")
            .replace(/\s+/g, " ");


    const identityPatterns = [
        /who developed you/,
        /who developed medha/,
        /who developed medha ai/,

        /who created you/,
        /who created medha/,
        /who created medha ai/,

        /who made you/,
        /who made medha/,
        /who made medha ai/,

        /who is your developer/,
        /who is the developer of medha/,
        /who is medha developer/,

        /who is your creator/,
        /who is the creator of medha/,
        /who is medha creator/,

        /who founded medha/,
        /who founded medha ai/,
        /who is medha founder/,
        /who is medha ai founder/,
    ];


    const matched =
        identityPatterns.some(
            (pattern) =>
                pattern.test(normalized)
        );


    if (!matched) {
        return null;
    }


    /*
     * Deterministic identity response.
     *
     * No Groq call.
     * No Tavily call.
     * No cache required.
     */

    return (
        "Medha AI was founded and developed by Anil Panchitha."
    );
}