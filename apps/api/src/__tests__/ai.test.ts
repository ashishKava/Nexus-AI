import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildApp } from "../app.js";

describe("AI API & FastAPI Integration", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear DB tables
    await app.prisma.workspace.deleteMany({});
    await app.prisma.organizationMember.deleteMany({});
    await app.prisma.organization.deleteMany({});
    await app.prisma.user.deleteMany({});
    
    vi.restoreAllMocks();
  });

  // Helper function to register and get a token
  async function getAuthContext(email: string) {
    const signupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "securepassword123",
        name: "AI Test User",
      },
    });
    const { user, token } = JSON.parse(signupResponse.payload);
    return { user, token };
  }

  it("should fail analytics if request is unauthorized (no token)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/analytics",
      payload: {
        workspaceId: "00000000-0000-0000-0000-000000000000",
        events: [{ eventType: "click", durationMs: 10, timestamp: "2026-08-16T12:00:00Z" }]
      }
    });

    expect(response.statusCode).toBe(401);
  });

  it("should return 404 Not Found if the workspace does not exist", async () => {
    const { token } = await getAuthContext("user@example.com");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/analytics",
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: {
        workspaceId: "00000000-0000-0000-0000-000000000000", // random non-existent UUID
        events: [{ eventType: "click", durationMs: 10, timestamp: "2026-08-16T12:00:00Z" }]
      }
    });

    expect(response.statusCode).toBe(404);
  });

  it("should return 403 Forbidden if the user is not a member of the workspace organization", async () => {
    const { token: tokenA } = await getAuthContext("user-a@example.com");
    const { user: userB, token: tokenB } = await getAuthContext("user-b@example.com");

    // 1. User B creates organization B
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        name: "Org B",
        slug: "org-b",
        userId: userB.id
      }
    });
    const org = JSON.parse(orgResponse.payload);

    // 2. User B creates workspace B
    const wsResponse = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        name: "Workspace B",
        slug: "ws-b"
      }
    });
    const workspace = JSON.parse(wsResponse.payload);

    // 3. User A tries to run analytics on Workspace B
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/analytics",
      headers: {
        Authorization: `Bearer ${tokenA}`
      },
      payload: {
        workspaceId: workspace.id,
        events: [{ eventType: "click", durationMs: 10, timestamp: "2026-08-16T12:00:00Z" }]
      }
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.payload);
    expect(body.message).toContain("owning this workspace");
  });

  it("should successfully return analytics report from microservice on valid inputs", async () => {
    const { user, token } = await getAuthContext("user@example.com");

    // 1. Create Organization
    const orgResponse = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "My Org",
        slug: "my-org",
        userId: user.id
      }
    });
    const org = JSON.parse(orgResponse.payload);

    // 2. Create Workspace
    const wsResponse = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "My Workspace",
        slug: "my-ws"
      }
    });
    const workspace = JSON.parse(wsResponse.payload);

    // 3. Mock FastAPI Python service response
    const mockReport = {
      workspaceId: workspace.id,
      totalEvents: 4,
      meanDurationMs: 113.25,
      medianDurationMs: 52.5,
      stdDevDurationMs: 108.06,
      anomalies: [
        { eventType: "heavy_query", durationMs: 300, timestamp: "2026-08-16T12:03:00.000Z", zScore: 2.1 }
      ]
    };

    const spyFetch = vi.spyOn(global, "fetch").mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(mockReport)),
        json: () => Promise.resolve(mockReport),
      } as any);
    });

    // 4. Request analytics
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/analytics",
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: {
        workspaceId: workspace.id,
        events: [
          { eventType: "search", durationMs: 50, timestamp: "2026-08-16T12:00:00Z" },
          { eventType: "search", durationMs: 55, timestamp: "2026-08-16T12:01:00Z" },
          { eventType: "search", durationMs: 48, timestamp: "2026-08-16T12:02:00Z" },
          { eventType: "heavy_query", durationMs: 300, timestamp: "2026-08-16T12:03:00Z" }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.workspaceId).toBe(workspace.id);
    expect(body.totalEvents).toBe(4);
    expect(body.anomalies[0].eventType).toBe("heavy_query");

    expect(spyFetch).toHaveBeenCalledTimes(1);
    const fetchArgs = spyFetch.mock.calls[0];
    expect(fetchArgs[0]).toContain("/analytics");
  });
});
