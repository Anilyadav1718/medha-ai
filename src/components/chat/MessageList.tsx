"use client";

import { useEffect, useRef } from "react";

import Message from "@/components/chat/Message";
import ThinkingStatus from "@/components/chat/ThinkingStatus";

import type { Message as ChatMessage } from "@/types/chat";

type MessageListProps = {
  messages: ChatMessage[];
  isGenerating: boolean;
  scrollSignal: number;
  thinkingLabel?: string;
};

export default function MessageList({
  messages,
  isGenerating,
  scrollSignal,
  thinkingLabel = "Medha is thinking...",
}: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  /*
   * Chat.tsx changes scrollSignal only when we intentionally want
   * to move to the latest message: opening a conversation, starting
   * a new request, etc. It is NOT changed for every streamed chunk.
   * That means the user can freely scroll upward while Medha responds.
   */
  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [scrollSignal]);

  return (
    <div ref={viewportRef} className="messages-viewport">
      <div className="messages-inner">
        {messages.map((message) => {
          /*
           * Chat.tsx creates an empty assistant placeholder before
           * the response starts. Do not render an empty assistant row;
           * ThinkingStatus represents that waiting state instead.
           */
          if (message.role === "assistant" && !message.content) {
            return null;
          }

          return <Message key={message.id} message={message} />;
        })}

        {isGenerating && (
          <ThinkingStatus label={thinkingLabel} />
        )}

        <div ref={bottomRef} aria-hidden="true" />
      </div>
    </div>
  );
}
