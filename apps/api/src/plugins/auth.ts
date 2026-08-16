import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

// Module augmentations for JWT payload shape
declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
    };
  }
}

// Module augmentations for FastifyInstance to include authenticate hook
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }

  // Register fastify-jwt
  fastify.register(fastifyJwt, {
    secret: secret || "nexus-dev-secret-key-change-in-production-123456",
  });

  // Define the authenticate decorator to protect routes
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Return 401 Unauthorized using the payload from jwtVerify error
      return reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: err instanceof Error ? err.message : "Unauthorized access",
      });
    }
  });
};

export default fp(authPlugin, {
  name: "auth",
});
