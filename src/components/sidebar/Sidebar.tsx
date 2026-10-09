"use client";

import Image from "next/image";

import {
  FileText,
  MessageCircle,
  PanelLeftClose,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import ConversationItem from "@/components/sidebar/ConversationItem";

import type {
  ChatMode,
  Conversation,
} from "@/types/chat";


export default function Sidebar({
  open,
  mode,
  conversations,
  activeConversationId,
  search,
  onSearch,
  onClose,
  onNewChat,
  onMode,
  onOpenConversation,
  onDeleteConversation,
  onDeleteAllConversations,
}: {
  open: boolean;

  mode: ChatMode;

  conversations: Conversation[];

  activeConversationId:
  string | null;

  search: string;

  onSearch:
  (value: string) => void;

  onClose:
  () => void;

  onNewChat:
  () => void;

  onMode:
  (mode: ChatMode) => void;

  onOpenConversation:
  (id: string) => void;

  onDeleteConversation:
  (id: string) => void;

  onDeleteAllConversations:
  () => void;
}) {

  const filtered =
    conversations.filter(
      (item) =>
        (
          item.title || ""
        )
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );


  return (
    <aside
      className={`sidebar ${open ? "open" : ""
        }`}
    >

      {/* ===============================================
          BRAND
      =============================================== */}

      <div className="sidebar-top">

        <div className="brand">

          <div className="brand-avatar">

            <Image
              src="/medha-avatar.png"
              alt="Medha AI"
              width={42}
              height={42}
            />

          </div>


          <div>

            <strong>
              Medha AI
            </strong>

            <span>
              Agentic Intelligence
            </span>

          </div>

        </div>


        <button
          className="icon-button mobile-only"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <PanelLeftClose
            size={20}
          />
        </button>

      </div>


      {/* ===============================================
          NEW CHAT
      =============================================== */}

      <button
        className="new-chat"
        onClick={onNewChat}
      >

        <Plus size={18} />

        New chat

      </button>


      {/* ===============================================
          SEARCH
      =============================================== */}

      <div className="sidebar-search">

        <Search size={16} />

        <input
          value={search}
          onChange={(event) =>
            onSearch(
              event.target.value
            )
          }
          placeholder="Search conversations"
        />

      </div>


      {/* ===============================================
          AI MODES
      =============================================== */}

      <p className="sidebar-label">
        AI Modes
      </p>


      <button
        className={`mode-button ${mode === "assistant"
          ? "active"
          : ""
          }`}
        onClick={() =>
          onMode("assistant")
        }
      >

        <MessageCircle
          size={18}
        />

        AI Assistant

      </button>


      <button
        className={`mode-button ${mode === "rag"
          ? "active"
          : ""
          }`}
        onClick={() =>
          onMode("rag")
        }
      >

        <FileText size={18} />

        Document RAG

      </button>


      <div className="sidebar-divider" />


      {/* ===============================================
          RECENTS HEADER
      =============================================== */}

      <div className="recents-header">

        <p className="sidebar-label">
          Recents
        </p>


        {conversations.length >
          0 && (

            <button
              className="delete-all-button"
              onClick={
                onDeleteAllConversations
              }
              title="Delete all conversations"
              aria-label="Delete all conversations"
            >

              <Trash2 size={15} />

              <span>
                Clear all
              </span>

            </button>

          )}

      </div>


      {/* ===============================================
          CONVERSATIONS
      =============================================== */}

      <div className="conversation-list">

        {filtered.length ? (

          filtered.map(
            (
              conversation
            ) => (

              <ConversationItem
                key={
                  conversation.id
                }
                conversation={
                  conversation
                }
                active={
                  activeConversationId ===
                  conversation.id
                }
                onOpen={() =>
                  onOpenConversation(
                    conversation.id
                  )
                }
                onDelete={() =>
                  onDeleteConversation(
                    conversation.id
                  )
                }
              />

            )
          )

        ) : (

          <p className="empty-recents">
            {search
              ? "No matching conversations."
              : "No conversations yet."}
          </p>

        )}

      </div>

    </aside>
  );
}