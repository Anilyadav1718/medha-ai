import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is missing.");
  if (!client) client = new Groq({ apiKey });
  return client;
}

export const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-120b";
