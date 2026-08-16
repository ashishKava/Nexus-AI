import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import { OrganizationRole } from "@prisma/client";

describe("Workspaces & RBAC API", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear databases to ensure isolation
    await app.prisma.workspace.deleteMany({});
    await app.prisma.organizationMember.deleteMany({});
    await app.prisma.organization.deleteMany({});
    await app.prisma.user.deleteMany({});
  });

  // Helper function to register and get a token
  async function getAuthContext(email: string) {
    const signupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "securepassword123",
        name: "Test User",
      },
    });

    const { user, token } = JSON.parse(signupResponse.payload);
    return { user, token };
  }

  it("should fail workspace creation if unauthorized (no token)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/00000000-0000-0000-0000-000000000000/workspaces",
      payload: {
        name: "Dev Workspace",
        slug: "dev",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("should fail workspace creation if user is not in organization", async () => {
    const { token } = await getAuthContext("outsider@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/00000000-0000-0000-0000-000000000000/workspaces",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Dev Workspace",
        slug: "dev",
      },
    });

    // Returns 403 Forbidden because user is not a member of the target organization
    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain("not a member of this organization");
  });

  it("should successfully create a workspace if user is OWNER", async () => {
    const { user, token } = await getAuthContext("owner@example.com");

    // 1. Create organization where this user is Owner
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Owner Organization",
        slug: "owner-org",
        userId: user.id,
      },
    });
    const org = JSON.parse(orgResponse.payload);

    // 2. Create workspace inside this organization using owner's token
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Dev Workspace",
        slug: "dev",
      },
    });

    expect(response.statusCode).toBe(201);
    const workspace = JSON.parse(response.payload);
    expect(workspace).toHaveProperty("id");
    expect(workspace.name).toBe("Dev Workspace");
    expect(workspace.slug).toBe("dev");
    expect(workspace.organizationId).toBe(org.id);
  });

  it("should fail workspace creation if user is MEMBER (RBAC checks)", async () => {
    // 1. Create org owner
    const { user: owner } = await getAuthContext("owner@example.com");

    // 2. Create organization
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Shared Organization",
        slug: "shared-org",
        userId: owner.id,
      },
    });
    const org = JSON.parse(orgResponse.payload);

    // 3. Create another user who will be registered as a standard MEMBER
    const { user: memberUser, token: memberToken } = await getAuthContext("member@example.com");

    await app.prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: memberUser.id,
        role: OrganizationRole.MEMBER, // Assign standard MEMBER role
      },
    });

    // 4. Try to create a workspace as MEMBER (Only OWNER/ADMIN allowed)
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        name: "Member Workspace",
        slug: "member-space",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain("Insufficient permissions");
  });

  it("should successfully list workspaces for members of the organization", async () => {
    const { user, token } = await getAuthContext("owner@example.com");

    // Create organization
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Acme Group",
        slug: "acme-group",
        userId: user.id,
      },
    });
    const org = JSON.parse(orgResponse.payload);

    // Create two workspaces directly in DB
    await app.prisma.workspace.create({
      data: { name: "Design Room", slug: "design", organizationId: org.id },
    });
    await app.prisma.workspace.create({
      data: { name: "Code Room", slug: "code", organizationId: org.id },
    });

    // List workspaces using user token
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const list = JSON.parse(response.payload);
    expect(list.length).toBe(2);
    expect(list[0].slug).toBe("design");
    expect(list[1].slug).toBe("code");
  });
});
