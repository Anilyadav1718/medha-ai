"use client";

import { useEffect, useRef } from "react";
import Message from "@/components/chat/Message";
import ThinkingStatus from "@/components/chat/ThinkingStatus";
import type { Message as MessageType } from "@/types/chat";

export default function MessageList({
  messages,
  isGenerating,
  scrollSignal
}: {
  messages: MessageType[];
  isGenerating: boolean;
  scrollSignal: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    // Auto-scroll only if the user is already near the latest message.
    // Manual upward scrolling is never fought.
    if (distanceFromBottom < 220 || scrollSignal > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [scrollSignal]);

  return (
    <div className="messages-viewport" ref={viewportRef}>
      <div className="messages-inner">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {isGenerating && <ThinkingStatus />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
