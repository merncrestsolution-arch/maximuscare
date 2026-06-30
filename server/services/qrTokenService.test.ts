import { describe, expect, it } from "vitest";
import { signPatientQrToken, verifyPatientQrToken } from "./qrTokenService";
import { organizationForBranch, sameOrganization } from "@shared/branchAccess";

describe("organizationForBranch", () => {
  it("maps Maximus branches to the maximus org", () => {
    expect(organizationForBranch("Dehiwala")).toBe("maximus");
    expect(organizationForBranch("Bandaragama")).toBe("maximus");
    expect(organizationForBranch("Neuro Rehabilitation")).toBe("maximus");
  });

  it("maps the Nexus branch to the nexus org", () => {
    expect(organizationForBranch("Nexus Physio")).toBe("nexus");
    expect(organizationForBranch("NEXUS")).toBe("nexus");
  });

  it("compares organizations across branch aliases", () => {
    expect(sameOrganization("Dehiwala", "Bandaragama")).toBe(true);
    expect(sameOrganization("Dehiwala", "Nexus Physio")).toBe(false);
  });
});

describe("patient QR token", () => {
  const input = { patientId: "p-123", organizationId: "maximus" as const, branchId: "b-1" };

  it("round-trips a signed token", () => {
    const token = signPatientQrToken(input);
    const res = verifyPatientQrToken(token);
    expect(res.ok).toBe(true);
    expect(res.payload?.patientId).toBe("p-123");
    expect(res.payload?.organizationId).toBe("maximus");
    expect(res.payload?.branchId).toBe("b-1");
  });

  it("rejects a tampered payload", () => {
    const token = signPatientQrToken(input);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ patientId: "evil", organizationId: "nexus", branchId: null, iat: 0, exp: 9999999999 })
    ).toString("base64url");
    const res = verifyPatientQrToken(`${forged}.${sig}`);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("invalid");
    // sanity: the original body still verifies
    expect(verifyPatientQrToken(`${body}.${sig}`).ok).toBe(true);
  });

  it("rejects a garbled token", () => {
    expect(verifyPatientQrToken("not-a-token").ok).toBe(false);
    expect(verifyPatientQrToken("").error).toBe("invalid");
  });
});
