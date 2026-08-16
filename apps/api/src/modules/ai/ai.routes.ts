import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { WorkspaceRepository } from "../workspaces/workspaces.repository.js";
import { AIService } from "./ai.service.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";

const workspaceEventSchema = z.object({
  eventType: z.string(),
  durationMs: z.number(),
  timestamp: z.string().datetime(),
});

const getAnalyticsBodySchema = z.object({
  workspaceId: z.string().uuid("Invalid Workspace ID format"),
  events: z.array(workspaceEventSchema).min(1, "At least one event is required to run analytics"),
});

export async function aiRoutes(fastify: FastifyInstance) {
  const workspaceRepo = new WorkspaceRepository(fastify.prisma);
  const aiService = new AIService();

  // POST /api/v1/ai/analytics
  fastify.post(
    "/analytics",
    {
      schema: {
        body: getAnalyticsBodySchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof getAnalyticsBodySchema> }>, reply: FastifyReply) => {
      const { workspaceId, events } = request.body;

      // 1. Fetch workspace to determine organization owner
      const workspace = await workspaceRepo.findById(workspaceId);
      if (!workspace) {
        throw new NotFoundError(`Workspace with ID '${workspaceId}' not found`);
      }

      // 2. Authorize that the user belongs to the workspace's organization
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

      // 3. Request analytics report from FastAPI
      const report = await aiService.getWorkspaceAnalytics(workspaceId, events);

      return reply.send(report);
    }
  );
}
