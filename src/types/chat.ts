export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  created_at?: string;
  tools?: unknown[];
  sources?: unknown[];
  metrics?: Record<string, unknown>;
};

export type Conversation = {
  id: string;
  visitor_id: string;
  title: string;
  mode: "assistant" | "rag";
  document_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ChatMode = "assistant" | "rag";
