import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { ZodError } from "zod";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import rbacPlugin from "./plugins/rbac.js";
import { AppError } from "./utils/errors.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { organizationRoutes } from "./modules/organizations/organizations.routes.js";
import { workspaceRoutes } from "./modules/workspaces/workspaces.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Schema Validator & Serializer Compilers for Zod
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security Headers and CORS configuration
  app.register(helmet);
  app.register(cors, {
    origin: true, // Allow all origins in dev, customize for production
    credentials: true,
  });

  // Database Connection Plugin
  app.register(prismaPlugin);

  // Authentication Plugin
  app.register(authPlugin);

  // Role-Based Access Control Plugin
  app.register(rbacPlugin);

  // Health Endpoint (checks database health too)
  app.get("/health", async (request, reply) => {
    try {
      // Execute a simple check query on database
      await app.prisma.$executeRawUnsafe("SELECT 1;");
      
      return {
        status: "ok",
        service: "nexus-api",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (dbError) {
      app.log.error(dbError, "Database health check failed");
      return reply.status(503).send({
        status: "error",
        service: "nexus-api",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API Routes Versioning Group v1
  app.register(async (v1) => {
    v1.register(authRoutes, { prefix: "/auth" });
    v1.register(userRoutes, { prefix: "/users" });
    v1.register(organizationRoutes, { prefix: "/organizations" });
    v1.register(workspaceRoutes, { prefix: "/organizations/:orgId/workspaces" });
    v1.register(aiRoutes, { prefix: "/ai" });
  }, { prefix: "/api/v1" });

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    // 1. Zod Validation Error handling
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Validation failed",
        details: error.validation.map((err: any) => ({
          path: (err.params?.issue?.path?.join(".") || err.instancePath || "unknown").replace(/^\//, ""),
          message: err.message,
        })),
      });
    }

    // 2. Custom Application Errors (AppError)
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.error,
        message: error.message,
      });
    }

    // 3. Prisma unique constraint violation (duplicate key)
    if ((error as any).code === "P2002") {
      const targets = (error as any).meta?.target || [];
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: `A resource with this '${targets.join(", ")}' already exists.`,
      });
    }

    // 4. Default Internal Server Error
    request.log.error(error);
    return reply.status(500).send({
      statusCode: 500,
      error: "Internal Server Error",
      message: "An unexpected error occurred on the server.",
    });
  });

  return app;
}
