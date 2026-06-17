import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createTestApp } from "./testApp";

describe("API integration", () => {
  let app: Express;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    expect(login.status).toBe(200);
    accessToken = login.body.accessToken;
    expect(accessToken).toBeTruthy();
    const branchId = login.body.allowedBranches?.[0]?.id;
    expect(branchId).toBeTruthy();
    const select = await request(app)
      .post("/api/auth/select-branch")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ branchId });
    expect(select.status).toBe(200);
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/auth/me requires auth", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns user with token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("admin@maximuscare.com");
    expect(Array.isArray(res.body.allowedBranches)).toBe(true);
  });

  it("POST /api/auth/refresh rotates tokens", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();
    expect(refresh.body.refreshToken).toBeTruthy();
  });

  it("GET /api/patients without branch returns 403", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    const res = await request(app)
      .get("/api/patients?page=1&limit=10")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/patients paginated returns envelope", async () => {
    const res = await request(app)
      .get("/api/patients?page=1&limit=10")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it("GET /api/reports/dashboard-kpis requires dates", async () => {
    const res = await request(app)
      .get("/api/reports/dashboard-kpis")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it("GET /api/appointments without branch returns 403", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    const res = await request(app)
      .get("/api/appointments")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("GET /api/appointments returns array with branch selected", async () => {
    const res = await request(app)
      .get("/api/appointments")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/reports/revenue requires dates", async () => {
    const res = await request(app)
      .get("/api/reports/revenue")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(400);
  });

  it("GET /api/attendance without branch returns 403", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    const res = await request(app)
      .get("/api/attendance")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("login sets HttpOnly auth cookies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@maximuscare.com", password: "admin123" });
    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"];
    expect(cookies?.some((c: string) => c.startsWith("maximus_access="))).toBe(true);
    expect(cookies?.some((c: string) => c.includes("HttpOnly"))).toBe(true);
  });

  it("GET /api/reports/export/revenue returns CSV", async () => {
    const res = await request(app)
      .get("/api/reports/export/revenue?startDate=2026-01-01&endDate=2026-01-31&format=csv")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("Date");
  });

  it("Branch Manager role has patients.manage permission", async () => {
    const { hasPermission } = await import("./rbac/permissions");
    expect(hasPermission("Branch Manager", "patients.manage")).toBe(true);
  });
});
