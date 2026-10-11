export type VisionMimeType =
    | "image/jpeg"
    | "image/png"
    | "image/webp";

export type VisionImage = {
    name: string;
    mimeType: VisionMimeType;

    /*
     * Raw Base64 only.
     *
     * Do NOT include:
     *
     * data:image/png;base64,
     */
    data: string;
};