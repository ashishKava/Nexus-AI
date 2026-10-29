import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";

describe("Standalone Workspaces & Events API", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear databases
    await app.prisma.workspaceEvent.deleteMany({});
    await app.prisma.workspace.deleteMany({});
    await app.prisma.organizationMember.deleteMany({});
    await app.prisma.organization.deleteMany({});
    await app.prisma.user.deleteMany({});
  });

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

  it("should fail retrieving workspace if not authenticated", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/workspaces/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(401);
  });

  it("should fail retrieving workspace if user is not in organization owning it", async () => {
    const { user: userA } = await getAuthContext("user-a@example.com");
    const { token: tokenB } = await getAuthContext("user-b@example.com");

    // User A creates organization and workspace
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Org A",
        slug: "org-a",
        userId: userA.id,
      },
    });
    const org = JSON.parse(orgResponse.payload);

    // Create workspace for User A
    const prismaWorkspace = await app.prisma.workspace.create({
      data: {
        name: "Workspace A",
        slug: "ws-a",
        organizationId: org.id,
      },
    });

    // User B tries to access Workspace A
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${prismaWorkspace.id}`,
      headers: {
        authorization: `Bearer ${tokenB}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("should successfully log, retrieve events, and run analytics for an authorized user", async () => {
    const { user, token } = await getAuthContext("owner@example.com");

    // 1. Create organization
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: {
        name: "Org A",
        slug: "org-a",
        userId: user.id,
      },
    });
    const org = JSON.parse(orgResponse.payload);

    // 2. Create workspace
    const workspace = await app.prisma.workspace.create({
      data: {
        name: "Workspace A",
        slug: "ws-a",
        organizationId: org.id,
      },
    });

    // 3. Create a workspace event via API
    const postResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspace.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        eventType: "api_request",
        durationMs: 120.5,
      },
    });

    expect(postResponse.statusCode).toBe(201);
    const event = JSON.parse(postResponse.payload);
    expect(event.eventType).toBe("api_request");
    expect(event.durationMs).toBe(120.5);

    // 4. Retrieve workspace events via API
    const getEventsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspace.id}/events`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(getEventsResponse.statusCode).toBe(200);
    const events = JSON.parse(getEventsResponse.payload);
    expect(events.length).toBe(1);
    expect(events[0].id).toBe(event.id);

    // 5. Retrieve analytics via API
    // Note: We need at least 1 event. Since FastAPI is mocked/running, let's verify standard responses.
    const analyticsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspace.id}/analytics`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(analyticsResponse.statusCode).toBe(200);
    const result = JSON.parse(analyticsResponse.payload);
    expect(result.events.length).toBe(1);
    expect(result.report).toBeDefined();
    expect(result.report.workspaceId).toBe(workspace.id);
  });
});
