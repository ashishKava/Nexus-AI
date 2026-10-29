import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildApp } from "../app.js";

describe("Chatbot Agent & Tools API", () => {
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

  async function getAuthContext(email: string) {
    const signupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email,
        password: "securepassword123",
        name: "Agent Tester",
      },
    });
    const { user, token } = JSON.parse(signupResponse.payload);
    return { user, token };
  }

  async function setupWorkspace(token: string, userId: string) {
    const orgRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "Developer Org",
        slug: "dev-org",
        userId,
      },
    });
    const org = JSON.parse(orgRes.payload);

    const wsRes = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "Primary Workspace",
        slug: "primary-ws",
      },
    });
    const workspace = JSON.parse(wsRes.payload);
    return { org, workspace };
  }

  it("should return a standard chatbot response (Fallback keyless flow)", async () => {
    const { user, token } = await getAuthContext("fallback@example.com");
    const { org, workspace } = await setupWorkspace(token, user.id);

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/chat",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        message: "Hello chatbot",
        organizationId: org.id,
        workspaceId: workspace.id,
      },
    });

    expect(chatResponse.statusCode).toBe(200);
    const body = JSON.parse(chatResponse.payload);
    expect(body.response).toContain("Mock AI Assistant");
  });

  it("should trigger workspace creation tool via fallback flow", async () => {
    const { user, token } = await getAuthContext("fallback-create@example.com");
    const { org } = await setupWorkspace(token, user.id);

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/chat",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        message: "Create a workspace named Engineering Support",
        organizationId: org.id,
      },
    });

    expect(chatResponse.statusCode).toBe(200);
    const body = JSON.parse(chatResponse.payload);
    expect(body.response).toContain("Workspace Created Successfully");
    expect(body.actionExecuted.type).toBe("CREATE_WORKSPACE");
    expect(body.actionExecuted.details.name).toBe("Engineering Support");

    // Verify it exists in database
    const createdWorkspace = await app.prisma.workspace.findFirst({
      where: { name: "Engineering Support", organizationId: org.id },
    });
    expect(createdWorkspace).not.toBeNull();
    expect(createdWorkspace.slug).toBe("engineering-support");
  });

  it("should list workspaces via fallback flow", async () => {
    const { user, token } = await getAuthContext("fallback-list@example.com");
    const { org, workspace } = await setupWorkspace(token, user.id);

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/v1/chat",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        message: "List workspaces, please",
        organizationId: org.id,
        workspaceId: workspace.id,
      },
    });

    expect(chatResponse.statusCode).toBe(200);
    const body = JSON.parse(chatResponse.payload);
    expect(body.response).toContain("Primary Workspace");
    expect(body.actionExecuted.type).toBe("LIST_WORKSPACES");
  });
});
