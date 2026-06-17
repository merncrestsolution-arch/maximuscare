import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwtService";

describe("jwtService", () => {
  it("issues and verifies access tokens", () => {
    const token = signAccessToken({
      sub: "staff-1",
      sid: "session-1",
      role: "Admin",
      email: "admin@test.com",
    });
    const payload = verifyAccessToken(token);
    expect(payload?.sub).toBe("staff-1");
    expect(payload?.sid).toBe("session-1");
    expect(payload?.role).toBe("Admin");
  });

  it("rejects tampered tokens", () => {
    const token = signAccessToken({
      sub: "staff-1",
      sid: "session-1",
      role: "Admin",
      email: "admin@test.com",
    });
    const bad = token.slice(0, -4) + "xxxx";
    expect(verifyAccessToken(bad)).toBeNull();
  });
});
