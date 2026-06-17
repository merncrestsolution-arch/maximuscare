import { describe, it, expect } from "vitest";
import { hasPermission, normalizeRole } from "./permissions";

describe("RBAC permissions", () => {
  it("normalizes Physio alias", () => {
    expect(normalizeRole("Physio")).toBe("Physiotherapist");
  });

  it("Branch Manager can manage patients and export reports", () => {
    expect(hasPermission("Branch Manager", "patients.manage")).toBe(true);
    expect(hasPermission("Branch Manager", "reports.export")).toBe(true);
    expect(hasPermission("Branch Manager", "branches.manage")).toBe(false);
  });

  it("Manager can manage operations but not financial reports", () => {
    expect(hasPermission("Manager", "patients.manage")).toBe(true);
    expect(hasPermission("Manager", "appointments.manage")).toBe(true);
    expect(hasPermission("Manager", "reports.view")).toBe(false);
    expect(hasPermission("Manager", "reports.export")).toBe(false);
  });

  it("Nexus MD can manage salary but not branches", () => {
    expect(hasPermission("Nexus MD", "salary.manage")).toBe(true);
    expect(hasPermission("Nexus MD", "branches.manage")).toBe(false);
  });

  it("Staff cannot export reports", () => {
    expect(hasPermission("Staff", "reports.export")).toBe(false);
    expect(hasPermission("Staff", "attendance.mark_own")).toBe(true);
  });
});
