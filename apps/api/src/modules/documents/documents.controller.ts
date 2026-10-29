import { FastifyReply, FastifyRequest } from "fastify";
import { DocumentsService } from "./documents.service.js";
import { RAGQueryBody } from "./documents.schema.js";
import { BadRequestError } from "../../utils/errors.js";

export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  async upload(
    request: FastifyRequest<{ Params: { workspaceId: string } }>,
    reply: FastifyReply
  ) {
    // fastify-multipart exposes request.file() to retrieve single file
    const data = await request.file();
    
    if (!data) {
      throw new BadRequestError("No file uploaded. Please upload a document using multipart form-data.");
    }

    const { file, filename, mimetype } = data;

    const document = await this.documentsService.uploadDocument(
      request.params.workspaceId,
      filename,
      file,
      mimetype
    );

    return reply.status(201).send(document);
  }

  async list(
    request: FastifyRequest<{ Params: { workspaceId: string } }>,
    reply: FastifyReply
  ) {
    const documents = await this.documentsService.listDocuments(request.params.workspaceId);
    return reply.send(documents);
  }

  async delete(
    request: FastifyRequest<{ Params: { workspaceId: string; documentId: string } }>,
    reply: FastifyReply
  ) {
    const result = await this.documentsService.deleteDocument(
      request.params.workspaceId,
      request.params.documentId
    );
    return reply.send(result);
  }

  async query(
    request: FastifyRequest<{ Params: { workspaceId: string }; Body: RAGQueryBody }>,
    reply: FastifyReply
  ) {
    const result = await this.documentsService.queryWorkspaceKnowledge(
      request.params.workspaceId,
      request.body.query
    );
    return reply.send(result);
  }
}
