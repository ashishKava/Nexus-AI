import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Module augmentation to add prisma client to FastifyInstance type definition
declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not defined");
  }

  // Create a pg Pool for PostgreSQL connections
  const pool = new pg.Pool({ connectionString });

  // Wrap pg Pool in PrismaPg driver adapter for Prisma 7 compatibility
  const adapter = new PrismaPg(pool);

  // Instantiate the client with logging enabled
  const prisma = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "info" },
      { emit: "stdout", level: "warn" },
      { emit: "stdout", level: "error" },
    ],
  });

  // Connect on startup (failing fast if connection cannot be established)
  try {
    await prisma.$connect();
    fastify.log.info("Database connection established successfully via PrismaPg adapter.");
  } catch (error) {
    fastify.log.error(error, "Failed to connect to database during startup");
    await pool.end();
    throw error;
  }

  // Log queries if required
  if (process.env.NODE_ENV !== "production") {
    // Log queries in development
    (prisma as any).$on("query", (e: any) => {
      fastify.log.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, "Prisma Query");
    });
  }

  // Decorate fastify instance
  fastify.decorate("prisma", prisma);

  // Graceful shutdown hooks
  fastify.addHook("onClose", async (instance) => {
    instance.log.info("Closing Prisma connection...");
    await instance.prisma.$disconnect();
    await pool.end();
    instance.log.info("Prisma and pg Pool connections closed gracefully.");
  });
};

export default fp(prismaPlugin, {
  name: "prisma",
});
