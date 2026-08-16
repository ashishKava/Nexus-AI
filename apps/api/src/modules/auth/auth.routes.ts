import { FastifyInstance } from "fastify";
import { UserRepository } from "../users/users.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthController } from "./auth.controller.js";
import { signupBodySchema, loginBodySchema } from "./auth.schema.js";

export async function authRoutes(fastify: FastifyInstance) {
  const userRepo = new UserRepository(fastify.prisma);
  const authService = new AuthService(userRepo);
  const controller = new AuthController(authService);

  // POST /api/v1/auth/signup
  fastify.post(
    "/signup",
    {
      schema: {
        body: signupBodySchema,
      },
    },
    controller.signup.bind(controller)
  );

  // POST /api/v1/auth/login
  fastify.post(
    "/login",
    {
      schema: {
        body: loginBodySchema,
      },
    },
    controller.login.bind(controller)
  );
}
