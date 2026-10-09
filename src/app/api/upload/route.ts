import "pdf-parse/worker";

import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/rag/chunk";
import { createEmbedding } from "@/lib/rag/embeddings";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  console.log("");
  console.log("====================================");
  console.log("MEDHA PDF UPLOAD STARTED");
  console.log("====================================");

  let documentId: string | null = null;

  try {
    // --------------------------------------------------------
    // 1. Read multipart form data
    // --------------------------------------------------------

    const formData = await request.formData();

    const file = formData.get("file");
    const visitorId = formData.get("visitorId");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Please select a PDF file." },
        { status: 400 }
      );
    }

    if (typeof visitorId !== "string" || !visitorId.trim()) {
      return Response.json(
        { error: "Visitor ID is required." },
        { status: 400 }
      );
    }

    console.log("File:", file.name);
    console.log("Size:", file.size);
    console.log("Type:", file.type);

    // --------------------------------------------------------
    // 2. Validate PDF
    // --------------------------------------------------------

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return Response.json(
        { error: "Only PDF documents are supported." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return Response.json(
        { error: "The uploaded PDF is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "PDF must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 3. Convert browser File -> Buffer
    // --------------------------------------------------------

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("PDF loaded into memory.");

    // --------------------------------------------------------
    // 4. Extract PDF text
    // --------------------------------------------------------

    console.log("Extracting PDF text...");

    const parser = new PDFParse({
      data: buffer,
    });

    let extracted;

    try {
      extracted = await parser.getText();
    } finally {
      await parser.destroy();
    }

    const pdfText = extracted.text?.trim() ?? "";

    console.log("Extracted characters:", pdfText.length);

    if (!pdfText) {
      return Response.json(
        {
          error:
            "No readable text was found in this PDF. Scanned/image-only PDFs are not supported yet.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 5. Split document into chunks
    // --------------------------------------------------------

    const chunks = chunkText(pdfText);

    console.log("Chunks created:", chunks.length);

    if (chunks.length === 0) {
      return Response.json(
        { error: "Unable to create chunks from this document." },
        { status: 400 }
      );
    }

    // Protect Vercel from extremely large processing jobs.
    if (chunks.length > 150) {
      return Response.json(
        {
          error:
            "This PDF contains too much text for the current document limit. Please upload a smaller document.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 6. Create document record
    // --------------------------------------------------------

    const supabase = createAdminClient();

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        visitor_id: visitorId.trim(),
        file_name: file.name,
        file_size: file.size,
      })
      .select("id")
      .single();

    if (documentError || !document) {
      console.error("Document insert error:", documentError);

      throw new Error(
        documentError?.message || "Unable to create document record."
      );
    }

    documentId = document.id;

    console.log("Document ID:", documentId);

    // --------------------------------------------------------
    // 7. Generate embeddings
    // --------------------------------------------------------

    console.log("Generating embeddings...");

    const rows = [];

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];

      console.log(
        `Embedding chunk ${index + 1}/${chunks.length}`
      );

      const embedding = await createEmbedding(chunk.content);

      rows.push({
        document_id: documentId,
        visitor_id: visitorId.trim(),
        content: chunk.content,
        page_number: null,
        chunk_index: chunk.chunkIndex,
        embedding,
      });
    }

    console.log("Embeddings generated:", rows.length);

    // --------------------------------------------------------
    // 8. Save chunks + vectors to Supabase
    // --------------------------------------------------------

    const BATCH_SIZE = 25;

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      const batch = rows.slice(start, start + BATCH_SIZE);

      const { error: chunkError } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (chunkError) {
        console.error("Chunk insert error:", chunkError);
        throw new Error(chunkError.message);
      }
    }

    console.log("Document chunks saved successfully.");

    console.log("====================================");
    console.log("MEDHA PDF UPLOAD COMPLETED");
    console.log("====================================");
    console.log("");

    // --------------------------------------------------------
    // 9. Return document information
    // --------------------------------------------------------

    return Response.json({
      success: true,
      document: {
        id: documentId,
        fileName: file.name,
        fileSize: file.size,
        chunks: chunks.length,
      },
    });
  } catch (error) {
    console.error("");
    console.error("====================================");
    console.error("MEDHA PDF UPLOAD ERROR");
    console.error("====================================");

    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error(error);
    }

    // If document creation succeeded but something later failed,
    // remove it. ON DELETE CASCADE removes any inserted chunks.
    if (documentId) {
      try {
        const supabase = createAdminClient();

        await supabase
          .from("documents")
          .delete()
          .eq("id", documentId);

        console.log("Incomplete document cleaned up:", documentId);
      } catch (cleanupError) {
        console.error("Document cleanup failed:", cleanupError);
      }
    }

    console.error("====================================");
    console.error("");

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Document processing failed.",
      },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE DOCUMENT
// ============================================================

export async function DELETE(request: Request) {
  console.log("");
  console.log("====================================");
  console.log("MEDHA DOCUMENT DELETE STARTED");
  console.log("====================================");

  try {
    const { searchParams } = new URL(request.url);

    const documentId = searchParams.get("documentId")?.trim();
    const visitorId = searchParams.get("visitorId")?.trim();

    if (!documentId) {
      return Response.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    if (!visitorId) {
      return Response.json(
        { error: "Visitor ID is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify that this document belongs to this visitor.
    const { data: document, error: verifyError } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("id", documentId)
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (verifyError) {
      console.error(
        "Document verification error:",
        verifyError
      );

      throw new Error(verifyError.message);
    }

    if (!document) {
      return Response.json(
        {
          error:
            "Document not found or it does not belong to this visitor.",
        },
        { status: 404 }
      );
    }

    console.log("Deleting document:", document.file_name);
    console.log("Document ID:", document.id);

    // document_chunks are automatically removed because
    // document_chunks.document_id uses ON DELETE CASCADE.
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("visitor_id", visitorId);

    if (deleteError) {
      console.error(
        "Document delete error:",
        deleteError
      );

      throw new Error(deleteError.message);
    }

    console.log("Document deleted successfully.");
    console.log("Associated chunks deleted by cascade.");

    console.log("====================================");
    console.log("MEDHA DOCUMENT DELETE COMPLETED");
    console.log("====================================");
    console.log("");

    return Response.json({
      success: true,
      documentId,
    });
  } catch (error) {
    console.error("");
    console.error("====================================");
    console.error("MEDHA DOCUMENT DELETE ERROR");
    console.error("====================================");

    if (error instanceof Error) {
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    } else {
      console.error(error);
    }

    console.error("====================================");
    console.error("");

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete document.",
      },
      { status: 500 }
    );
  }
}