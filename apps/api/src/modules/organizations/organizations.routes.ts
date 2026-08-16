import { FastifyInstance } from "fastify";
import { OrganizationRepository } from "./organizations.repository.js";
import { UserRepository } from "../users/users.repository.js";
import { OrganizationService } from "./organizations.service.js";
import { OrganizationController } from "./organizations.controller.js";
import { createOrganizationBodySchema } from "./organizations.schema.js";
import { z } from "zod";

export async function organizationRoutes(fastify: FastifyInstance) {
  // Wire dependencies
  const userRepo = new UserRepository(fastify.prisma);
  const orgRepo = new OrganizationRepository(fastify.prisma);
  const service = new OrganizationService(orgRepo, userRepo);
  const controller = new OrganizationController(service);

  // POST /api/v1/organizations
  fastify.post(
    "/",
    {
      schema: {
        body: createOrganizationBodySchema,
      },
    },
    controller.create.bind(controller)
  );

  // GET /api/v1/organizations
  fastify.get(
    "/",
    {
      schema: {
        querystring: z.object({
          userId: z.string().uuid("Invalid User ID format"),
        }),
      },
      preHandler: [fastify.authenticate] as any,
    },
    controller.list.bind(controller)
  );

  // GET /api/v1/organizations/:id
  fastify.get(
    "/:id",
    {
      schema: {
        params: z.object({
          id: z.string().uuid("Invalid ID format"),
        }),
      },
    },
    controller.getById.bind(controller)
  );
}
