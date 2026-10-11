"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from "react";

import {
  ArrowUp,
  ImagePlus,
  Square,
  X,
} from "lucide-react";

import type {
  VisionImage,
  VisionMimeType,
} from "@/types/vision";

type ChatInputProps = {
  onSend: (
    text: string,
    image?: VisionImage
  ) => void;

  onStop?: () => void;

  isGenerating?: boolean;

  disabled?: boolean;
};

type SelectedImage = {
  payload: VisionImage;
  previewUrl: string;
};

const MAX_IMAGE_SIZE =
  2.5 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function readAsDataUrl(
  file: File
): Promise<string> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () => {
          if (
            typeof reader.result ===
            "string"
          ) {
            resolve(
              reader.result
            );

            return;
          }

          reject(
            new Error(
              "Unable to read image."
            )
          );
        };

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read image."
            )
          );

      reader.readAsDataURL(
        file
      );
    }
  );
}

export default function ChatInput({
  onSend,
  onStop,
  isGenerating = false,
  disabled = false,
}: ChatInputProps) {
  const [
    value,
    setValue,
  ] =
    useState("");

  const [
    selectedImage,
    setSelectedImage,
  ] =
    useState<
      SelectedImage | null
    >(null);

  const [
    imageError,
    setImageError,
  ] =
    useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const hasText =
    value.trim().length >
    0;

  const hasImage =
    Boolean(
      selectedImage
    );

  const canSend =
    (
      hasText ||
      hasImage
    ) &&
    !disabled &&
    !isGenerating;

  /* =====================================================
     SELECT IMAGE
  ===================================================== */

  async function handleImageChange(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    setImageError("");

    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      setImageError(
        "Use a PNG, JPEG or WebP image."
      );

      return;
    }

    if (
      file.size >
      MAX_IMAGE_SIZE
    ) {
      setImageError(
        "Image must be 2.5 MB or smaller."
      );

      return;
    }

    try {
      const dataUrl =
        await readAsDataUrl(
          file
        );

      const commaIndex =
        dataUrl.indexOf(
          ","
        );

      if (
        commaIndex === -1
      ) {
        throw new Error(
          "Invalid image data."
        );
      }

      const base64 =
        dataUrl.slice(
          commaIndex + 1
        );

      setSelectedImage({
        previewUrl:
          dataUrl,

        payload: {
          name:
            file.name,

          mimeType:
            file.type as
            VisionMimeType,

          data:
            base64,
        },
      });
    } catch (
    error
    ) {
      console.error(
        "IMAGE READ ERROR:",
        error
      );

      setImageError(
        "Unable to read this image."
      );
    }
  }

  /* =====================================================
     REMOVE IMAGE
  ===================================================== */

  function removeImage() {
    setSelectedImage(
      null
    );

    setImageError("");
  }

  /* =====================================================
     SEND
  ===================================================== */

  function sendMessage() {
    if (
      disabled ||
      isGenerating
    ) {
      return;
    }

    const image =
      selectedImage
        ?.payload;

    let cleanText =
      value.trim();

    /*
     * Allow image-only requests.
     */

    if (
      !cleanText &&
      image
    ) {
      cleanText =
        "Describe and analyze this image.";
    }

    if (
      !cleanText
    ) {
      return;
    }

    setValue("");

    setSelectedImage(
      null
    );

    setImageError("");

    onSend(
      cleanText,
      image
    );
  }

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    sendMessage();
  }

  function handleKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (
      event.key ===
      "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      sendMessage();
    }
  }

  function handleButtonClick() {
    if (
      isGenerating
    ) {
      onStop?.();

      return;
    }

    sendMessage();
  }

  return (
    <div className="medha-composer-area">

      <form
        className="medha-composer"
        onSubmit={
          handleSubmit
        }
      >

        {/* ==============================================
            IMAGE PREVIEW
        ============================================== */}

        {selectedImage && (
          <div className="medha-image-preview">

            <img
              src={
                selectedImage.previewUrl
              }
              alt="Selected image"
            />

            <div className="medha-image-preview-info">
              <strong>
                {
                  selectedImage
                    .payload
                    .name
                }
              </strong>

              <span>
                Ready for Medha Vision
              </span>
            </div>

            <button
              type="button"
              className="medha-image-remove"
              onClick={
                removeImage
              }
              disabled={
                isGenerating
              }
              aria-label="Remove image"
              title="Remove image"
            >
              <X
                size={16}
              />
            </button>

          </div>
        )}

        {/* ==============================================
            INPUT ROW
        ============================================== */}

        <div className="medha-composer-row">

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="medha-image-file-input"
            onChange={
              handleImageChange
            }
            disabled={
              disabled ||
              isGenerating
            }
          />

          <button
            type="button"
            className="medha-image-button"
            onClick={() =>
              fileInputRef
                .current
                ?.click()
            }
            disabled={
              disabled ||
              isGenerating
            }
            aria-label="Add image"
            title="Add image"
          >
            <ImagePlus
              size={21}
              strokeWidth={
                2.2
              }
            />
          </button>

          <textarea
            className="medha-composer-textarea"
            value={
              value
            }
            onChange={(
              event
            ) =>
              setValue(
                event.target
                  .value
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder={
              selectedImage
                ? "Ask Medha about this image..."
                : "Message Medha AI..."
            }
            rows={1}
            disabled={
              disabled
            }
            aria-label="Message Medha AI"
          />

          <button
            type="button"
            className={[
              "medha-send-button",

              isGenerating
                ? "medha-stop-button"
                : "",

              canSend
                ? "medha-send-button-active"
                : "",
            ]
              .filter(
                Boolean
              )
              .join(" ")}
            onClick={
              handleButtonClick
            }
            disabled={
              disabled ||
              (
                !isGenerating &&
                !hasText &&
                !hasImage
              )
            }
            aria-label={
              isGenerating
                ? "Stop generating"
                : "Send message"
            }
            title={
              isGenerating
                ? "Stop"
                : "Send"
            }
          >
            {isGenerating ? (
              <Square
                size={17}
                strokeWidth={
                  2.8
                }
                fill="currentColor"
              />
            ) : (
              <ArrowUp
                size={22}
                strokeWidth={
                  3
                }
              />
            )}
          </button>

        </div>
      </form>

      {imageError && (
        <div className="medha-image-error">
          {imageError}
        </div>
      )}

      <div className="medha-composer-hint">
        Medha AI can make mistakes. Check important information.
      </div>
    </div>
  );
}