"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Menu } from "lucide-react";

import ChatInput from "@/components/chat/ChatInput";
import MessageList from "@/components/chat/MessageList";
import QuickActions from "@/components/home/QuickActions";
import Sidebar from "@/components/sidebar/Sidebar";
import DocumentUpload from "@/components/rag/DocumentUpload";

import type { ChatMode, Conversation, Message } from "@/types/chat";
import type { VisionImage } from "@/types/vision";

const NORMAL_THINKING_LABEL = "Medha is thinking...";
const VISION_THINKING_LABEL =
  "Inspecting image · Extracting relevant details...";

function getVisitorId(): string {
  const key = "medha_visitor_id";
  const existing = localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export default function Chat() {
  const [visitorId, setVisitorId] = useState("");
  const [mode, setMode] = useState<ChatMode>("assistant");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");

  // True for the whole request. Used for stop button and send protection.
  const [isGenerating, setIsGenerating] = useState(false);

  // True only until the first real assistant text arrives.
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState(
    NORMAL_THINKING_LABEL
  );

  // Explicit scroll requests only. Do not increment this for every stream chunk.
  const [scrollSignal, setScrollSignal] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = getVisitorId();
    setVisitorId(id);
    void loadConversations(id);
  }, []);

  async function loadConversations(id = visitorId) {
    if (!id) {
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations?visitorId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        console.error("Unable to load conversations.");
        return;
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("LOAD CONVERSATIONS ERROR:", error);
    }
  }

  async function openConversation(id: string) {
    if (!visitorId || isGenerating) {
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations?visitorId=${encodeURIComponent(
          visitorId
        )}&conversationId=${encodeURIComponent(id)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        console.error("Unable to open conversation.");
        return;
      }

      const data = await response.json();

      setConversationId(id);
      conversationIdRef.current = id;
      setMessages(data.messages || []);
      setSidebarOpen(false);
      setIsThinking(false);
      setThinkingLabel(NORMAL_THINKING_LABEL);

      // Opening an old conversation should land on its latest message.
      setScrollSignal((value) => value + 1);
    } catch (error) {
      console.error("OPEN CONVERSATION ERROR:", error);
    }
  }

  async function deleteConversation(id: string) {
    if (!visitorId || isGenerating) {
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations?visitorId=${encodeURIComponent(
          visitorId
        )}&conversationId=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = "Unable to delete conversation.";

        if (raw) {
          try {
            const data = JSON.parse(raw);
            errorMessage = data.error || errorMessage;
          } catch {
            errorMessage = raw;
          }
        }

        throw new Error(errorMessage);
      }

      if (conversationIdRef.current === id) {
        conversationIdRef.current = null;
        setConversationId(null);
        setMessages([]);
        setIsThinking(false);
        setThinkingLabel(NORMAL_THINKING_LABEL);
      }

      setConversations((previous) =>
        previous.filter((conversation) => conversation.id !== id)
      );

      await loadConversations();
    } catch (error) {
      console.error("DELETE CONVERSATION ERROR:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete conversation."
      );
    }
  }

  async function deleteAllConversations() {
    if (!visitorId || isGenerating || conversations.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Delete all conversations? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations?visitorId=${encodeURIComponent(visitorId)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = "Unable to delete all conversations.";

        if (raw) {
          try {
            const data = JSON.parse(raw);
            errorMessage = data.error || errorMessage;
          } catch {
            errorMessage = raw;
          }
        }

        throw new Error(errorMessage);
      }

      conversationIdRef.current = null;
      setConversationId(null);
      setMessages([]);
      setConversations([]);
      setSearch("");
      setMode("assistant");
      setSidebarOpen(false);
      setIsThinking(false);
      setThinkingLabel(NORMAL_THINKING_LABEL);
    } catch (error) {
      console.error("DELETE ALL CONVERSATIONS ERROR:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete all conversations."
      );
    }
  }

  function newChat() {
    abortRef.current?.abort();
    abortRef.current = null;

    conversationIdRef.current = null;
    setConversationId(null);
    setMessages([]);
    setSearch("");
    setMode("assistant");
    setIsGenerating(false);
    setIsThinking(false);
    setThinkingLabel(NORMAL_THINKING_LABEL);
    setScrollSignal((value) => value + 1);
    setSidebarOpen(false);
  }

  function changeMode(nextMode: ChatMode) {
    if (isGenerating) {
      return;
    }

    setMode(nextMode);
    conversationIdRef.current = null;
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
    setIsThinking(false);
    setThinkingLabel(NORMAL_THINKING_LABEL);
  }

  async function sendMessage(
    text: string,
    displayText?: string,
    image?: VisionImage
  ) {
    if (!visitorId || isGenerating || mode !== "assistant") {
      return;
    }

    const cleanText =
      text.trim() || (image ? "Describe and analyze this image." : "");

    if (!cleanText) {
      return;
    }

    const userMessageId = crypto.randomUUID();

    // Visible message never stores raw Base64 image data.
    const visibleContent = image
      ? `${displayText || cleanText}\n\n📷 ${image.name}`
      : displayText || cleanText;

    const visibleUserMessage: Message = {
      id: userMessageId,
      role: "user",
      content: visibleContent,
    };

    // Model history receives only text. Vision image is sent separately.
    const modelUserMessage: Message = {
      id: userMessageId,
      role: "user",
      content: cleanText,
    };

    const historyForModel: Message[] = [...messages, modelUserMessage];

    setMessages((previous) => [...previous, visibleUserMessage]);
    setIsGenerating(true);
    setThinkingLabel(
      image ? VISION_THINKING_LABEL : NORMAL_THINKING_LABEL
    );
    setIsThinking(true);

    // Scroll once for the newly submitted user message.
    // We intentionally do NOT keep forcing scroll during streaming.
    setScrollSignal((value) => value + 1);

    const assistantId = crypto.randomUUID();

    setMessages((previous) => [
      ...previous,
      {
        id: assistantId,
        role: "assistant",
        content: "",
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    const requestStartedAt = performance.now();

    try {
      const endpoint = image ? "/api/vision" : "/api/chat";

      console.log(
        image
          ? "MEDHA FRONTEND: Vision request"
          : "MEDHA FRONTEND: Chat request"
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          visitorId,
          conversationId: conversationIdRef.current,
          messages: historyForModel,
          ...(image ? { image } : {}),
        }),
      });

      if (!response.ok) {
        const raw = await response.text();
        let errorMessage = image
          ? "Vision request failed."
          : "Chat request failed.";

        if (raw) {
          try {
            const data = JSON.parse(raw);
            errorMessage = data.error || errorMessage;
          } catch {
            errorMessage = raw;
          }
        }

        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("The server returned no response stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let metadataProcessed = false;
      let streamedText = "";
      let firstTextReceived = false;

      function applyConversationMetadata(metadataString: string) {
        try {
          const metadata = JSON.parse(metadataString);

          if (metadata.conversationId) {
            const newId = String(metadata.conversationId);
            conversationIdRef.current = newId;
            setConversationId(newId);
            console.log("Medha conversation ID:", newId);
          }
        } catch (metadataError) {
          console.error("METADATA PARSE ERROR:", metadataError);
        }
      }

      function renderChunk(chunkText: string) {
        if (!chunkText) {
          return;
        }

        if (!firstTextReceived && chunkText.trim()) {
          firstTextReceived = true;
          setIsThinking(false);

          const ttft = (performance.now() - requestStartedAt) / 1000;

          console.log(
            image
              ? `Vision frontend TTFT: ${ttft.toFixed(2)}s`
              : `Chat frontend TTFT: ${ttft.toFixed(2)}s`
          );
        }

        streamedText += chunkText;

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: streamedText,
                }
              : message
          )
        );

        // IMPORTANT:
        // Do not increment scrollSignal here.
        // Doing it for every chunk forces the viewport back to the bottom
        // and prevents the user from scrolling upward while Medha responds.
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        if (!metadataProcessed) {
          const prefix = "__MEDHA_META__";

          if (buffer.startsWith(prefix)) {
            const newlineIndex = buffer.indexOf("\n");

            if (newlineIndex === -1) {
              continue;
            }

            const metadataString = buffer.slice(
              prefix.length,
              newlineIndex
            );

            applyConversationMetadata(metadataString);

            buffer = buffer.slice(newlineIndex + 1);
            metadataProcessed = true;
          } else if (prefix.startsWith(buffer)) {
            // Partial metadata prefix. Wait for the next network chunk.
            continue;
          } else {
            // Safety fallback for plain-text responses.
            metadataProcessed = true;
          }
        }

        if (metadataProcessed && buffer) {
          const chunkText = buffer;
          buffer = "";
          renderChunk(chunkText);
        }
      }

      if (!metadataProcessed && buffer) {
        const prefix = "__MEDHA_META__";

        if (buffer.startsWith(prefix)) {
          const newlineIndex = buffer.indexOf("\n");

          if (newlineIndex !== -1) {
            const metadataString = buffer.slice(
              prefix.length,
              newlineIndex
            );

            applyConversationMetadata(metadataString);
            buffer = buffer.slice(newlineIndex + 1);
            metadataProcessed = true;
          }
        } else {
          metadataProcessed = true;
        }
      }

      if (metadataProcessed && buffer) {
        renderChunk(buffer);
        buffer = "";
      }

      if (!streamedText.trim()) {
        setIsThinking(false);

        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: "Medha generated an empty response. Please try again.",
                }
              : message
          )
        );
      }

      await loadConversations();
    } catch (error) {
      setIsThinking(false);

      if (error instanceof Error && error.name === "AbortError") {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantId && !message.content
              ? {
                  ...message,
                  content: "Generation stopped.",
                }
              : message
          )
        );

        return;
      }

      console.error(
        image
          ? "MEDHA FRONTEND VISION ERROR:"
          : "MEDHA FRONTEND CHAT ERROR:",
        error
      );

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Medha AI ran into a temporary problem. Please try again.";

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: errorMessage,
              }
            : message
        )
      );
    } finally {
      abortRef.current = null;
      setIsThinking(false);
      setThinkingLabel(NORMAL_THINKING_LABEL);
      setIsGenerating(false);

      // No forced final scroll here. If the user scrolled upward while
      // reading, their position is preserved.
    }
  }

  function stopGeneration() {
    setIsThinking(false);
    setThinkingLabel(NORMAL_THINKING_LABEL);
    abortRef.current?.abort();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        mode={mode}
        conversations={conversations}
        activeConversationId={conversationId}
        search={search}
        onSearch={setSearch}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onMode={changeMode}
        onOpenConversation={openConversation}
        onDeleteConversation={deleteConversation}
        onDeleteAllConversations={deleteAllConversations}
      />

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-panel">
        <header className="chat-header">
          <button
            className="icon-button menu-button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
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
              <strong>Medha AI</strong>
              <span>
                {mode === "assistant"
                  ? "Agentic Intelligence · Web Search · Reasoning"
                  : "Document Intelligence · Grounded AI"}
              </span>
            </div>
          </div>
        </header>

        {mode === "rag" ? (
          <div className="rag-stage">
            <DocumentUpload />
          </div>
        ) : !hasMessages ? (
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

            <h1>Medha AI</h1>
            <p className="hero-subtitle">Agentic Intelligence Platform</p>
            <h2>What would you like to explore?</h2>

            <QuickActions
              onSelect={(display, prompt) =>
                void sendMessage(prompt, display)
              }
            />
          </section>
        ) : (
          <MessageList
            messages={messages}
            isGenerating={isThinking}
            thinkingLabel={thinkingLabel}
            scrollSignal={scrollSignal}
          />
        )}

        {mode === "assistant" && (
          <ChatInput
            isGenerating={isGenerating}
            disabled={!visitorId}
            onSend={(text, image) =>
              void sendMessage(text, undefined, image)
            }
            onStop={stopGeneration}
          />
        )}
      </main>
    </div>
  );
}
