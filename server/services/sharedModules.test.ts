import { describe, expect, it } from "vitest";

/**
 * Build/deploy smoke test (guards the "Cannot find module '.../dist/shared/branchAccess'"
 * class of Vercel failure). Every module under shared/ that the server bundle pulls in
 * MUST be importable, and the cross-module re-exports (e.g. branchAccess → roles) must
 * resolve. If any of these throw at import time, the serverless bundle would crash the
 * same way in production — so this fails fast in CI instead.
 */
describe("shared modules are importable", () => {
  it("loads every shared module via the @shared alias", async () => {
    const modules = await Promise.all([
      import("@shared/branchAccess"),
      import("@shared/branches"),
      import("@shared/roles"),
      import("@shared/patientId"),
      import("@shared/release"),
      import("@shared/schema"),
    ]);
    for (const mod of modules) {
      expect(mod).toBeTruthy();
      expect(typeof mod).toBe("object");
    }
  });

  it("resolves cross-module re-exports used by the server bundle", async () => {
    const branchAccess = await import("@shared/branchAccess");
    // Re-exported from ./roles — the exact named export that previously broke the build.
    expect(typeof branchAccess.isOperationalLead).toBe("function");
    // Functions the server statically imports from branchAccess.
    expect(typeof branchAccess.organizationForBranch).toBe("function");
    expect(typeof branchAccess.hasFullBranchAccess).toBe("function");
    expect(branchAccess.organizationForBranch("Nexus Physio")).toBe("nexus");
    expect(branchAccess.organizationForBranch("Dehiwala")).toBe("maximus");
  });
});
