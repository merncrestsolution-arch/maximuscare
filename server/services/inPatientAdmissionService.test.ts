import { describe, expect, it } from "vitest";
import {
  compareAdmissionRecency,
  pickLatestAdmissionsPerPatient,
  filterInPatientsByListStatus,
} from "./inPatientAdmissionService";

describe("inPatientAdmissionService", () => {
  it("prefers newer createdAt over later admitDate when picking current episode", () => {
    const olderDischarged = {
      id: "a1",
      patientId: "p1",
      admitDate: "2024-06-15",
      status: "Discharged",
      createdAt: new Date("2024-06-01"),
    } as any;
    const newerReadmitted = {
      id: "a2",
      patientId: "p1",
      admitDate: "2024-05-01",
      status: "Admitted",
      createdAt: new Date("2024-06-20"),
    } as any;

    expect(compareAdmissionRecency(newerReadmitted, olderDischarged)).toBeLessThan(0);
    const latest = pickLatestAdmissionsPerPatient([olderDischarged, newerReadmitted]);
    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe("a2");
  });

  it("excludes re-admitted patients from discharged list filter", () => {
    const olderDischarged = {
      id: "a1",
      patientId: "p1",
      admitDate: "2024-06-15",
      status: "Discharged",
      createdAt: new Date("2024-06-01"),
    } as any;
    const newerReadmitted = {
      id: "a2",
      patientId: "p1",
      admitDate: "2024-05-01",
      status: "Admitted",
      createdAt: new Date("2024-06-20"),
    } as any;

    const discharged = filterInPatientsByListStatus(
      [olderDischarged, newerReadmitted],
      "Discharged"
    );
    expect(discharged).toHaveLength(0);

    const active = filterInPatientsByListStatus(
      [olderDischarged, newerReadmitted],
      "active"
    );
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("a2");
  });
});
