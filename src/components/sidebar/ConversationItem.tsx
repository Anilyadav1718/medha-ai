"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import type { Conversation } from "@/types/chat";

export default function ConversationItem({
  conversation,
  active,
  onOpen,
  onDelete
}: {
  conversation: Conversation;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`conversation-item ${active ? "active" : ""}`}>
      <button className="conversation-open" onClick={onOpen}>
        <MessageSquare size={16} />
        <span>{conversation.title || "New chat"}</span>
      </button>
      <button
        className="conversation-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete conversation"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
