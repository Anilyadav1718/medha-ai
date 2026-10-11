import "server-only";

import {
    NextRequest,
} from "next/server";

import {
    createAdminClient,
} from "@/lib/supabase/admin";

import {
    createGeminiVisionStream,
} from "@/lib/llm/vision";

import type {
    Message,
} from "@/types/chat";

import type {
    VisionImage,
    VisionMimeType,
} from "@/types/vision";

export const runtime =
    "nodejs";

export const dynamic =
    "force-dynamic";

export const maxDuration =
    60;

/* =========================================================
   CONFIG
========================================================= */

const MAX_IMAGE_SIZE =
    2.5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES:
    VisionMimeType[] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ];

/* =========================================================
   ERROR
========================================================= */

function getErrorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
    ) {
        return error.message;
    }

    if (
        typeof error ===
        "string"
    ) {
        return error;
    }

    return (
        "Unknown vision error."
    );
}

function isRateLimitError(
    error: unknown
): boolean {
    const text =
        getErrorMessage(
            error
        ).toLowerCase();

    return (
        text.includes("429") ||
        text.includes(
            "rate limit"
        ) ||
        text.includes(
            "resource_exhausted"
        ) ||
        text.includes(
            "quota"
        )
    );
}

/* =========================================================
   IMAGE VALIDATION
========================================================= */

function parseImage(
    value: unknown
): VisionImage {
    if (
        !value ||
        typeof value !==
        "object"
    ) {
        throw new Error(
            "An image is required."
        );
    }

    const raw =
        value as Record<
            string,
            unknown
        >;

    const name =
        String(
            raw.name || "image"
        ).trim();

    const mimeType =
        String(
            raw.mimeType || ""
        ).trim() as
        VisionMimeType;

    const data =
        String(
            raw.data || ""
        ).trim();

    if (
        !ALLOWED_IMAGE_TYPES.includes(
            mimeType
        )
    ) {
        throw new Error(
            "Only JPEG, PNG and WebP images are supported."
        );
    }

    if (!data) {
        throw new Error(
            "Image data is missing."
        );
    }

    /*
     * Reject Data URLs.
     *
     * Client must send raw Base64.
     */

    if (
        data.startsWith(
            "data:"
        )
    ) {
        throw new Error(
            "Invalid image encoding."
        );
    }

    let size: number;

    try {
        size =
            Buffer.byteLength(
                data,
                "base64"
            );
    } catch {
        throw new Error(
            "Invalid Base64 image."
        );
    }

    if (
        size <= 0
    ) {
        throw new Error(
            "The image is empty."
        );
    }

    if (
        size >
        MAX_IMAGE_SIZE
    ) {
        throw new Error(
            "Image must be 2.5 MB or smaller."
        );
    }

    return {
        name,
        mimeType,
        data,
    };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
    request: NextRequest
) {
    console.log("");
    console.log(
        "===================================="
    );
    console.log(
        "MEDHA VISION REQUEST STARTED"
    );
    console.log(
        "===================================="
    );

    try {
        /* =====================================================
           REQUEST
        ===================================================== */

        const body =
            await request.json();

        const visitorId =
            String(
                body.visitorId ||
                ""
            ).trim();

        const existingConversationId =
            body.conversationId
                ? String(
                    body.conversationId
                )
                : null;

        const messages =
            (
                body.messages ||
                []
            ) as Message[];

        if (!visitorId) {
            return Response.json(
                {
                    error:
                        "visitorId is required.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            !Array.isArray(
                messages
            ) ||
            messages.length ===
            0
        ) {
            return Response.json(
                {
                    error:
                        "At least one message is required.",
                },
                {
                    status: 400,
                }
            );
        }

        const latestUser =
            [...messages]
                .reverse()
                .find(
                    (message) =>
                        message.role ===
                        "user"
                );

        if (!latestUser) {
            return Response.json(
                {
                    error:
                        "No user message was found.",
                },
                {
                    status: 400,
                }
            );
        }

        const userQuery =
            latestUser.content
                ?.trim() ||
            "Describe and analyze this image.";

        const image =
            parseImage(
                body.image
            );

        /* =====================================================
           SUPABASE
        ===================================================== */

        const supabase =
            createAdminClient();

        /* =====================================================
           CONVERSATION
        ===================================================== */

        let conversationId =
            existingConversationId;

        if (!conversationId) {
            conversationId =
                crypto.randomUUID();

            const title =
                userQuery
                    .slice(
                        0,
                        45
                    ) ||
                "Image analysis";

            const {
                error:
                conversationError,
            } =
                await supabase
                    .from(
                        "conversations"
                    )
                    .insert({
                        id:
                            conversationId,

                        visitor_id:
                            visitorId,

                        title,

                        mode:
                            "assistant",
                    });

            if (
                conversationError
            ) {
                throw new Error(
                    conversationError.message
                );
            }
        }

        /* =====================================================
           SAVE USER MESSAGE
    
           We store text only.
    
           Raw Base64 images are intentionally NOT stored
           in the messages table.
        ===================================================== */

        const {
            error:
            userMessageError,
        } =
            await supabase
                .from("messages")
                .insert({
                    id:
                        crypto.randomUUID(),

                    visitor_id:
                        visitorId,

                    conversation_id:
                        conversationId,

                    role:
                        "user",

                    content:
                        `${userQuery}\n\n📷 ${image.name}`,
                });

        if (
            userMessageError
        ) {
            throw new Error(
                userMessageError.message
            );
        }

        /* =====================================================
           GEMINI VISION
        ===================================================== */

        const visionStream =
            await createGeminiVisionStream(
                messages,
                image
            );

        /* =====================================================
           RESPONSE STREAM
        ===================================================== */

        const encoder =
            new TextEncoder();

        const finalConversationId =
            conversationId;

        const finalVisitorId =
            visitorId;

        let fullText =
            "";

        const stream =
            new ReadableStream({
                async start(
                    controller
                ) {
                    try {
                        /*
                         * Same metadata format
                         * used by normal Medha chat.
                         */

                        const metadata = {
                            conversationId:
                                finalConversationId,

                            mode:
                                "vision",
                        };

                        controller.enqueue(
                            encoder.encode(
                                `__MEDHA_META__${JSON.stringify(
                                    metadata
                                )}\n`
                            )
                        );

                        for await (
                            const text
                            of visionStream
                        ) {
                            if (!text) {
                                continue;
                            }

                            fullText +=
                                text;

                            controller.enqueue(
                                encoder.encode(
                                    text
                                )
                            );
                        }

                        /* =============================================
                           SAVE ASSISTANT
                        ============================================= */

                        if (
                            fullText.trim()
                        ) {
                            const {
                                error:
                                assistantError,
                            } =
                                await supabase
                                    .from(
                                        "messages"
                                    )
                                    .insert({
                                        id:
                                            crypto.randomUUID(),

                                        visitor_id:
                                            finalVisitorId,

                                        conversation_id:
                                            finalConversationId,

                                        role:
                                            "assistant",

                                        content:
                                            fullText.trim(),
                                    });

                            if (
                                assistantError
                            ) {
                                console.error(
                                    "[VISION] Assistant save error:",
                                    assistantError
                                );
                            }

                            /* ===========================================
                               UPDATE CONVERSATION
                            =========================================== */

                            const {
                                error:
                                updateError,
                            } =
                                await supabase
                                    .from(
                                        "conversations"
                                    )
                                    .update({
                                        updated_at:
                                            new Date()
                                                .toISOString(),
                                    })
                                    .eq(
                                        "id",
                                        finalConversationId
                                    )
                                    .eq(
                                        "visitor_id",
                                        finalVisitorId
                                    );

                            if (
                                updateError
                            ) {
                                console.error(
                                    "[VISION] Conversation update error:",
                                    updateError
                                );
                            }
                        }

                        console.log(
                            "MEDHA VISION REQUEST COMPLETED"
                        );

                        console.log(
                            "===================================="
                        );

                        controller.close();
                    } catch (
                    streamError
                    ) {
                        console.error(
                            "MEDHA VISION STREAM ERROR:",
                            streamError
                        );

                        try {
                            controller.enqueue(
                                encoder.encode(
                                    "\n\n⚠️ Medha AI encountered a problem while analyzing this image."
                                )
                            );

                            controller.close();
                        } catch {
                            controller.error(
                                streamError
                            );
                        }
                    }
                },
            });

        return new Response(
            stream,
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "text/plain; charset=utf-8",

                    "Cache-Control":
                        "no-cache, no-store, must-revalidate",

                    "X-Accel-Buffering":
                        "no",
                },
            }
        );
    } catch (error) {
        console.error(
            "MEDHA VISION API ERROR:",
            error
        );

        const message =
            getErrorMessage(
                error
            );

        const status =
            isRateLimitError(
                error
            )
                ? 429
                : message.includes(
                    "2.5 MB"
                ) ||
                    message.includes(
                        "supported"
                    ) ||
                    message.includes(
                        "required"
                    ) ||
                    message.includes(
                        "Base64"
                    )
                    ? 400
                    : 500;

        return Response.json(
            {
                error:
                    isRateLimitError(
                        error
                    )
                        ? "Medha Vision is temporarily busy because the Gemini usage limit has been reached. Please try again shortly."
                        : message,
            },
            {
                status,
            }
        );
    }
}