import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { buildApp } from "../app.js";
import fs from "fs";
import path from "path";

describe("Workspace Documents & RAG Search API", () => {
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
    await app.prisma.document.deleteMany({});
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
        name: "Doc Tester",
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
        name: "Test Org",
        slug: "test-org",
        userId,
      },
    });
    const org = JSON.parse(orgRes.payload);

    const wsRes = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org.id}/workspaces`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: "Test Workspace",
        slug: "test-ws",
      },
    });
    return JSON.parse(wsRes.payload);
  }

  it("should fail uploading document if not authenticated", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/workspaces/00000000-0000-0000-0000-000000000000/documents",
    });
    expect(res.statusCode).toBe(401);
  });

  it("should upload a text document, list it, run RAG queries, and delete it", async () => {
    const { user, token } = await getAuthContext("tester@nexus.ai");
    const workspace = await setupWorkspace(token, user.id);

    // Mock fetch for RAG ingestion
    const spyFetch = vi.spyOn(global, "fetch").mockImplementation((url: any) => {
      if (url.includes("/rag/ingest")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, chunksIndexed: 1 }),
        } as any);
      }
      if (url.includes("/rag/query")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            answer: "This is a mocked RAG answer about installing packages.",
            sources: [{ documentId: "doc-id", documentName: "test.txt", snippet: "run pnpm install", score: 0.95 }]
          }),
        } as any);
      }
      if (url.includes("/rag/document")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        } as any);
      }
      return Promise.reject(new Error("Unknown fetch endpoint"));
    });

    // 1. Upload file using manual boundary inject
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="installation_guide.md"',
      'Content-Type: text/markdown',
      '',
      'To set up this workspace, download pnpm and run pnpm install at the directory root.',
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const uploadResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspace.id}/documents`,
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(uploadResponse.statusCode).toBe(201);
    const uploadedDoc = JSON.parse(uploadResponse.payload);
    expect(uploadedDoc.name).toBe("installation_guide.md");
    expect(uploadedDoc.mimeType).toBe("text/markdown");
    expect(uploadedDoc.workspaceId).toBe(workspace.id);
    expect(fs.existsSync(uploadedDoc.url)).toBe(true);

    // Verify python ingestion was called
    expect(spyFetch).toHaveBeenCalledTimes(1);
    expect(spyFetch.mock.calls[0][0]).toContain("/rag/ingest");

    // 2. List documents in workspace
    const listResponse = await app.inject({
      method: "GET",
      url: `/api/v1/workspaces/${workspace.id}/documents`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const docList = JSON.parse(listResponse.payload);
    expect(docList.length).toBe(1);
    expect(docList[0].id).toBe(uploadedDoc.id);

    // 3. Query RAG Search
    const queryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspace.id}/documents/query`,
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        query: "How to set up installation?",
      },
    });

    expect(queryResponse.statusCode).toBe(200);
    const queryResult = JSON.parse(queryResponse.payload);
    expect(queryResult.answer).toContain("mocked RAG answer");
    expect(queryResult.sources.length).toBe(1);

    // 4. Delete the document
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/workspaces/${workspace.id}/documents/${uploadedDoc.id}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(JSON.parse(deleteResponse.payload).success).toBe(true);
    expect(fs.existsSync(uploadedDoc.url)).toBe(false); // file deleted from disk!
  });
});
