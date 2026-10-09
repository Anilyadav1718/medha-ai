/* ======================================================
   ERROR TEXT
====================================================== */

export function getLLMErrorText(
    error: unknown
): string {

    if (
        error instanceof Error
    ) {
        return error.message;
    }


    if (
        typeof error === "string"
    ) {
        return error;
    }


    try {
        return JSON.stringify(
            error
        );
    } catch {
        return "Unknown LLM error";
    }
}


/* ======================================================
   RATE LIMIT DETECTION
====================================================== */

export function isRateLimitError(
    error: unknown
): boolean {

    const text =
        getLLMErrorText(
            error
        ).toLowerCase();


    return (
        text.includes("429") ||

        text.includes(
            "rate limit"
        ) ||

        text.includes(
            "rate_limit"
        ) ||

        text.includes(
            "rate_limit_exceeded"
        ) ||

        text.includes(
            "resource_exhausted"
        ) ||

        text.includes(
            "resource exhausted"
        ) ||

        text.includes(
            "quota exceeded"
        ) ||

        text.includes(
            "quota"
        ) ||

        text.includes(
            "tokens per day"
        ) ||

        text.includes(
            "usage limit"
        )
    );
}


/* ======================================================
   RETRY AFTER
====================================================== */

export function getRetryAfterSeconds(
    error: unknown
): number {

    const object =
        error as {
            headers?: {
                get?: (
                    key: string
                ) => string | null;

                ["retry-after"]?:
                string;
            };
        };


    /* ====================================================
       FETCH-STYLE HEADERS
    ==================================================== */

    const viaGet =
        object
            ?.headers
            ?.get?.(
                "retry-after"
            );


    if (viaGet) {

        const value =
            Number(
                viaGet
            );


        if (
            Number.isFinite(
                value
            ) &&
            value > 0
        ) {
            return Math.ceil(
                value
            );
        }
    }


    /* ====================================================
       SDK HEADER OBJECT
    ==================================================== */

    const direct =
        object
            ?.headers?.[
        "retry-after"
        ];


    if (direct) {

        const value =
            Number(
                direct
            );


        if (
            Number.isFinite(
                value
            ) &&
            value > 0
        ) {
            return Math.ceil(
                value
            );
        }
    }


    /* ====================================================
       "TRY AGAIN IN 4m44s"
    ==================================================== */

    const text =
        getLLMErrorText(
            error
        );


    const minuteMatch =
        text.match(
            /try again in\s+(\d+)m([\d.]+)s/i
        );


    if (
        minuteMatch
    ) {

        const minutes =
            Number(
                minuteMatch[1]
            );


        const seconds =
            Number(
                minuteMatch[2]
            );


        return (
            minutes * 60 +
            Math.ceil(
                seconds
            )
        );
    }


    /* ====================================================
       "TRY AGAIN IN 45s"
    ==================================================== */

    const secondMatch =
        text.match(
            /try again in\s+([\d.]+)s/i
        );


    if (
        secondMatch
    ) {
        return Math.ceil(
            Number(
                secondMatch[1]
            )
        );
    }


    /* ====================================================
       DEFAULT COOLDOWN
    ==================================================== */

    return 300;
}