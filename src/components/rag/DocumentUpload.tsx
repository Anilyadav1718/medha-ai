"use client";

import Image from "next/image";

import {
  ArrowUp,
  CheckCircle2,
  FileText,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* =========================================================
   TYPES
========================================================= */

type UploadedDocument = {
  id: string;
  fileName: string;
  fileSize: number;
  chunks: number;
};

type RagMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  document?: UploadedDocument;
};

type RagResponse = {
  success?: boolean;
  error?: string;
  answer?: string;
};

type DeleteResponse = {
  success?: boolean;
  error?: string;
  deleted?: boolean;
  alreadyDeleted?: boolean;
  documentId?: string;
};

/* =========================================================
   CONFIG
========================================================= */

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

/* =========================================================
   HELPERS
========================================================= */

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

/*
 * Safely read API responses.
 *
 * This prevents errors such as:
 *
 * Unexpected end of JSON input
 *
 * when a route/proxy/server returns
 * an empty or non-JSON response.
 */

async function readJsonSafely<T>(
  response: Response,
  requestName: string
): Promise<T> {
  const responseText =
    await response.text();

  if (!responseText.trim()) {
    throw new Error(
      `${requestName} returned an empty response (${response.status}).`
    );
  }

  try {
    return JSON.parse(
      responseText
    ) as T;
  } catch {
    console.error(
      `[MEDHA RAG] Invalid ${requestName} response:`,
      responseText
    );

    throw new Error(
      `${requestName} returned an invalid response (${response.status}).`
    );
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function DocumentUpload() {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [
    visitorId,
    setVisitorId,
  ] = useState("");

  const [
    isDragging,
    setIsDragging,
  ] = useState(false);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    isAsking,
    setIsAsking,
  ] = useState(false);

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    uploadedDocument,
    setUploadedDocument,
  ] =
    useState<UploadedDocument | null>(
      null
    );

  const [
    question,
    setQuestion,
  ] = useState("");

  const [
    messages,
    setMessages,
  ] =
    useState<RagMessage[]>(
      []
    );

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     VISITOR IDENTITY
  ======================================================= */

  useEffect(() => {
    const storageKey =
      "medha_visitor_id";

    let existingVisitorId =
      localStorage.getItem(
        storageKey
      );

    if (!existingVisitorId) {
      existingVisitorId =
        crypto.randomUUID();

      localStorage.setItem(
        storageKey,
        existingVisitorId
      );
    }

    setVisitorId(
      existingVisitorId
    );
  }, []);

  /* =======================================================
     SCROLL DOCUMENT CONVERSATION
  ======================================================= */

  useEffect(() => {
    if (
      messages.length === 0
    ) {
      return;
    }

    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "nearest",
      }
    );
  }, [
    messages,
    isAsking,
  ]);

  /* =======================================================
     VALIDATE PDF
  ======================================================= */

  function validateFile(
    file: File
  ) {
    const isPdf =
      file.type ===
      "application/pdf" ||
      file.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!isPdf) {
      return "Only PDF documents are supported.";
    }

    if (
      file.size === 0
    ) {
      return "This PDF is empty.";
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return "PDF must be smaller than 10 MB.";
    }

    return null;
  }

  /* =======================================================
     UPLOAD PDF
  ======================================================= */

  async function uploadFile(
    file: File
  ) {
    const validationError =
      validateFile(file);

    if (validationError) {
      setError(
        validationError
      );

      setSelectedFile(
        null
      );

      return;
    }

    if (!visitorId) {
      setError(
        "Medha is still initializing. Please try again."
      );

      return;
    }

    setError("");

    setSelectedFile(
      file
    );

    setUploadedDocument(
      null
    );

    setMessages([]);

    setQuestion("");

    setIsUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "visitorId",
        visitorId
      );

      const response =
        await fetch(
          "/api/upload",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await readJsonSafely<UploadResponse>(
          response,
          "Document upload"
        );

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to process this document."
        );
      }

      if (!data.document) {
        throw new Error(
          data.error ||
          "Medha did not receive document information."
        );
      }

      setUploadedDocument(
        data.document
      );

      console.log(
        "[MEDHA RAG] Document uploaded:",
        data.document
      );
    } catch (
    uploadError
    ) {
      console.error(
        "[MEDHA RAG] Upload failed:",
        uploadError
      );

      setUploadedDocument(
        null
      );

      setError(
        uploadError instanceof
          Error
          ? uploadError.message
          : "Document upload failed."
      );
    } finally {
      setIsUploading(
        false
      );
    }
  }

  /* =======================================================
     BROWSER FILE SELECTION
  ======================================================= */

  function handleFileInput(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (file) {
      void uploadFile(
        file
      );
    }

    /*
     * Reset the native input so the
     * same PDF can be selected again.
     */
    event.target.value =
      "";
  }

  /* =======================================================
     DRAG ENTER
  ======================================================= */

  function handleDragEnter(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!isUploading) {
      setIsDragging(
        true
      );
    }
  }

  /* =======================================================
     DRAG OVER
  ======================================================= */

  function handleDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!isUploading) {
      setIsDragging(
        true
      );
    }
  }

  /* =======================================================
     DRAG LEAVE
  ======================================================= */

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget =
      event.currentTarget;

    const relatedTarget =
      event.relatedTarget as
      | Node
      | null;

    if (
      relatedTarget &&
      currentTarget.contains(
        relatedTarget
      )
    ) {
      return;
    }

    setIsDragging(
      false
    );
  }

  /* =======================================================
     DROP PDF
  ======================================================= */

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(
      false
    );

    if (isUploading) {
      return;
    }

    const file =
      event.dataTransfer
        .files?.[0];

    if (file) {
      void uploadFile(
        file
      );
    }
  }

  /* =======================================================
     ASK DOCUMENT
  ======================================================= */

  async function askDocument(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    const cleanQuestion =
      question.trim();

    if (
      !cleanQuestion ||
      !uploadedDocument ||
      !visitorId ||
      isAsking
    ) {
      return;
    }

    const userMessage: RagMessage =
    {
      id:
        crypto.randomUUID(),

      role:
        "user",

      content:
        cleanQuestion,
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );

    setQuestion("");

    setError("");

    setIsAsking(true);

    try {
      const response =
        await fetch(
          "/api/rag",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  question:
                    cleanQuestion,

                  documentId:
                    uploadedDocument.id,

                  visitorId,
                }
              ),
          }
        );

      const data =
        await readJsonSafely<RagResponse>(
          response,
          "Document question"
        );

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to answer from this document."
        );
      }

      const assistantMessage: RagMessage =
      {
        id:
          crypto.randomUUID(),

        role:
          "assistant",

        content:
          data.answer ||
          "I couldn't find an answer in this document.",
      };

      setMessages(
        (current) => [
          ...current,
          assistantMessage,
        ]
      );
    } catch (
    askError
    ) {
      console.error(
        "[MEDHA RAG] Question failed:",
        askError
      );

      setError(
        askError instanceof
          Error
          ? askError.message
          : "Unable to answer from this document."
      );
    } finally {
      setIsAsking(
        false
      );
    }
  }

  /* =======================================================
     REMOVE DOCUMENT
  ======================================================= */

  async function resetDocument() {
    if (
      isUploading ||
      isAsking ||
      !uploadedDocument ||
      !visitorId
    ) {
      return;
    }

    const documentToDelete =
      uploadedDocument;

    setError("");

    try {
      const response =
        await fetch(
          `/api/upload?documentId=${encodeURIComponent(
            documentToDelete.id
          )}&visitorId=${encodeURIComponent(
            visitorId
          )}`,
          {
            method:
              "DELETE",

            cache:
              "no-store",
          }
        );

      /*
       * Read as text first instead of
       * calling response.json()
       * directly.
       */

      const responseText =
        await response.text();

      let data: DeleteResponse =
        {};

      /*
       * Parse only if the server
       * actually returned a body.
       */

      if (
        responseText.trim()
      ) {
        try {
          data =
            JSON.parse(
              responseText
            ) as DeleteResponse;
        } catch {
          console.error(
            "[MEDHA RAG] Invalid delete response:",
            responseText
          );

          throw new Error(
            `Document delete returned an invalid response (${response.status}).`
          );
        }
      }

      /*
       * Handle HTTP errors.
       */

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Unable to delete document (${response.status}).`
        );
      }

      /*
       * A successful endpoint should
       * normally return success=true.
       *
       * If the body is empty but HTTP
       * status is successful, we don't
       * trigger JSON parsing errors.
       */

      if (
        responseText.trim() &&
        data.success ===
        false
      ) {
        throw new Error(
          data.error ||
          "Unable to delete document."
        );
      }

      console.log(
        "[MEDHA RAG] Document deleted:",
        documentToDelete.id
      );

      /*
       * Clear local document state.
       */

      setSelectedFile(
        null
      );

      setUploadedDocument(
        null
      );

      setMessages([]);

      setQuestion("");

      setError("");

      if (
        inputRef.current
      ) {
        inputRef.current.value =
          "";
      }
    } catch (
    deleteError
    ) {
      console.error(
        "[MEDHA RAG] Document delete failed:",
        deleteError
      );

      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : "Unable to delete document."
      );
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="rag-card">

      {/* ================================================
          HEADING
      ================================================ */}

      <div className="rag-heading-icon">
        <FileUp
          size={30}
        />
      </div>

      <h2>
        Document Intelligence
      </h2>

      <p className="rag-description">
        Upload a PDF and Medha
        will understand its
        contents so you can ask
        questions about the
        document.
      </p>

      {/* ================================================
          UPLOAD
      ================================================ */}

      {!uploadedDocument ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={
              handleFileInput
            }
            className="rag-file-input"
            disabled={
              isUploading
            }
          />

          <div
            className={`rag-drop-zone ${isDragging
              ? "dragging"
              : ""
              } ${isUploading
                ? "uploading"
                : ""
              }`}
            onDragEnter={
              handleDragEnter
            }
            onDragOver={
              handleDragOver
            }
            onDragLeave={
              handleDragLeave
            }
            onDrop={
              handleDrop
            }
            onClick={() => {
              if (
                !isUploading
              ) {
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(
              event
            ) => {
              if (
                !isUploading &&
                (
                  event.key ===
                  "Enter" ||
                  event.key ===
                  " "
                )
              ) {
                event.preventDefault();

                inputRef.current?.click();
              }
            }}
          >
            {isUploading ? (
              <>
                <Loader2
                  className="rag-spinner"
                  size={34}
                />

                <strong>
                  Understanding your
                  document...
                </strong>

                <span>
                  Extracting text and
                  creating embeddings.
                </span>

                {selectedFile && (
                  <small>
                    {
                      selectedFile.name
                    }
                  </small>
                )}
              </>
            ) : (
              <>
                <Upload
                  size={34}
                />

                <strong>
                  {isDragging
                    ? "Drop your PDF here"
                    : "Drag & drop your PDF"}
                </strong>

                <span>
                  or{" "}
                  <b>
                    click to browse
                  </b>
                </span>

                <small>
                  PDF only · Maximum
                  10 MB
                </small>
              </>
            )}
          </div>
        </>
      ) : (
        <>

          {/* ============================================
              DOCUMENT READY
          ============================================ */}

          <div className="rag-document-ready">

            <div className="rag-document-icon">
              <FileText
                size={25}
              />
            </div>

            <div className="rag-document-details">

              <div className="rag-ready-label">
                <CheckCircle2
                  size={16}
                />

                <span>
                  Document ready
                </span>
              </div>

              <strong>
                {
                  uploadedDocument.fileName
                }
              </strong>

              <span>
                {formatFileSize(
                  uploadedDocument.fileSize
                )}

                {" · "}

                {
                  uploadedDocument.chunks
                }{" "}
                knowledge chunks
              </span>
            </div>

            <button
              type="button"
              className="rag-remove-button"
              onClick={
                resetDocument
              }
              disabled={
                isAsking ||
                isUploading
              }
              title="Change document"
              aria-label="Change document"
            >
              <X
                size={18}
                strokeWidth={2}
              />
            </button>
          </div>

          {/* ============================================
              RAG CHAT
          ============================================ */}

          <div className="rag-chat">

            {messages.length ===
              0 ? (
              <div className="rag-empty-chat">

                <strong>
                  Ask about this
                  document
                </strong>

                <span>
                  Medha will answer
                  using the uploaded
                  PDF as its source.
                </span>

                <div className="rag-suggestions">

                  <button
                    type="button"
                    disabled={
                      isAsking
                    }
                    onClick={() =>
                      setQuestion(
                        "Summarize this document."
                      )
                    }
                  >
                    Summarize this
                    document
                  </button>

                  <button
                    type="button"
                    disabled={
                      isAsking
                    }
                    onClick={() =>
                      setQuestion(
                        "What are the key points in this document?"
                      )
                    }
                  >
                    Key points
                  </button>

                </div>
              </div>
            ) : (
              <div className="rag-messages">

                {messages.map(
                  (
                    message
                  ) => (
                    <div
                      key={
                        message.id
                      }
                      className={`rag-message-row ${message.role ===
                        "user"
                        ? "rag-user-row"
                        : "rag-assistant-row"
                        }`}
                    >

                      {message.role ===
                        "assistant" && (
                          <div className="rag-medha-avatar">
                            <Image
                              src="/medha-avatar.png"
                              alt="Medha AI"
                              width={30}
                              height={30}
                            />
                          </div>
                        )}

                      <div
                        className={
                          message.role ===
                            "user"
                            ? "rag-user-message"
                            : "rag-assistant-message markdown-body"
                        }
                      >
                        {message.role ===
                          "assistant" ? (
                          <ReactMarkdown
                            remarkPlugins={[
                              remarkGfm,
                            ]}
                          >
                            {
                              message.content
                            }
                          </ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>
                  )
                )}

                {/* ======================================
                    THINKING
                ====================================== */}

                {isAsking && (
                  <div className="rag-message-row rag-assistant-row">

                    <div className="rag-medha-avatar">
                      <Image
                        src="/medha-avatar.png"
                        alt="Medha AI"
                        width={30}
                        height={30}
                      />
                    </div>

                    <div className="rag-thinking">
                      <Loader2
                        size={15}
                        className="rag-spinner"
                      />

                      <span>
                        Reading the
                        document...
                      </span>
                    </div>

                  </div>
                )}

                <div
                  ref={
                    messagesEndRef
                  }
                />
              </div>
            )}

            {/* ============================================
                RAG INPUT
            ============================================ */}

            <form
              className="rag-question-form"
              onSubmit={
                askDocument
              }
            >
              <textarea
                value={
                  question
                }
                onChange={(
                  event
                ) =>
                  setQuestion(
                    event.target
                      .value
                  )
                }
                placeholder="Ask anything about this PDF..."
                rows={1}
                disabled={
                  isAsking
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();

                    if (
                      question.trim() &&
                      !isAsking
                    ) {
                      event.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
              />

              {/* ========================================
                  WHITE ARROW SEND BUTTON
              ======================================== */}

              <button
                type="submit"
                className={`rag-send-button ${question.trim() &&
                  !isAsking
                  ? "rag-send-button-active"
                  : ""
                  }`}
                disabled={
                  !question.trim() ||
                  isAsking
                }
                title="Ask Medha AI"
                aria-label="Ask Medha AI"
              >
                {isAsking ? (
                  <Loader2
                    size={19}
                    strokeWidth={
                      2.5
                    }
                    className="rag-spinner"
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

            </form>
          </div>
        </>
      )}

      {/* ================================================
          ERROR
      ================================================ */}

      {error && (
        <div className="rag-error">
          {error}
        </div>
      )}
    </div>
  );
}