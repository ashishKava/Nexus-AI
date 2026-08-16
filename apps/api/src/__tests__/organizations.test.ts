import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";

describe("Organizations API", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear organizations and users tables to guarantee test isolation
    await app.prisma.organization.deleteMany({});
    await app.prisma.user.deleteMany({});
  });

  it("should successfully create an organization and assign user as OWNER", async () => {
    // 1. Create a user first
    const userResponse = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: "owner@example.com",
        password: "password123",
        name: "Org Owner",
      },
    });
    const user = JSON.parse(userResponse.payload);

    // 2. Create the organization associated with this user
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Corp",
        slug: "acme-corp",
        userId: user.id,
      },
    });

    expect(response.statusCode).toBe(201);
    const org = JSON.parse(response.payload);
    expect(org).toHaveProperty("id");
    expect(org.name).toBe("Acme Corp");
    expect(org.slug).toBe("acme-corp");

    // 3. Verify organization membership creation using DB check
    const membership = await app.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: org.id,
        },
      },
    });

    expect(membership).not.toBeNull();
    expect(membership.role).toBe("OWNER");
  });

  it("should return 404 Not Found if owner user does not exist", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Ghost Corp",
        slug: "ghost-corp",
        userId: "00000000-0000-0000-0000-000000000000", // Non-existent user UUID
      },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("error", "Not Found");
    expect(body.message).toContain("does not exist");
  });

  it("should return 409 Conflict if organization slug is already in use", async () => {
    // 1. Create a user
    const userResponse = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: "owner@example.com",
        password: "password123",
        name: "Org Owner",
      },
    });
    const user = JSON.parse(userResponse.payload);

    // 2. Create first organization
    await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Corp",
        slug: "acme-corp",
        userId: user.id,
      },
    });

    // 3. Create second organization with same slug
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Second",
        slug: "acme-corp", // duplicate slug
        userId: user.id,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("error", "Conflict");
  });

  it("should return 400 Bad Request if slug contains invalid formatting", async () => {
    // 1. Create a user
    const userResponse = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: "owner@example.com",
        password: "password123",
        name: "Org Owner",
      },
    });
    const user = JSON.parse(userResponse.payload);

    // 2. Attempt organization creation with spaces in slug
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Corp",
        slug: "Acme Corp Slug!", // Invalid slug syntax
        userId: user.id,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("error", "Bad Request");
    expect(body.message).toBe("Validation failed");
    expect(body.details[0].path).toBe("slug");
  });
});
