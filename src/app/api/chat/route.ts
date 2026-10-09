import { NextRequest } from "next/server";

import { createMedhaStream } from "@/lib/agent";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Message } from "@/types/chat";

export const runtime = "nodejs";
export const maxDuration = 60;


/* ======================================================
   ERROR HANDLING
====================================================== */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;

    const parts = [
      err.message,
      err.details,
      err.hint,
      err.code ? `Code: ${String(err.code)}` : null,
    ]
      .filter(Boolean)
      .map(String);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error";
    }
  }

  return "Unknown server error";
}


/* ======================================================
   POST /api/chat
====================================================== */

export async function POST(request: NextRequest) {
  console.log("\n====================================");
  console.log("MEDHA CHAT REQUEST STARTED");
  console.log("====================================");

  try {
    /* ==================================================
       1. READ REQUEST
    ================================================== */

    const body = await request.json();

    const messages = (body.messages || []) as Message[];

    const visitorId = String(
      body.visitorId || ""
    ).trim();

    const existingConversationId =
      body.conversationId
        ? String(body.conversationId)
        : null;

    console.log(
      "Visitor ID present:",
      Boolean(visitorId)
    );

    console.log(
      "Existing conversation:",
      Boolean(existingConversationId)
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
          error: "visitorId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!messages.length) {
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

    const latestUser = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === "user"
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

    if (!latestUser.content?.trim()) {
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
       4. CREATE SUPABASE CLIENT
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
       5. CREATE / USE CONVERSATION
    ================================================== */

    let conversationId =
      existingConversationId;

    if (!conversationId) {
      conversationId =
        crypto.randomUUID();

      const title =
        latestUser.content
          .trim()
          .slice(0, 45) ||
        "New chat";

      console.log(
        "Creating conversation:",
        conversationId
      );

      const {
        error: conversationError,
      } = await supabase
        .from("conversations")
        .insert({
          id: conversationId,

          visitor_id:
            visitorId,

          title,

          mode: "assistant",
        });

      if (conversationError) {
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
      error: userMessageError,
    } = await supabase
      .from("messages")
      .insert({
        // IMPORTANT:
        // Supabase messages.id is NOT NULL.
        id: userMessageId,

        visitor_id:
          visitorId,

        conversation_id:
          conversationId,

        role: "user",

        content:
          latestUser.content,
      });

    if (userMessageError) {
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
       7. START MEDHA / GROQ
    ================================================== */

    console.log(
      "Starting Medha AI..."
    );

    const groqStream =
      await createMedhaStream(
        messages
      );

    console.log(
      "Groq stream created successfully."
    );


    /* ==================================================
       8. STREAM RESPONSE
    ================================================== */

    const encoder =
      new TextEncoder();

    let fullText = "";

    // Freeze these values for the
    // asynchronous stream lifecycle.
    const finalConversationId =
      conversationId;

    const finalVisitorId =
      visitorId;


    const stream =
      new ReadableStream({
        async start(controller) {
          try {
            /* ==========================================
               SEND CONVERSATION METADATA
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
               STREAM GROQ TOKENS
            ========================================== */

            for await (
              const chunk of groqStream
            ) {
              const text =
                chunk.choices?.[0]
                  ?.delta?.content ||
                "";

              if (!text) {
                continue;
              }

              fullText += text;

              controller.enqueue(
                encoder.encode(text)
              );
            }


            console.log(
              "Groq streaming completed."
            );

            console.log(
              "Generated characters:",
              fullText.length
            );


            /* ==========================================
               SAVE ASSISTANT RESPONSE
            ========================================== */

            if (fullText.trim()) {
              const assistantMessageId =
                crypto.randomUUID();

              console.log(
                "Saving assistant message:",
                assistantMessageId
              );

              const {
                error:
                assistantMessageError,
              } = await supabase
                .from("messages")
                .insert({
                  // IMPORTANT:
                  // messages.id is required.
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
                 UPDATE CONVERSATION
              ======================================== */

              console.log(
                "Updating conversation timestamp..."
              );

              const {
                error:
                conversationUpdateError,
              } = await supabase
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
               FINISH STREAM
            ========================================== */

            console.log(
              "MEDHA CHAT REQUEST COMPLETED"
            );

            console.log(
              "====================================\n"
            );

            controller.close();

          } catch (
          streamError: unknown
          ) {
            /* ==========================================
               STREAM ERROR
            ========================================== */

            console.error(
              "MEDHA STREAM ERROR:",
              streamError
            );

            const readableError =
              getErrorMessage(
                streamError
              );

            console.error(
              "MEDHA STREAM ERROR MESSAGE:",
              readableError
            );

            try {
              controller.enqueue(
                encoder.encode(
                  `\n\n⚠️ Medha encountered an error: ${readableError}`
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
       9. RETURN STREAM
    ================================================== */

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

  } catch (error: unknown) {
    /* ==================================================
       API ERROR
    ================================================== */

    console.error(
      "MEDHA CHAT API ERROR:",
      error
    );

    const message =
      getErrorMessage(error);

    console.error(
      "MEDHA CHAT API ERROR MESSAGE:",
      message
    );

    console.log(
      "====================================\n"
    );

    return Response.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}