import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";

describe("Users API", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear users database table before each test to guarantee isolations
    await app.prisma.user.deleteMany({});
  });

  it("should successfully create a new user with valid parameters", async () => {
    const payload = {
      email: "jane.doe@example.com",
      password: "password123",
      name: "Jane Doe",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("id");
    expect(body.email).toBe(payload.email);
    expect(body.name).toBe(payload.name);
  });

  it("should return 400 Bad Request if email format is invalid", async () => {
    const payload = {
      email: "invalid-email-format",
      password: "password123",
      name: "Jane Doe",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("error", "Bad Request");
    expect(body).toHaveProperty("message", "Validation failed");
    expect(body.details[0].path).toBe("email");
  });

  it("should return 409 Conflict if creating a user with an existing email", async () => {
    const payload = {
      email: "duplicate@example.com",
      password: "password123",
      name: "Original User",
    };

    // First creation
    await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload,
    });

    // Second creation attempt with same email
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      payload: {
        email: "duplicate@example.com",
        password: "password123",
        name: "Different Name",
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("error", "Conflict");
  });
});
