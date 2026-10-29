import { FastifyInstance, FastifyRequest } from "fastify";
import { DocumentsRepository } from "./documents.repository.js";
import { DocumentsService } from "./documents.service.js";
import { DocumentsController } from "./documents.controller.js";
import { paramsSchema, deleteParamsSchema, ragQueryBodySchema } from "./documents.schema.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { z } from "zod";

export async function documentsRoutes(fastify: FastifyInstance) {
  const repo = new DocumentsRepository(fastify.prisma);
  const service = new DocumentsService(repo);
  const controller = new DocumentsController(service);

  // Authorization helper: ensures user is member of organization that owns the workspace
  async function authorizeWorkspace(request: FastifyRequest<{ Params: { workspaceId: string } }>) {
    if (!request.user) {
      throw new ForbiddenError("Authentication required");
    }

    const { workspaceId } = request.params;

    const workspace = await fastify.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundError(`Workspace with ID '${workspaceId}' not found`);
    }

    // Authorize that the user belongs to the workspace's organization
    const membership = await fastify.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: request.user.id,
          organizationId: workspace.organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of the organization owning this workspace");
    }
  }

  // POST /api/v1/workspaces/:workspaceId/documents
  fastify.post(
    "/",
    {
      schema: {
        params: paramsSchema,
      },
      preHandler: [fastify.authenticate, authorizeWorkspace] as any,
    },
    controller.upload.bind(controller)
  );

  // GET /api/v1/workspaces/:workspaceId/documents
  fastify.get(
    "/",
    {
      schema: {
        params: paramsSchema,
      },
      preHandler: [fastify.authenticate, authorizeWorkspace] as any,
    },
    controller.list.bind(controller)
  );

  // DELETE /api/v1/workspaces/:workspaceId/documents/:documentId
  fastify.delete(
    "/:documentId",
    {
      schema: {
        params: deleteParamsSchema,
      },
      preHandler: [fastify.authenticate, authorizeWorkspace] as any,
    },
    controller.delete.bind(controller)
  );

  // POST /api/v1/workspaces/:workspaceId/documents/query
  fastify.post(
    "/query",
    {
      schema: {
        params: paramsSchema,
        body: ragQueryBodySchema,
      },
      preHandler: [fastify.authenticate, authorizeWorkspace] as any,
    },
    controller.query.bind(controller)
  );
}
