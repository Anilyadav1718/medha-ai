import { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Supabase frequently returns structured error objects
 * instead of JavaScript Error instances.
 *
 * This helper converts both formats into readable messages.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const err =
      error as Record<string, unknown>;

    const parts = [
      err.message,
      err.details,
      err.hint,
      err.code
        ? `Code: ${String(err.code)}`
        : null,
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

// ======================================================
// GET
// ======================================================
//
// Without conversationId:
//     Return conversation history.
//
// With conversationId:
//     Return messages belonging to that conversation.
//
// ======================================================

export async function GET(
  request: NextRequest
) {
  try {
    const visitorId =
      request.nextUrl.searchParams.get(
        "visitorId"
      );

    const conversationId =
      request.nextUrl.searchParams.get(
        "conversationId"
      );

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

    const supabase =
      createAdminClient();

    // --------------------------------------------------
    // Get messages
    // --------------------------------------------------

    if (conversationId) {
      console.log(
        "Loading conversation:",
        conversationId
      );

      const {
        data,
        error,
      } = await supabase
        .from("messages")
        .select("*")
        .eq(
          "visitor_id",
          visitorId
        )
        .eq(
          "conversation_id",
          conversationId
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          "SUPABASE LOAD MESSAGES ERROR:",
          error
        );

        throw error;
      }

      return Response.json({
        messages: data || [],
      });
    }

    // --------------------------------------------------
    // Get conversations
    // --------------------------------------------------

    console.log(
      "Loading conversations..."
    );

    const {
      data,
      error,
    } = await supabase
      .from("conversations")
      .select("*")
      .eq(
        "visitor_id",
        visitorId
      )
      .order(
        "updated_at",
        {
          ascending: false,
        }
      )
      .limit(50);

    if (error) {
      console.error(
        "SUPABASE LOAD CONVERSATIONS ERROR:",
        error
      );

      throw error;
    }

    return Response.json({
      conversations:
        data || [],
    });
  } catch (error: unknown) {
    console.error(
      "MEDHA CONVERSATION GET ERROR:",
      error
    );

    const message =
      getErrorMessage(error);

    console.error(
      "MEDHA CONVERSATION GET ERROR MESSAGE:",
      message
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

// ======================================================
// PATCH
// ======================================================
//
// Rename conversation.
//
// ======================================================

export async function PATCH(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const visitorId =
      String(
        body.visitorId || ""
      ).trim();

    const conversationId =
      String(
        body.conversationId || ""
      ).trim();

    const title =
      String(
        body.title || ""
      ).trim();

    if (
      !visitorId ||
      !conversationId ||
      !title
    ) {
      return Response.json(
        {
          error:
            "visitorId, conversationId and title are required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      createAdminClient();

    const {
      error,
    } = await supabase
      .from("conversations")
      .update({
        title,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "visitor_id",
        visitorId
      )
      .eq(
        "id",
        conversationId
      );

    if (error) {
      console.error(
        "SUPABASE RENAME CONVERSATION ERROR:",
        error
      );

      throw error;
    }

    return Response.json({
      ok: true,
    });
  } catch (error: unknown) {
    console.error(
      "MEDHA CONVERSATION PATCH ERROR:",
      error
    );

    const message =
      getErrorMessage(error);

    console.error(
      "MEDHA CONVERSATION PATCH ERROR MESSAGE:",
      message
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

// ======================================================
// DELETE
// ======================================================
//
// conversationId provided:
//     Delete one conversation.
//
// conversationId omitted:
//     Delete all conversations belonging to visitor.
//
// ======================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    const visitorId =
      request.nextUrl.searchParams.get(
        "visitorId"
      );

    const conversationId =
      request.nextUrl.searchParams.get(
        "conversationId"
      );

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

    const supabase =
      createAdminClient();

    // --------------------------------------------------
    // Delete one conversation
    // --------------------------------------------------

    if (conversationId) {
      console.log(
        "Deleting conversation:",
        conversationId
      );

      const {
        error:
        messageDeleteError,
      } = await supabase
        .from("messages")
        .delete()
        .eq(
          "visitor_id",
          visitorId
        )
        .eq(
          "conversation_id",
          conversationId
        );

      if (
        messageDeleteError
      ) {
        console.error(
          "SUPABASE DELETE MESSAGES ERROR:",
          messageDeleteError
        );

        throw messageDeleteError;
      }

      const {
        error:
        conversationDeleteError,
      } = await supabase
        .from("conversations")
        .delete()
        .eq(
          "visitor_id",
          visitorId
        )
        .eq(
          "id",
          conversationId
        );

      if (
        conversationDeleteError
      ) {
        console.error(
          "SUPABASE DELETE CONVERSATION ERROR:",
          conversationDeleteError
        );

        throw conversationDeleteError;
      }

      return Response.json({
        ok: true,
      });
    }

    // --------------------------------------------------
    // Delete all visitor conversations
    // --------------------------------------------------

    console.log(
      "Deleting all conversations for visitor."
    );

    const {
      error:
      allMessagesDeleteError,
    } = await supabase
      .from("messages")
      .delete()
      .eq(
        "visitor_id",
        visitorId
      );

    if (
      allMessagesDeleteError
    ) {
      console.error(
        "SUPABASE DELETE ALL MESSAGES ERROR:",
        allMessagesDeleteError
      );

      throw allMessagesDeleteError;
    }

    const {
      error:
      allConversationsDeleteError,
    } = await supabase
      .from("conversations")
      .delete()
      .eq(
        "visitor_id",
        visitorId
      );

    if (
      allConversationsDeleteError
    ) {
      console.error(
        "SUPABASE DELETE ALL CONVERSATIONS ERROR:",
        allConversationsDeleteError
      );

      throw allConversationsDeleteError;
    }

    return Response.json({
      ok: true,
    });
  } catch (error: unknown) {
    console.error(
      "MEDHA CONVERSATION DELETE ERROR:",
      error
    );

    const message =
      getErrorMessage(error);

    console.error(
      "MEDHA CONVERSATION DELETE ERROR MESSAGE:",
      message
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