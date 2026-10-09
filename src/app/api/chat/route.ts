import { NextRequest } from "next/server";

import { createMedhaStream } from "@/lib/agent";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  getCachedResponse,
  saveCachedResponse,
  shouldBypassCache,
} from "@/lib/cache";

import {
  getIdentityResponse,
} from "@/lib/identity";

import type { Message } from "@/types/chat";


export const runtime = "nodejs";
export const maxDuration = 60;


/* ======================================================
   RAW ERROR MESSAGE
====================================================== */

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null
  ) {
    const err =
      error as Record<
        string,
        unknown
      >;

    const parts = [
      err.message,
      err.details,
      err.hint,

      err.code
        ? `Code: ${String(
          err.code
        )}`
        : null,
    ]
      .filter(Boolean)
      .map(String);


    if (parts.length > 0) {
      return parts.join(
        " | "
      );
    }


    try {
      return JSON.stringify(
        error
      );
    } catch {
      return "Unknown object error";
    }
  }


  return "Unknown server error";
}


/* ======================================================
   SAFE USER-FACING ERROR MESSAGE
====================================================== */

function getSafeErrorMessage(
  error: unknown
): string {
  const raw =
    getErrorMessage(
      error
    );

  const lower =
    raw.toLowerCase();


  /*
   * ----------------------------------------------------
   * GROQ RATE LIMIT
   * ----------------------------------------------------
   *
   * Also recognizes our already-sanitized error so
   * double error handling cannot turn it into the
   * generic fallback.
   */

  if (
    lower.includes("429") ||
    lower.includes(
      "rate limit"
    ) ||
    lower.includes(
      "rate_limit_exceeded"
    ) ||
    lower.includes(
      "tokens per day"
    ) ||
    lower.includes(
      "usage limit has been reached"
    )
  ) {
    return (
      "Medha AI is temporarily busy because the AI usage limit has been reached. Please try again shortly."
    );
  }


  /*
   * ----------------------------------------------------
   * TIMEOUT
   * ----------------------------------------------------
   */

  if (
    lower.includes(
      "timeout"
    ) ||
    lower.includes(
      "timed out"
    )
  ) {
    return (
      "Medha AI took too long to respond. Please try again."
    );
  }


  /*
   * ----------------------------------------------------
   * GENERIC SAFE ERROR
   * ----------------------------------------------------
   */

  return (
    "Medha AI ran into a temporary problem. Please try again."
  );
}


/* ======================================================
   DETECT RATE LIMIT STATUS
====================================================== */

function isRateLimitError(
  error: unknown
): boolean {
  const raw =
    getErrorMessage(
      error
    ).toLowerCase();

  return (
    raw.includes("429") ||
    raw.includes(
      "rate limit"
    ) ||
    raw.includes(
      "rate_limit_exceeded"
    ) ||
    raw.includes(
      "tokens per day"
    ) ||
    raw.includes(
      "usage limit has been reached"
    )
  );
}


/* ======================================================
   POST /api/chat
====================================================== */

export async function POST(
  request: NextRequest
) {
  console.log(
    "\n===================================="
  );

  console.log(
    "MEDHA CHAT REQUEST STARTED"
  );

  console.log(
    "===================================="
  );


  try {

    /* ==================================================
       1. READ REQUEST BODY
    ================================================== */

    const body =
      await request.json();


    const messages =
      (body.messages ||
        []) as Message[];


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


    console.log(
      "Visitor ID present:",
      Boolean(
        visitorId
      )
    );


    console.log(
      "Existing conversation:",
      Boolean(
        existingConversationId
      )
    );


    console.log(
      "Message count:",
      messages.length
    );


    /* ==================================================
       2. VALIDATE REQUEST
    ================================================== */

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
      messages.length === 0
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


    /* ==================================================
       3. FIND LATEST USER MESSAGE
    ================================================== */

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
        ?.trim() || "";


    if (!userQuery) {
      return Response.json(
        {
          error:
            "User message cannot be empty.",
        },
        {
          status: 400,
        }
      );
    }


    /* ==================================================
       4. SUPABASE
    ================================================== */

    console.log(
      "Creating Supabase admin client..."
    );


    const supabase =
      createAdminClient();


    console.log(
      "Supabase admin client created."
    );


    /* ==================================================
       5. CREATE OR USE CONVERSATION
    ================================================== */

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
        "New chat";


      console.log(
        "Creating conversation:",
        conversationId
      );


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
        console.error(
          "SUPABASE CREATE CONVERSATION ERROR:",
          conversationError
        );

        throw conversationError;
      }


      console.log(
        "Conversation created successfully."
      );

    } else {

      console.log(
        "Using conversation:",
        conversationId
      );
    }


    /* ==================================================
       6. SAVE USER MESSAGE
    ================================================== */

    const userMessageId =
      crypto.randomUUID();


    console.log(
      "Saving user message:",
      userMessageId
    );


    const {
      error:
      userMessageError,
    } =
      await supabase
        .from("messages")
        .insert({
          id:
            userMessageId,

          visitor_id:
            visitorId,

          conversation_id:
            conversationId,

          role:
            "user",

          content:
            userQuery,
        });


    if (
      userMessageError
    ) {
      console.error(
        "SUPABASE SAVE USER MESSAGE ERROR:",
        userMessageError
      );

      throw userMessageError;
    }


    console.log(
      "User message saved successfully."
    );


    /* ==================================================
       7. SMART ROUTING
    ================================================== */

    /*
     * --------------------------------------------------
     * IDENTITY
     * --------------------------------------------------
     *
     * These questions never need Groq.
     */

    const identityResponse =
      getIdentityResponse(
        userQuery
      );


    let directResponse:
      string | null =
      identityResponse;


    let responseSource:
      "identity" |
      "cache" |
      "groq" =
      identityResponse
        ? "identity"
        : "groq";


    if (
      identityResponse
    ) {
      console.log(
        "[MEDHA ROUTER] Identity response."
      );

      console.log(
        "[MEDHA ROUTER] Groq skipped."
      );
    }


    /*
     * --------------------------------------------------
     * CACHE DECISION
     * --------------------------------------------------
     */

    const bypassCache =
      shouldBypassCache(
        userQuery,
        messages.length
      );


    /*
     * --------------------------------------------------
     * CACHE LOOKUP
     * --------------------------------------------------
     */

    if (
      !directResponse &&
      !bypassCache
    ) {
      const cachedResponse =
        await getCachedResponse(
          userQuery
        );


      if (
        cachedResponse
      ) {
        directResponse =
          cachedResponse;

        responseSource =
          "cache";


        console.log(
          "[MEDHA ROUTER] Cache HIT."
        );

        console.log(
          "[MEDHA ROUTER] Groq skipped."
        );

      } else {

        console.log(
          "[MEDHA ROUTER] Cache MISS."
        );
      }

    } else if (
      !identityResponse &&
      bypassCache
    ) {
      console.log(
        "[MEDHA ROUTER] Cache bypassed."
      );
    }


    /* ==================================================
       8. CREATE GROQ STREAM WHEN REQUIRED
    ================================================== */

    let groqStream:
      Awaited<
        ReturnType<
          typeof createMedhaStream
        >
      > | null =
      null;


    if (!directResponse) {

      console.log(
        "Starting Medha AI / Groq..."
      );


      try {

        groqStream =
          await createMedhaStream(
            messages
          );


        console.log(
          "Groq stream created successfully."
        );

      } catch (
      groqError
      ) {

        /*
         * Full details remain available only
         * in server logs.
         */

        console.error(
          "GROQ START ERROR:",
          groqError
        );


        /*
         * Throw only safe information to the
         * outer API handler.
         */

        throw new Error(
          getSafeErrorMessage(
            groqError
          )
        );
      }
    }


    /* ==================================================
       9. CREATE RESPONSE STREAM
    ================================================== */

    const encoder =
      new TextEncoder();


    let fullText =
      "";


    /*
     * Copy values needed inside the stream.
     */

    const finalConversationId =
      conversationId;

    const finalVisitorId =
      visitorId;

    const finalUserQuery =
      userQuery;

    const finalBypassCache =
      bypassCache;

    const finalResponseSource =
      responseSource;


    const stream =
      new ReadableStream({

        async start(
          controller
        ) {

          try {

            /* ==========================================
               SEND METADATA FIRST
            ========================================== */

            const metadata = {
              conversationId:
                finalConversationId,
            };


            controller.enqueue(
              encoder.encode(
                `__MEDHA_META__${JSON.stringify(
                  metadata
                )}\n`
              )
            );


            /* ==========================================
               IDENTITY / CACHE DIRECT RESPONSE
            ========================================== */

            if (
              directResponse
            ) {

              fullText =
                directResponse;


              /*
               * Cached/direct answers are returned
               * immediately.
               *
               * We intentionally do NOT fake token
               * generation for cached answers.
               */

              controller.enqueue(
                encoder.encode(
                  directResponse
                )
              );


              console.log(
                "Direct response streamed."
              );


              console.log(
                "Response source:",
                finalResponseSource
              );

            } else {

              /* ========================================
                 GROQ TRUE STREAMING
              ======================================== */

              if (
                !groqStream
              ) {
                throw new Error(
                  "Medha response stream was not initialized."
                );
              }


              for await (
                const chunk of groqStream
              ) {

                const text =
                  chunk
                    .choices?.[0]
                    ?.delta
                    ?.content ||
                  "";


                if (!text) {
                  continue;
                }


                fullText +=
                  text;


                /*
                 * Real chunk-by-chunk streaming.
                 */

                controller.enqueue(
                  encoder.encode(
                    text
                  )
                );
              }


              console.log(
                "Groq streaming completed."
              );


              console.log(
                "Generated characters:",
                fullText.length
              );
            }


            /* ==========================================
               SAVE ASSISTANT MESSAGE
            ========================================== */

            if (
              fullText.trim()
            ) {

              const assistantMessageId =
                crypto.randomUUID();


              console.log(
                "Saving assistant message:",
                assistantMessageId
              );


              const {
                error:
                assistantMessageError,
              } =
                await supabase
                  .from(
                    "messages"
                  )
                  .insert({
                    id:
                      assistantMessageId,

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
                assistantMessageError
              ) {

                console.error(
                  "SUPABASE SAVE ASSISTANT ERROR:",
                  assistantMessageError
                );

              } else {

                console.log(
                  "Assistant message saved successfully."
                );
              }


              /* ========================================
                 SAVE NEW GROQ ANSWER TO CACHE
              ======================================== */

              /*
               * Only newly-generated safe answers
               * should be saved.
               *
               * Don't re-save:
               * - identity responses
               * - existing cache responses
               * - current/latest information
               * - contextual follow-ups
               */

              if (
                finalResponseSource ===
                "groq" &&
                !finalBypassCache
              ) {

                await saveCachedResponse(
                  finalUserQuery,
                  fullText.trim()
                );
              }


              /* ========================================
                 UPDATE CONVERSATION TIMESTAMP
              ======================================== */

              console.log(
                "Updating conversation timestamp..."
              );


              const {
                error:
                conversationUpdateError,
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
                conversationUpdateError
              ) {

                console.error(
                  "SUPABASE UPDATE CONVERSATION ERROR:",
                  conversationUpdateError
                );

              } else {

                console.log(
                  "Conversation timestamp updated."
                );
              }
            }


            /* ==========================================
               COMPLETE
            ========================================== */

            console.log(
              "MEDHA CHAT REQUEST COMPLETED"
            );


            console.log(
              "====================================\n"
            );


            controller.close();

          } catch (
          streamError:
            unknown
          ) {

            /*
             * Full error only goes to server logs.
             */

            console.error(
              "MEDHA STREAM ERROR:",
              streamError
            );


            const safeMessage =
              getSafeErrorMessage(
                streamError
              );


            console.error(
              "MEDHA STREAM SAFE MESSAGE:",
              safeMessage
            );


            try {

              controller.enqueue(
                encoder.encode(
                  `\n\n⚠️ ${safeMessage}`
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


    /* ==================================================
       10. RETURN STREAM
    ================================================== */

    return new Response(
      stream,
      {
        status: 200,

        headers: {

          "Content-Type":
            "text/plain; charset=utf-8",

          /*
           * Browser/CDN caching is disabled.
           *
           * Supabase response_cache is our
           * application-level cache.
           */

          "Cache-Control":
            "no-cache, no-store, must-revalidate",

          /*
           * Helps prevent proxy buffering.
           */

          "X-Accel-Buffering":
            "no",
        },
      }
    );

  } catch (
  error:
    unknown
  ) {

    /* ==================================================
       OUTER API ERROR
    ================================================== */

    console.error(
      "MEDHA CHAT API ERROR:",
      error
    );


    const safeMessage =
      getSafeErrorMessage(
        error
      );


    console.error(
      "MEDHA CHAT SAFE ERROR:",
      safeMessage
    );


    console.log(
      "====================================\n"
    );


    const status =
      isRateLimitError(
        error
      )
        ? 429
        : 500;


    return Response.json(
      {
        error:
          safeMessage,
      },
      {
        status,
      }
    );
  }
}