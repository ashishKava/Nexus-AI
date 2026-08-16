import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";

describe("Health Check Endpoint", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 200 OK with health status and database connected", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload).toHaveProperty("status", "ok");
    expect(payload).toHaveProperty("database", "connected");
    expect(payload).toHaveProperty("service", "nexus-api");
  });
});
