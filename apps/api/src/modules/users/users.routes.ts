import { FastifyInstance } from "fastify";
import { UserRepository } from "./users.repository.js";
import { UserService } from "./users.service.js";
import { UserController } from "./users.controller.js";
import { createUserBodySchema } from "./users.schema.js";

export async function userRoutes(fastify: FastifyInstance) {
  // Manual Dependency Injection setup for the User Module
  const repository = new UserRepository(fastify.prisma);
  const service = new UserService(repository);
  const controller = new UserController(service);

  // POST /api/v1/users
  fastify.post(
    "/",
    {
      schema: {
        body: createUserBodySchema,
      },
    },
    controller.create.bind(controller)
  );
}
