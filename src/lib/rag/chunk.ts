export type TextChunk = {
    content: string;
    chunkIndex: number;
};

export function chunkText(
    text: string,
    chunkSize = 1200,
    overlap = 200
): TextChunk[] {
    const cleaned = text
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!cleaned) {
        return [];
    }

    const chunks: TextChunk[] = [];

    let start = 0;
    let chunkIndex = 0;

    while (start < cleaned.length) {
        let end = Math.min(start + chunkSize, cleaned.length);

        // Try not to cut directly in the middle of a sentence/paragraph.
        if (end < cleaned.length) {
            const paragraphBreak = cleaned.lastIndexOf("\n\n", end);
            const sentenceBreak = cleaned.lastIndexOf(". ", end);

            const bestBreak = Math.max(paragraphBreak, sentenceBreak);

            if (bestBreak > start + chunkSize * 0.6) {
                end = bestBreak + 1;
            }
        }

        const content = cleaned.slice(start, end).trim();

        if (content) {
            chunks.push({
                content,
                chunkIndex,
            });

            chunkIndex += 1;
        }

        if (end >= cleaned.length) {
            break;
        }

        const nextStart = end - overlap;

        // Safety against an accidental infinite loop.
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}