import { FastifyInstance } from "fastify";
import { WorkspaceRepository } from "./workspaces.repository.js";
import { WorkspaceService } from "./workspaces.service.js";
import { WorkspaceController } from "./workspaces.controller.js";
import { createWorkspaceBodySchema } from "./workspaces.schema.js";
import { z } from "zod";

export async function workspaceRoutes(fastify: FastifyInstance) {
  // Dependency injection setup
  const repo = new WorkspaceRepository(fastify.prisma);
  const service = new WorkspaceService(repo);
  const controller = new WorkspaceController(service);

  // POST /api/v1/organizations/:orgId/workspaces
  fastify.post(
    "/",
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid("Invalid Organization ID format"),
        }),
        body: createWorkspaceBodySchema,
      },
      // Middleware execution pipeline: Auth -> RBAC authorization
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgMember(["OWNER", "ADMIN"]),
      ] as any,
    },
    controller.create.bind(controller)
  );

  // GET /api/v1/organizations/:orgId/workspaces
  fastify.get(
    "/",
    {
      schema: {
        params: z.object({
          orgId: z.string().uuid("Invalid Organization ID format"),
        }),
      },
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgMember(),
      ] as any,
    },
    controller.list.bind(controller)
  );
}
