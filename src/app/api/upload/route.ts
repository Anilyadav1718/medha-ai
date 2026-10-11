import "server-only";
import "pdf-parse/worker";

import { PDFParse } from "pdf-parse";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  chunkText,
} from "@/lib/rag/chunk";

import {
  createDocumentEmbeddings,
  EMBEDDING_MODEL,
} from "@/lib/rag/embeddings";

/* ======================================================
   NEXT.JS CONFIG
====================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ======================================================
   CONFIG
====================================================== */

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const MAX_CHUNKS = 250;

/* ======================================================
   POST — UPLOAD + PROCESS PDF
====================================================== */

export async function POST(
  request: NextRequest
) {
  console.log("");
  console.log(
    "===================================="
  );
  console.log(
    "MEDHA PDF UPLOAD STARTED"
  );
  console.log(
    "===================================="
  );

  let parser: PDFParse | null =
    null;

  let documentId:
    string | null = null;

  try {
    /* ==================================================
       1. READ FORM DATA
    ================================================== */

    const formData =
      await request.formData();

    const fileValue =
      formData.get("file");

    const visitorId =
      String(
        formData.get(
          "visitorId"
        ) || ""
      ).trim();

    /* ==================================================
       2. VALIDATION
    ================================================== */

    if (!visitorId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "visitorId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !fileValue ||
      !(fileValue instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A PDF file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const file = fileValue;

    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only PDF files are supported.",
        },
        {
          status: 400,
        }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The PDF is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PDF must be 10 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "[PDF] File:",
      file.name
    );

    console.log(
      "[PDF] Size:",
      file.size
    );

    /* ==================================================
       3. READ PDF
    ================================================== */

    console.log(
      "[PDF] Reading file..."
    );

    const arrayBuffer =
      await file.arrayBuffer();

    const pdfData =
      new Uint8Array(
        arrayBuffer
      );

    /* ==================================================
       4. EXTRACT TEXT
    ================================================== */

    console.log(
      "[PDF] Extracting text..."
    );

    parser =
      new PDFParse({
        data: pdfData,
      });

    const result =
      await parser.getText();

    const extractedText =
      String(
        result.text || ""
      ).trim();

    console.log(
      "[PDF] Extracted characters:",
      extractedText.length
    );

    if (!extractedText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No readable text was found in this PDF. It may be a scanned or image-only document.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       5. CHUNK DOCUMENT
    ================================================== */

    console.log(
      "[RAG] Creating chunks..."
    );

    const chunks =
      chunkText(
        extractedText,
        1200,
        200
      );

    if (!chunks.length) {
      throw new Error(
        "Unable to create document chunks."
      );
    }

    const finalChunks =
      chunks.slice(
        0,
        MAX_CHUNKS
      );

    console.log(
      "[RAG] Chunks:",
      finalChunks.length
    );

    /* ==================================================
       6. CREATE GEMINI EMBEDDINGS
    ================================================== */

    console.log(
      "[RAG] Creating Gemini embeddings..."
    );

    console.log(
      "[RAG] Embedding model:",
      EMBEDDING_MODEL
    );

    const embeddings =
      await createDocumentEmbeddings(
        finalChunks,
        file.name
      );

    if (
      embeddings.length !==
      finalChunks.length
    ) {
      throw new Error(
        "Embedding count does not match chunk count."
      );
    }

    console.log(
      "[RAG] Gemini embeddings completed."
    );

    /* ==================================================
       7. SUPABASE
    ================================================== */

    const supabase =
      createAdminClient();

    documentId =
      crypto.randomUUID();

    /* ==================================================
       8. SAVE DOCUMENT
    ================================================== */

    console.log(
      "[RAG] Saving document..."
    );

    const {
      error: documentError,
    } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        visitor_id:
          visitorId,
        file_name:
          file.name,
        file_size:
          file.size,
      });

    if (documentError) {
      console.error(
        "[RAG] DOCUMENT ERROR:",
        documentError
      );

      throw new Error(
        documentError.message
      );
    }

    /* ==================================================
       9. BUILD CHUNK ROWS
    ================================================== */

    const chunkRows =
      finalChunks.map(
        (
          content,
          index
        ) => ({
          id:
            crypto.randomUUID(),

          document_id:
            documentId,

          visitor_id:
            visitorId,

          content,

          page_number: 1,

          chunk_index:
            index,

          embedding:
            embeddings[
            index
            ],
        })
      );

    /* ==================================================
       10. SAVE CHUNKS
    ================================================== */

    console.log(
      "[RAG] Saving embeddings to Supabase..."
    );

    const {
      error: chunksError,
    } = await supabase
      .from(
        "document_chunks"
      )
      .insert(
        chunkRows
      );

    if (chunksError) {
      console.error(
        "[RAG] CHUNK ERROR:",
        chunksError
      );

      /*
       * Remove the parent document
       * if chunk storage failed.
       */
      await supabase
        .from("documents")
        .delete()
        .eq(
          "id",
          documentId
        )
        .eq(
          "visitor_id",
          visitorId
        );

      throw new Error(
        chunksError.message
      );
    }

    /* ==================================================
       11. SUCCESS
    ================================================== */

    console.log(
      "===================================="
    );

    console.log(
      "MEDHA PDF UPLOAD COMPLETED"
    );

    console.log(
      "===================================="
    );

    return NextResponse.json(
      {
        success: true,

        document: {
          id:
            documentId,

          fileName:
            file.name,

          fileSize:
            file.size,

          chunks:
            finalChunks.length,

          embeddingModel:
            EMBEDDING_MODEL,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "MEDHA PDF UPLOAD ERROR"
    );

    console.error(
      "===================================="
    );

    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown PDF processing error.";

    return NextResponse.json(
      {
        success: false,
        error:
          `Unable to process PDF: ${message}`,
      },
      {
        status: 500,
      }
    );
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (
      cleanupError
      ) {
        console.warn(
          "[PDF] Cleanup warning:",
          cleanupError
        );
      }
    }
  }
}

/* ======================================================
   DELETE — REMOVE UPLOADED DOCUMENT
====================================================== */

export async function DELETE(
  request: NextRequest
) {
  console.log("");
  console.log(
    "===================================="
  );

  console.log(
    "MEDHA DOCUMENT DELETE STARTED"
  );

  console.log(
    "===================================="
  );

  try {
    /* ==================================================
       1. READ QUERY PARAMETERS
    ================================================== */

    const {
      searchParams,
    } = new URL(
      request.url
    );

    const documentId =
      String(
        searchParams.get(
          "documentId"
        ) || ""
      ).trim();

    const visitorId =
      String(
        searchParams.get(
          "visitorId"
        ) || ""
      ).trim();

    /* ==================================================
       2. VALIDATION
    ================================================== */

    if (!documentId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "documentId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!visitorId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "visitorId is required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "[RAG DELETE] Document:",
      documentId
    );

    /* ==================================================
       3. SUPABASE
    ================================================== */

    const supabase =
      createAdminClient();

    /* ==================================================
       4. VERIFY DOCUMENT
    ================================================== */

    const {
      data: document,
      error:
      documentLookupError,
    } = await supabase
      .from("documents")
      .select("id")
      .eq(
        "id",
        documentId
      )
      .eq(
        "visitor_id",
        visitorId
      )
      .maybeSingle();

    if (
      documentLookupError
    ) {
      console.error(
        "[RAG DELETE] LOOKUP ERROR:",
        documentLookupError
      );

      throw new Error(
        documentLookupError.message
      );
    }

    /*
     * Deletion is idempotent.
     *
     * If the document has already
     * been removed, the UI can still
     * safely reset.
     */

    if (!document) {
      console.log(
        "[RAG DELETE] Document already removed."
      );

      return NextResponse.json(
        {
          success: true,
          deleted: false,
          alreadyDeleted:
            true,
          documentId,
        },
        {
          status: 200,
        }
      );
    }

    /* ==================================================
       5. DELETE CHUNKS
    ================================================== */

    console.log(
      "[RAG DELETE] Deleting chunks..."
    );

    const {
      error:
      chunksDeleteError,
    } = await supabase
      .from(
        "document_chunks"
      )
      .delete()
      .eq(
        "document_id",
        documentId
      )
      .eq(
        "visitor_id",
        visitorId
      );

    if (
      chunksDeleteError
    ) {
      console.error(
        "[RAG DELETE] CHUNK DELETE ERROR:",
        chunksDeleteError
      );

      throw new Error(
        chunksDeleteError.message
      );
    }

    /* ==================================================
       6. DELETE DOCUMENT
    ================================================== */

    console.log(
      "[RAG DELETE] Deleting document record..."
    );

    const {
      error:
      documentDeleteError,
    } = await supabase
      .from("documents")
      .delete()
      .eq(
        "id",
        documentId
      )
      .eq(
        "visitor_id",
        visitorId
      );

    if (
      documentDeleteError
    ) {
      console.error(
        "[RAG DELETE] DOCUMENT DELETE ERROR:",
        documentDeleteError
      );

      throw new Error(
        documentDeleteError.message
      );
    }

    /* ==================================================
       7. SUCCESS
    ================================================== */

    console.log(
      "[RAG DELETE] Deleted:",
      documentId
    );

    console.log(
      "===================================="
    );

    console.log(
      "MEDHA DOCUMENT DELETE COMPLETED"
    );

    console.log(
      "===================================="
    );

    return NextResponse.json(
      {
        success: true,
        deleted: true,
        documentId,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "MEDHA DOCUMENT DELETE ERROR"
    );

    console.error(
      "===================================="
    );

    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown document deletion error.";

    return NextResponse.json(
      {
        success: false,

        error:
          `Unable to delete document: ${message}`,
      },
      {
        status: 500,
      }
    );
  }
}