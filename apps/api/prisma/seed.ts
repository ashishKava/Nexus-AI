import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not defined");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Ensure seed user exists
  const email = "admin@nexus.ai";
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log(`👤 Creating default user: ${email}...`);
    const hashedPassword = await bcrypt.hash("password123", 10);
    user = await prisma.user.create({
      data: {
        email,
        name: "Admin User",
        password: hashedPassword,
      },
    });
  } else {
    console.log(`👤 Default user '${email}' already exists.`);
  }

  // 2. Ensure default organization exists
  const orgSlug = "nexus-ai-org";
  let org = await prisma.organization.findUnique({ where: { slug: orgSlug } });

  if (!org) {
    console.log("🏢 Creating default organization: nexus-ai-org...");
    org = await prisma.organization.create({
      data: {
        name: "Nexus AI Org",
        slug: orgSlug,
      },
    });
  } else {
    console.log(`🏢 Default organization '${orgSlug}' already exists.`);
  }

  // 3. Ensure user is owner of organization
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
  });

  if (!membership) {
    console.log(`🔗 Adding user to organization as OWNER...`);
    await prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "OWNER",
      },
    });
  }

  // 4. Ensure default workspace exists
  const workspaceSlug = "analytics-workspace";
  let workspace = await prisma.workspace.findUnique({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: workspaceSlug,
      },
    },
  });

  if (!workspace) {
    console.log("💻 Creating default workspace: analytics-workspace...");
    workspace = await prisma.workspace.create({
      data: {
        name: "Analytics Workspace",
        slug: workspaceSlug,
        organizationId: org.id,
      },
    });
  } else {
    console.log(`💻 Default workspace '${workspaceSlug}' already exists.`);
  }

  // 5. Seed Workspace Events
  console.log("🧹 Clearing old workspace events...");
  await prisma.workspaceEvent.deleteMany({
    where: { workspaceId: workspace.id },
  });

  console.log("📊 Generating 53 mock workspace events...");
  const eventsData = [];
  const now = new Date();
  
  const eventTypes = ["document_edit", "api_request", "model_inference", "user_login"];

  // A. Generate 50 Normal events (80ms - 220ms)
  for (let i = 0; i < 50; i++) {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    // Clustering around 120ms with some noise
    const durationMs = 80 + Math.random() * 120 + (eventType === "model_inference" ? 50 : 0);
    // Disperse over the last 24 hours
    const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);

    eventsData.push({
      workspaceId: workspace.id,
      eventType,
      durationMs: parseFloat(durationMs.toFixed(2)),
      timestamp,
    });
  }

  // B. Generate 3 Anomalous events (1500ms - 2500ms)
  const anomalyEventTypes = ["api_request", "model_inference"];
  for (let i = 0; i < 3; i++) {
    const eventType = anomalyEventTypes[Math.floor(Math.random() * anomalyEventTypes.length)];
    const durationMs = 1500 + Math.random() * 1000;
    // Spread in the last 12 hours
    const timestamp = new Date(now.getTime() - Math.random() * 12 * 60 * 60 * 1000);

    eventsData.push({
      workspaceId: workspace.id,
      eventType,
      durationMs: parseFloat(durationMs.toFixed(2)),
      timestamp,
    });
  }

  // Insert events
  await prisma.workspaceEvent.createMany({
    data: eventsData,
  });

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
