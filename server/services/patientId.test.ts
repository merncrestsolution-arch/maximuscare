import { describe, expect, it } from "vitest";
import {
  formatPatientId,
  nextPatientIdFromCodes,
  parsePatientIdSequence,
  patientIdYearMonth,
  PATIENT_ID_PREFIX,
  patientBranchCode,
  patientIdDayMonth,
  formatPatientCode,
  nextPatientCode,
  bumpPatientCode,
  isCurrentPatientCode,
} from "@shared/patientId";

describe("patientId", () => {
  it("extracts year and month from registration date", () => {
    expect(patientIdYearMonth("2025-06-17")).toBe("202506");
    expect(patientIdYearMonth("2024-12-01")).toBe("202412");
  });

  it("formats global clinic patient IDs with year and month", () => {
    expect(formatPatientId("202506", 1)).toBe("MXM-202506-000001");
    expect(formatPatientId("202412", 42)).toBe("MXM-202412-000042");
  });

  it("parses current and legacy codes", () => {
    expect(parsePatientIdSequence("MXM-202506-000015", "202506")).toBe(15);
    expect(parsePatientIdSequence("MXM-202507-000015", "202506")).toBeNull();
    expect(parsePatientIdSequence("DEHIWALA-202506-PAT000003", "202506")).toBe(3);
    expect(parsePatientIdSequence("PAT000003")).toBe(3);
  });

  it("increments the highest global sequence for a month", () => {
    const next = nextPatientIdFromCodes(
      ["MXM-202506-000010", "MXM-202506-000002", "MXM-202507-000099", "DEHIWALA-202506-PAT000005"],
      "2025-06-15",
    );
    expect(next).toBe("MXM-202506-000011");
  });

  it("starts a new sequence when the month changes", () => {
    const next = nextPatientIdFromCodes(["MXM-202506-000010"], "2025-07-01");
    expect(next).toBe("MXM-202507-000001");
  });

  it("uses the Maximus clinic prefix", () => {
    expect(PATIENT_ID_PREFIX).toBe("MXM");
  });
});

describe("patientCode (MC/<BRANCH>/<DDMM>/<SEQ>)", () => {
  it("maps branches to 3-letter codes", () => {
    expect(patientBranchCode("Dehiwala")).toBe("DEH");
    expect(patientBranchCode("Neuro Rehabilitation")).toBe("NEU");
    expect(patientBranchCode("Bandaragama")).toBe("BAN");
    // legacy alias resolves to Dehiwala
    expect(patientBranchCode("Colombo")).toBe("DEH");
  });

  it("extracts DDMM in clinic timezone from a registration date string", () => {
    expect(patientIdDayMonth("2026-06-29")).toBe("2906");
    expect(patientIdDayMonth("2026-07-01")).toBe("0107");
  });

  it("formats and increments per branch per day", () => {
    expect(formatPatientCode("DEH", "2906", 1)).toBe("MC/DEH/2906/01");
    const next = nextPatientCode(["MC/DEH/2906/01", "MC/DEH/2906/02"], "Dehiwala", "2026-06-29");
    expect(next).toBe("MC/DEH/2906/03");
  });

  it("resets the sequence for a different branch or day", () => {
    const existing = ["MC/DEH/2906/01", "MC/DEH/2906/02"];
    expect(nextPatientCode(existing, "Bandaragama", "2026-06-29")).toBe("MC/BAN/2906/01");
    expect(nextPatientCode(existing, "Dehiwala", "2026-07-01")).toBe("MC/DEH/0107/01");
  });

  it("bumps a code and recognises the current format", () => {
    expect(bumpPatientCode("MC/DEH/2906/01")).toBe("MC/DEH/2906/02");
    expect(isCurrentPatientCode("MC/DEH/2906/01")).toBe(true);
    expect(isCurrentPatientCode("MXM-202606-000001")).toBe(false);
  });
});
