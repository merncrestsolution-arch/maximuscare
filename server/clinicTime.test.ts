import { describe, it, expect } from "vitest";
import { isStrictlyBeforeNoon, clinicDateString } from "./clinicTime";

describe("clinicTime", () => {
  it("detects times before noon", () => {
    expect(isStrictlyBeforeNoon("11:30")).toBe(true);
    expect(isStrictlyBeforeNoon("12:00")).toBe(false);
    expect(isStrictlyBeforeNoon("09:00")).toBe(true);
  });

  it("returns YYYY-MM-DD format for clinic date", () => {
    const d = clinicDateString(new Date("2026-06-09T12:00:00Z"));
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
