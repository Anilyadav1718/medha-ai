export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 200;

export function chunkText(
    text: string,
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_CHUNK_OVERLAP
): string[] {
    const cleaned = text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!cleaned) {
        return [];
    }

    if (chunkSize <= 0) {
        throw new Error(
            "Chunk size must be greater than 0."
        );
    }

    if (
        overlap < 0 ||
        overlap >= chunkSize
    ) {
        throw new Error(
            "Chunk overlap must be >= 0 and smaller than chunk size."
        );
    }

    const chunks: string[] = [];

    let start = 0;

    while (start < cleaned.length) {
        let end = Math.min(
            start + chunkSize,
            cleaned.length
        );

        /*
         * Avoid cutting in the middle of a word
         * or sentence when possible.
         */
        if (end < cleaned.length) {
            const searchStart = Math.max(
                start,
                end - 250
            );

            const section =
                cleaned.slice(
                    searchStart,
                    end
                );

            const paragraphBreak =
                section.lastIndexOf("\n\n");

            const sentenceBreak =
                Math.max(
                    section.lastIndexOf(". "),
                    section.lastIndexOf("? "),
                    section.lastIndexOf("! ")
                );

            const spaceBreak =
                section.lastIndexOf(" ");

            const bestBreak =
                paragraphBreak >= 0
                    ? paragraphBreak + 2
                    : sentenceBreak >= 0
                        ? sentenceBreak + 2
                        : spaceBreak >= 0
                            ? spaceBreak + 1
                            : -1;

            if (bestBreak > 0) {
                end =
                    searchStart +
                    bestBreak;
            }
        }

        const chunk =
            cleaned
                .slice(start, end)
                .trim();

        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= cleaned.length) {
            break;
        }

        const nextStart =
            end - overlap;

        /*
         * Safety check to prevent
         * accidental infinite loops.
         */
        start =
            nextStart > start
                ? nextStart
                : end;
    }

    return chunks;
}