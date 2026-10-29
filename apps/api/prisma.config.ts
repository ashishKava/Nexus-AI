import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://nexus:nexus_password@localhost:5432/nexus?schema=public",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
