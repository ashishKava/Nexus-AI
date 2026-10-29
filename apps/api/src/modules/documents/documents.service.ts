import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DocumentsRepository } from "./documents.repository.js";
import { NotFoundError, AppError } from "../../utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store uploads in a folder at the project root level
const UPLOADS_DIR = path.join(__dirname, "../../../uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class DocumentsService {
  private aiServiceUrl: string;

  constructor(private documentsRepo: DocumentsRepository) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
  }

  async uploadDocument(workspaceId: string, filename: string, fileStream: NodeJS.ReadableStream, mimeType: string) {
    const fileId = crypto.randomUUID();
    const safeFilename = `${fileId}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const filePath = path.join(UPLOADS_DIR, safeFilename);

    // 1. Write file to disk
    const writeStream = fs.createWriteStream(filePath);
    await new Promise<void>((resolve, reject) => {
      fileStream.pipe(writeStream);
      fileStream.on("error", (err) => reject(err));
      writeStream.on("finish", () => resolve());
      writeStream.on("error", (err) => reject(err));
    });

    // 2. Create document record in database
    const document = await this.documentsRepo.create({
      name: filename,
      url: filePath,
      mimeType,
      workspaceId,
    });

    // 3. Extract text content (Support text-based files)
    let extractedText = "";
    try {
      extractedText = fs.readFileSync(filePath, "utf-8");
    } catch (readErr: any) {
      // Clean up file if text extraction fails
      fs.unlinkSync(filePath);
      await this.documentsRepo.delete(document.id);
      throw new AppError(400, "Unprocessable Document", `Could not read text content from uploaded file: ${readErr.message}`);
    }

    // 4. Ingest text content into the Python AI RAG service
    try {
      const response = await fetch(`${this.aiServiceUrl}/rag/ingest?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: document.id,
          documentName: document.name,
          text: extractedText,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI RAG engine error: ${errorText}`);
      }
    } catch (ingestError: any) {
      // Fallback/Warning: Clean up local database/file if RAG ingestion fails,
      // or warn user. Let's fail fast to maintain consistency.
      fs.unlinkSync(filePath);
      await this.documentsRepo.delete(document.id);
      throw new AppError(502, "AI Engine Ingestion Failure", `Failed to index document in the AI vector store: ${ingestError.message}`);
    }

    return document;
  }

  async listDocuments(workspaceId: string) {
    return this.documentsRepo.findByWorkspaceId(workspaceId);
  }

  async deleteDocument(workspaceId: string, documentId: string) {
    const document = await this.documentsRepo.findById(documentId);
    if (!document || document.workspaceId !== workspaceId) {
      throw new NotFoundError(`Document with ID '${documentId}' not found in this workspace`);
    }

    // 1. Delete from database
    await this.documentsRepo.delete(documentId);

    // 2. Delete file from local storage
    if (fs.existsSync(document.url)) {
      try {
        fs.unlinkSync(document.url);
      } catch (err) {
        console.error(`Failed to delete local file at ${document.url}:`, err);
      }
    }

    // 3. Clear embeddings in Python AI RAG service
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/rag/document?workspace_id=${workspaceId}&document_id=${documentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        console.warn(`Failed to delete document embeddings from RAG index for ID: ${documentId}`);
      }
    } catch (err) {
      console.error(`Failed to connect to AI engine during document deletion for ID: ${documentId}`, err);
    }

    return { success: true };
  }

  async queryWorkspaceKnowledge(workspaceId: string, query: string) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/rag/query?workspace_id=${workspaceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI RAG engine query error: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      throw new AppError(502, "AI Engine Communication Failure", `Failed to complete RAG search: ${error.message}`);
    }
  }
}
