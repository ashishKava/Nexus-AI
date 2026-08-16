import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";

describe("Authentication API", () => {
  let app: any;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await app.prisma.user.deleteMany({});
  });

  it("should successfully signup a new user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "signup@example.com",
        password: "securepassword123",
        name: "New User",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("token");
    expect(body.user).toHaveProperty("id");
    expect(body.user.email).toBe("signup@example.com");
    expect(body.user.name).toBe("New User");
  });

  it("should fail signup if password is too short", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "short-pwd@example.com",
        password: "123",
        name: "Short Pwd",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Bad Request");
    expect(body.message).toBe("Validation failed");
    expect(body.details[0].path).toBe("password");
  });

  it("should successfully login a signed-up user", async () => {
    // 1. Signup first
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "login@example.com",
        password: "securepassword123",
        name: "Login User",
      },
    });

    // 2. Attempt login
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "login@example.com",
        password: "securepassword123",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toHaveProperty("token");
    expect(body.user.email).toBe("login@example.com");
  });

  it("should fail login with incorrect credentials", async () => {
    // 1. Signup
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "wrong@example.com",
        password: "securepassword123",
      },
    });

    // 2. Attempt login with wrong password
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "wrong@example.com",
        password: "incorrect-password",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("Invalid email or password");
  });
});
