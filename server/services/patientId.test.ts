import { describe, expect, it } from "vitest";
import {
  formatPatientId,
  nextPatientIdFromCodes,
  parsePatientIdSequence,
  patientIdYearMonth,
  PATIENT_ID_PREFIX,
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
