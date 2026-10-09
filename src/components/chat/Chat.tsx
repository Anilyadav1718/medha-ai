"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Image from "next/image";

import {
  Menu,
} from "lucide-react";

import ChatInput from "@/components/chat/ChatInput";
import MessageList from "@/components/chat/MessageList";
import QuickActions from "@/components/home/QuickActions";
import Sidebar from "@/components/sidebar/Sidebar";
import DocumentUpload from "@/components/rag/DocumentUpload";

import type {
  ChatMode,
  Conversation,
  Message,
} from "@/types/chat";


/* ======================================================
   VISITOR ID
====================================================== */

function getVisitorId(): string {
  const key = "medha_visitor_id";

  const existing =
    localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created =
    crypto.randomUUID();

  localStorage.setItem(
    key,
    created
  );

  return created;
}


/* ======================================================
   CHAT COMPONENT
====================================================== */

export default function Chat() {

  /* ====================================================
     STATE
  ==================================================== */

  const [
    visitorId,
    setVisitorId,
  ] = useState("");

  const [
    mode,
    setMode,
  ] = useState<ChatMode>(
    "assistant"
  );

  const [
    messages,
    setMessages,
  ] = useState<Message[]>([]);

  const [
    conversations,
    setConversations,
  ] = useState<
    Conversation[]
  >([]);

  const [
    conversationId,
    setConversationId,
  ] = useState<
    string | null
  >(null);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  /*
   * isGenerating:
   * True for the entire lifetime of the request.
   *
   * Used for:
   * - stop button
   * - preventing duplicate sends
   * - preventing conversation switching
   */
  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  /*
   * isThinking:
   * True only while waiting for the first
   * actual assistant text.
   *
   * As soon as the first response text arrives,
   * this becomes false.
   */
  const [
    isThinking,
    setIsThinking,
  ] = useState(false);

  const [
    scrollSignal,
    setScrollSignal,
  ] = useState(0);


  /* ====================================================
     REFS
  ==================================================== */

  const abortRef =
    useRef<
      AbortController | null
    >(null);

  /*
   * Keep the active conversation ID
   * available synchronously.
   *
   * React state updates are asynchronous,
   * so the ref prevents the next message
   * from accidentally creating a new chat.
   */
  const conversationIdRef =
    useRef<
      string | null
    >(null);


  /* ====================================================
     INITIALIZATION
  ==================================================== */

  useEffect(() => {
    const id =
      getVisitorId();

    setVisitorId(id);

    void loadConversations(id);
  }, []);


  /* ====================================================
     LOAD CONVERSATIONS
  ==================================================== */

  async function loadConversations(
    id = visitorId
  ) {
    if (!id) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/conversations?visitorId=${encodeURIComponent(
            id
          )}`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {
        console.error(
          "Unable to load conversations."
        );

        return;
      }

      const data =
        await response.json();

      setConversations(
        data.conversations || []
      );

    } catch (error) {
      console.error(
        "LOAD CONVERSATIONS ERROR:",
        error
      );
    }
  }


  /* ====================================================
     OPEN CONVERSATION
  ==================================================== */

  async function openConversation(
    id: string
  ) {
    if (
      !visitorId ||
      isGenerating
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/conversations?visitorId=${encodeURIComponent(
            visitorId
          )}&conversationId=${encodeURIComponent(
            id
          )}`,
          {
            cache: "no-store",
          }
        );

      if (!response.ok) {
        console.error(
          "Unable to open conversation."
        );

        return;
      }

      const data =
        await response.json();

      /*
       * Update state and ref.
       */
      setConversationId(id);

      conversationIdRef.current =
        id;

      setMessages(
        data.messages || []
      );

      setSidebarOpen(false);

      setScrollSignal(
        (value) =>
          value + 1
      );

    } catch (error) {
      console.error(
        "OPEN CONVERSATION ERROR:",
        error
      );
    }
  }


  /* ====================================================
     DELETE ONE CONVERSATION
  ==================================================== */

  async function deleteConversation(
    id: string
  ) {
    if (
      !visitorId ||
      isGenerating
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/conversations?visitorId=${encodeURIComponent(
            visitorId
          )}&conversationId=${encodeURIComponent(
            id
          )}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        let errorMessage =
          "Unable to delete conversation.";

        try {
          const data =
            await response.json();

          if (data.error) {
            errorMessage =
              data.error;
          }

        } catch {
          // Keep default message.
        }

        throw new Error(
          errorMessage
        );
      }

      /*
       * If the deleted conversation
       * is currently open, reset chat.
       */
      if (
        conversationIdRef.current ===
        id
      ) {
        conversationIdRef.current =
          null;

        setConversationId(null);

        setMessages([]);
      }

      /*
       * Update sidebar immediately.
       */
      setConversations(
        (previous) =>
          previous.filter(
            (conversation) =>
              conversation.id !== id
          )
      );

      /*
       * Refresh from database to ensure
       * UI and Supabase remain synchronized.
       */
      await loadConversations();

    } catch (error) {
      console.error(
        "DELETE CONVERSATION ERROR:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete conversation."
      );
    }
  }


  /* ====================================================
     DELETE ALL CONVERSATIONS
  ==================================================== */

  async function deleteAllConversations() {
    if (
      !visitorId ||
      isGenerating ||
      conversations.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete all conversations? This cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/conversations?visitorId=${encodeURIComponent(
            visitorId
          )}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        let errorMessage =
          "Unable to delete all conversations.";

        try {
          const data =
            await response.json();

          if (data.error) {
            errorMessage =
              data.error;
          }

        } catch {
          // Keep default message.
        }

        throw new Error(
          errorMessage
        );
      }

      /*
       * Reset conversation reference.
       */
      conversationIdRef.current =
        null;

      /*
       * Reset active conversation.
       */
      setConversationId(null);

      /*
       * Remove current messages.
       */
      setMessages([]);

      /*
       * Clear Recents immediately.
       */
      setConversations([]);

      /*
       * Clear sidebar search.
       */
      setSearch("");

      /*
       * Return to normal assistant mode.
       */
      setMode("assistant");

      /*
       * Close mobile sidebar.
       */
      setSidebarOpen(false);

    } catch (error) {
      console.error(
        "DELETE ALL CONVERSATIONS ERROR:",
        error
      );

      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete all conversations."
      );
    }
  }


  /* ====================================================
     NEW CHAT
  ==================================================== */

  function newChat() {
    if (isGenerating) {
      return;
    }

    conversationIdRef.current =
      null;

    setConversationId(null);

    setMessages([]);

    setSearch("");

    setSidebarOpen(false);

    setIsThinking(false);
  }


  /* ====================================================
     CHANGE MODE
  ==================================================== */

  function changeMode(
    nextMode: ChatMode
  ) {
    if (isGenerating) {
      return;
    }

    setMode(nextMode);

    conversationIdRef.current =
      null;

    setConversationId(null);

    setMessages([]);

    setSidebarOpen(false);

    setIsThinking(false);
  }


  /* ====================================================
     SEND MESSAGE
  ==================================================== */

  async function sendMessage(
    text: string,
    displayText?: string
  ) {
    if (
      !visitorId ||
      isGenerating ||
      mode !== "assistant"
    ) {
      return;
    }

    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }


    /* ==================================================
       USER MESSAGE
    ================================================== */

    const userMessageId =
      crypto.randomUUID();

    /*
     * What the user sees.
     *
     * Quick actions can display a short
     * label while sending a longer prompt
     * to the model.
     */
    const visibleUserMessage: Message = {
      id: userMessageId,
      role: "user",
      content:
        displayText ||
        cleanText,
    };

    /*
     * What the model receives.
     */
    const modelUserMessage: Message = {
      id: userMessageId,
      role: "user",
      content: cleanText,
    };

    /*
     * Capture model history before
     * changing the visible UI.
     */
    const historyForModel: Message[] = [
      ...messages,
      modelUserMessage,
    ];

    /*
     * Show user message immediately.
     */
    setMessages(
      (previous) => [
        ...previous,
        visibleUserMessage,
      ]
    );

    /*
     * Overall generation starts here.
     */
    setIsGenerating(true);

    /*
     * Thinking starts here and will stop
     * as soon as first real text arrives.
     */
    setIsThinking(true);

    setScrollSignal(
      (value) =>
        value + 1
    );


    /* ==================================================
       ASSISTANT PLACEHOLDER
    ================================================== */

    const assistantId =
      crypto.randomUUID();

    /*
     * Add an empty assistant message.
     *
     * Streaming tokens update this same
     * message rather than creating many
     * individual messages.
     */
    setMessages(
      (previous) => [
        ...previous,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]
    );


    /* ==================================================
       ABORT CONTROLLER
    ================================================== */

    const controller =
      new AbortController();

    abortRef.current =
      controller;

    try {

      /* =================================================
         CHAT REQUEST
      ================================================= */

      const response =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify({
                visitorId,

                conversationId:
                  conversationIdRef.current,

                messages:
                  historyForModel,
              }),
          }
        );


      /* =================================================
         HTTP ERROR
      ================================================= */

      if (!response.ok) {
        let errorMessage =
          "Chat request failed.";

        try {
          const errorData =
            await response.json();

          errorMessage =
            errorData.error ||
            errorMessage;

        } catch {
          try {
            const text =
              await response.text();

            if (text) {
              errorMessage =
                text;
            }

          } catch {
            // Keep default error.
          }
        }

        throw new Error(
          errorMessage
        );
      }


      if (!response.body) {
        throw new Error(
          "The server returned no response stream."
        );
      }


      /* =================================================
         STREAM READER
      ================================================= */

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      /*
       * Network chunks can split metadata
       * or response text at arbitrary places.
       */
      let buffer = "";

      let metadataProcessed =
        false;

      let streamedText = "";

      /*
       * Prevent unnecessary repeated
       * setIsThinking(false) calls.
       */
      let firstTextReceived =
        false;


      /* =================================================
         READ STREAM
      ================================================= */

      while (true) {
        const {
          done,
          value,
        } =
          await reader.read();

        if (done) {
          /*
           * Flush remaining decoder bytes.
           */
          buffer +=
            decoder.decode();

          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );


        /* ===============================================
           PROCESS CONVERSATION METADATA
        =============================================== */

        if (!metadataProcessed) {

          const prefix =
            "__MEDHA_META__";

          /*
           * Backend sends:
           *
           * __MEDHA_META__{"conversationId":"..."}\n
           */
          if (
            buffer.startsWith(
              prefix
            )
          ) {
            const newlineIndex =
              buffer.indexOf(
                "\n"
              );

            /*
             * Metadata may be split across
             * network chunks.
             */
            if (
              newlineIndex === -1
            ) {
              continue;
            }

            const metadataString =
              buffer.slice(
                prefix.length,
                newlineIndex
              );

            try {
              const metadata =
                JSON.parse(
                  metadataString
                );

              if (
                metadata.conversationId
              ) {
                const newId =
                  String(
                    metadata.conversationId
                  );

                /*
                 * Update state and synchronous ref.
                 */
                conversationIdRef.current =
                  newId;

                setConversationId(
                  newId
                );

                console.log(
                  "Medha conversation ID:",
                  newId
                );
              }

            } catch (
            metadataError
            ) {
              console.error(
                "METADATA PARSE ERROR:",
                metadataError
              );
            }

            /*
             * Remove metadata.
             *
             * Everything after the newline
             * is actual assistant content.
             */
            buffer =
              buffer.slice(
                newlineIndex + 1
              );

            metadataProcessed =
              true;

          } else {

            /*
             * Safety fallback.
             *
             * If the server ever returns
             * plain text without metadata,
             * don't destroy the response.
             */
            metadataProcessed =
              true;
          }
        }


        /* ===============================================
           RENDER STREAMED ASSISTANT TEXT
        =============================================== */

        if (
          metadataProcessed &&
          buffer
        ) {
          const chunkText =
            buffer;

          buffer = "";

          /*
           * The moment actual response text arrives,
           * Medha is no longer "thinking".
           */
          if (
            !firstTextReceived &&
            chunkText.trim()
          ) {
            firstTextReceived =
              true;

            setIsThinking(false);
          }

          streamedText +=
            chunkText;

          setMessages(
            (previous) =>
              previous.map(
                (message) =>
                  message.id ===
                    assistantId
                    ? {
                      ...message,
                      content:
                        streamedText,
                    }
                    : message
              )
          );

          /*
           * Notify MessageList that content
           * has changed.
           */
          setScrollSignal(
            (value) =>
              value + 1
          );
        }
      }


      /* =================================================
         FINAL BUFFER
      ================================================= */

      if (
        metadataProcessed &&
        buffer
      ) {
        /*
         * Very short responses can potentially
         * remain in the final decoder buffer.
         */
        if (
          !firstTextReceived &&
          buffer.trim()
        ) {
          firstTextReceived =
            true;

          setIsThinking(false);
        }

        streamedText +=
          buffer;

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                  assistantId
                  ? {
                    ...message,
                    content:
                      streamedText,
                  }
                  : message
            )
        );
      }


      /* =================================================
         EMPTY RESPONSE SAFETY
      ================================================= */

      if (
        !streamedText.trim()
      ) {
        setIsThinking(false);

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                  assistantId
                  ? {
                    ...message,
                    content:
                      "Medha generated an empty response. Please try again.",
                  }
                  : message
            )
        );
      }


      /* =================================================
         REFRESH SIDEBAR
      ================================================= */

      await loadConversations();

    } catch (error) {

      /*
       * Whatever error occurred, we are no
       * longer waiting for the first token.
       */
      setIsThinking(false);


      /* =================================================
         ABORT
      ================================================= */

      if (
        error instanceof Error &&
        error.name ===
        "AbortError"
      ) {
        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                  assistantId &&
                  !message.content
                  ? {
                    ...message,
                    content:
                      "Generation stopped.",
                  }
                  : message
            )
        );

        return;
      }


      /* =================================================
         NORMAL ERROR
      ================================================= */

      console.error(
        "MEDHA FRONTEND CHAT ERROR:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error";

      setMessages(
        (previous) =>
          previous.map(
            (message) =>
              message.id ===
                assistantId
                ? {
                  ...message,
                  content:
                    `I ran into an error: ${errorMessage}`,
                }
                : message
          )
      );

    } finally {

      abortRef.current =
        null;

      /*
       * Safety cleanup.
       */
      setIsThinking(false);

      /*
       * Entire request is now finished.
       */
      setIsGenerating(false);

      setScrollSignal(
        (value) =>
          value + 1
      );
    }
  }


  /* ====================================================
     STOP GENERATION
  ==================================================== */

  function stopGeneration() {
    /*
     * Hide thinking immediately when
     * the user presses Stop.
     */
    setIsThinking(false);

    abortRef.current?.abort();
  }


  /* ====================================================
     UI STATE
  ==================================================== */

  const hasMessages =
    messages.length > 0;


  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div className="app-shell">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        open={
          sidebarOpen
        }

        mode={
          mode
        }

        conversations={
          conversations
        }

        activeConversationId={
          conversationId
        }

        search={
          search
        }

        onSearch={
          setSearch
        }

        onClose={() =>
          setSidebarOpen(
            false
          )
        }

        onNewChat={
          newChat
        }

        onMode={
          changeMode
        }

        onOpenConversation={
          openConversation
        }

        onDeleteConversation={
          deleteConversation
        }

        onDeleteAllConversations={
          deleteAllConversations
        }
      />


      {/* =================================================
          MOBILE SIDEBAR BACKDROP
      ================================================= */}

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() =>
            setSidebarOpen(
              false
            )
          }
        />
      )}


      {/* =================================================
          MAIN PANEL
      ================================================= */}

      <main className="main-panel">

        {/* ===============================================
            HEADER
        =============================================== */}

        <header className="chat-header">

          <button
            className="icon-button menu-button"
            aria-label="Open sidebar"
            onClick={() =>
              setSidebarOpen(
                true
              )
            }
          >
            <Menu size={21} />
          </button>


          <div className="header-brand">

            <div className="header-avatar">

              <Image
                src="/medha-avatar.png"
                alt="Medha AI"
                width={40}
                height={40}
                priority
              />

            </div>


            <div>

              <strong>
                Medha AI
              </strong>

              <span>
                {mode ===
                  "assistant"
                  ? "Agentic Intelligence · Web Search · Reasoning"
                  : "Document Intelligence · Grounded AI"}
              </span>

            </div>

          </div>

        </header>


        {/* ===============================================
            RAG MODE
        =============================================== */}

        {mode === "rag" ? (

          <div className="rag-stage">

            <DocumentUpload />

          </div>

        ) : !hasMessages ? (

          /* =============================================
             LANDING PAGE
          ============================================= */

          <section className="landing">

            <div className="hero-avatar">

              <Image
                src="/medha-avatar.png"
                alt="Medha AI"
                width={76}
                height={76}
                priority
              />

            </div>


            <h1>
              Medha AI
            </h1>


            <p className="hero-subtitle">
              Agentic Intelligence Platform
            </p>


            <h2>
              What would you like to explore?
            </h2>


            <QuickActions
              onSelect={(
                display,
                prompt
              ) =>
                void sendMessage(
                  prompt,
                  display
                )
              }
            />

          </section>

        ) : (

          /* =============================================
             CHAT MESSAGES
          ============================================= */

          <MessageList
            messages={
              messages
            }

            /*
             * IMPORTANT:
             *
             * MessageList only needs to know whether
             * we're waiting for the first response text.
             *
             * It no longer receives isGenerating here.
             */
            isGenerating={
              isThinking
            }

            scrollSignal={
              scrollSignal
            }
          />

        )}


        {/* ===============================================
            CHAT INPUT
        =============================================== */}

        {mode ===
          "assistant" && (

            <ChatInput
              /*
               * ChatInput still receives isGenerating.
               *
               * This keeps Stop Generation and duplicate
               * request protection working throughout
               * the entire stream.
               */
              isGenerating={
                isGenerating
              }

              disabled={
                !visitorId
              }

              onSend={(
                text
              ) =>
                void sendMessage(
                  text
                )
              }

              onStop={
                stopGeneration
              }
            />

          )}

      </main>

    </div>
  );
}