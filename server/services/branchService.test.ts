import { describe, it, expect } from "vitest";
import { normalizeBranchName, getHomeVisitRateTier, isIncentiveEligibleBranch } from "@shared/branches";
import {
  assertBranchAccess,
  assertOverviewAccess,
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

  it("blocks maximus overview for Nexus MD", () => {
    expect(() => assertOverviewAccess("maximus-overview", "Nexus MD")).toThrow(/Unauthorized/i);
  });

  it("allows nexus overview for Nexus MD", () => {
    expect(() => assertOverviewAccess("nexus-overview", "Nexus MD")).not.toThrow();
  });
});

describe("branchAccess roles", () => {
  it("grants full branch access to Admin and MD", () => {
    expect(hasFullBranchAccess("Admin")).toBe(true);
    expect(hasFullBranchAccess("MD")).toBe(true);
    expect(hasFullBranchAccess("Branch Manager")).toBe(false);
  });

  it("scopes overview access by role", () => {
    expect(canAccessMaximusOverview("Admin")).toBe(true);
    expect(canAccessMaximusOverview("Nexus MD")).toBe(false);
    expect(canAccessNexusOverview("Nexus MD")).toBe(true);
    expect(canAccessNexusOverview("Branch Manager")).toBe(false);
  });
});
