import { pipeline } from "@huggingface/transformers";

let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
    if (!embeddingPipeline) {
        console.log("[RAG] Loading embedding model...");

        embeddingPipeline = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2",
            {
                dtype: "fp32",
            }
        );

        console.log("[RAG] Embedding model loaded.");
    }

    return embeddingPipeline;
}

export async function createEmbedding(text: string): Promise<number[]> {
    const cleanText = text.trim();

    if (!cleanText) {
        throw new Error("Cannot create an embedding for empty text.");
    }

    const extractor = await getEmbeddingPipeline();

    const output = await extractor(cleanText, {
        pooling: "mean",
        normalize: true,
    });

    const embedding = Array.from(output.data) as number[];

    if (embedding.length !== 384) {
        throw new Error(
            `Unexpected embedding dimension: ${embedding.length}. Expected 384.`
        );
    }

    return embedding;
}