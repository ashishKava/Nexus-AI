import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { createWorkspaceEventBodySchema } from "./workspaces.schema.js";
import { AIService } from "../ai/ai.service.js";

const paramsSchema = z.object({
  workspaceId: z.string().uuid("Invalid Workspace ID format"),
});

export async function standaloneWorkspaceRoutes(fastify: FastifyInstance) {
  const aiService = new AIService();

  // Middleware helper to authorize workspace access
  async function authorizeWorkspace(request: FastifyRequest<{ Params: { workspaceId: string } }>) {
    if (!request.user) {
      throw new ForbiddenError("Authentication required");
    }

    const { workspaceId } = request.params;

    // Fetch workspace to determine organization
    const workspace = await fastify.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
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

    return workspace;
  }

  // GET /api/v1/workspaces/:workspaceId
  fastify.get(
    "/:workspaceId",
    {
      schema: {
        params: paramsSchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof paramsSchema> }>, reply: FastifyReply) => {
      const workspace = await authorizeWorkspace(request);
      return reply.send(workspace);
    }
  );

  // POST /api/v1/workspaces/:workspaceId/events
  fastify.post(
    "/:workspaceId/events",
    {
      schema: {
        params: paramsSchema,
        body: createWorkspaceEventBodySchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof paramsSchema>; Body: z.infer<typeof createWorkspaceEventBodySchema> }>, reply: FastifyReply) => {
      const workspace = await authorizeWorkspace(request);
      const { eventType, durationMs, timestamp } = request.body;

      const event = await fastify.prisma.workspaceEvent.create({
        data: {
          workspaceId: workspace.id,
          eventType,
          durationMs,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        },
      });

      return reply.status(201).send(event);
    }
  );

  // GET /api/v1/workspaces/:workspaceId/events
  fastify.get(
    "/:workspaceId/events",
    {
      schema: {
        params: paramsSchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof paramsSchema> }>, reply: FastifyReply) => {
      const workspace = await authorizeWorkspace(request);

      const events = await fastify.prisma.workspaceEvent.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { timestamp: "asc" },
      });

      return reply.send(events);
    }
  );

  // GET /api/v1/workspaces/:workspaceId/analytics
  fastify.get(
    "/:workspaceId/analytics",
    {
      schema: {
        params: paramsSchema,
      },
      preHandler: [fastify.authenticate] as any,
    },
    async (request: FastifyRequest<{ Params: z.infer<typeof paramsSchema> }>, reply: FastifyReply) => {
      const workspace = await authorizeWorkspace(request);

      // Fetch all events for the workspace
      const events = await fastify.prisma.workspaceEvent.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { timestamp: "asc" },
      });

      // If no events exist, return empty report
      if (events.length === 0) {
        return reply.send({
          events: [],
          report: {
            workspaceId: workspace.id,
            totalEvents: 0,
            meanDurationMs: 0.0,
            medianDurationMs: 0.0,
            stdDevDurationMs: 0.0,
            anomalies: [],
          },
        });
      }

      // Map events to format expected by FastAPI (converting Dates to ISO strings)
      const mappedEvents = events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        durationMs: e.durationMs,
        timestamp: e.timestamp.toISOString(),
      }));

      // Call AI service for analytics
      const report = await aiService.getWorkspaceAnalytics(workspace.id, mappedEvents);

      return reply.send({
        events,
        report,
      });
    }
  );
}
