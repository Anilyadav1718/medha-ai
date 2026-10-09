"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export default function ChatInput({
  disabled,
  isGenerating,
  onSend,
  onStop
}: {
  disabled?: boolean;
  isGenerating: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || disabled || isGenerating) return;
    setText("");
    onSend(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="composer-shell">
      <form className="composer" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Medha AI..."
          rows={1}
          disabled={disabled}
        />
        {isGenerating ? (
          <button type="button" className="send-button" onClick={onStop} aria-label="Stop">
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            className="send-button"
            disabled={!text.trim() || disabled}
            aria-label="Send"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </form>
      <p className="composer-note">Medha AI can make mistakes. Verify important information.</p>
    </div>
  );
}
