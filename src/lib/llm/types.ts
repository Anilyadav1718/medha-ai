export type LLMProviderName =
    | "gemini"
    | "groq";


export type LLMStream =
    AsyncIterable<string>;


export type LLMResult = {
    stream: LLMStream;
};


export type ProviderHealth = {
    available: boolean;

    blockedUntil: number;

    lastError?: string;
};