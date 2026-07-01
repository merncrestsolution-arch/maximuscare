import { describe, it, expect } from "vitest";
import { normalizeBranchName, getHomeVisitRateTier, isIncentiveEligibleBranch } from "@shared/branches";
import {
  assertBranchAccess,
} from "./branchService";
import {
  canAccessMaximusOverview,
  canAccessNexusOverview,
  hasFullBranchAccess,
} from "@shared/branchAccess";

describe("shared/branches", () => {
  it("maps legacy Colombo to Dehiwala", () => {
    expect(normalizeBranchName("Colombo")).toBe("Dehiwala");
    expect(normalizeBranchName("colombo")).toBe("Dehiwala");
  });

  it("resolves enterprise branch short names", () => {
    expect(normalizeBranchName("Dehiwala Main Branch")).toBe("Dehiwala");
    expect(normalizeBranchName("Neuro Rehabilitation Unit")).toBe("Neuro Rehabilitation");
    expect(normalizeBranchName("Nexus Physio & Rehab Center")).toBe("Nexus Physio");
  });

  it("assigns home visit rate tiers", () => {
    expect(getHomeVisitRateTier("Bandaragama")).toBe("bandaragama");
    expect(getHomeVisitRateTier("Dehiwala")).toBe("main");
  });

  it("limits incentive eligibility to Dehiwala", () => {
    expect(isIncentiveEligibleBranch("Dehiwala")).toBe(true);
    expect(isIncentiveEligibleBranch("Bandaragama")).toBe(false);
  });
});

describe("branchService access", () => {
  it("rejects branch outside allowed list", () => {
    expect(() => assertBranchAccess("b1", ["b2"])).toThrow(/Unauthorized Branch Access/i);
  });

  it("allows branch in allowed list", () => {
    expect(() => assertBranchAccess("b1", ["b1", "b2"])).not.toThrow();
  });
});

describe("branchAccess roles", () => {
  it("grants full branch access to Admin only", () => {
    expect(hasFullBranchAccess("Admin")).toBe(true);
    expect(hasFullBranchAccess("MD")).toBe(false);
    expect(hasFullBranchAccess("Branch Manager")).toBe(false);
  });

  it("scopes overview access by role", () => {
    expect(canAccessMaximusOverview("Admin")).toBe(true);
    expect(canAccessMaximusOverview("MD")).toBe(false);
    expect(canAccessNexusOverview("Nexus MD")).toBe(true);
    expect(canAccessNexusOverview("Branch Manager")).toBe(false);
  });
});
