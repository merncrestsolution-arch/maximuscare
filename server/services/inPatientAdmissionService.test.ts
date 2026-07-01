import { describe, expect, it } from "vitest";
import {
  compareAdmissionRecency,
  pickLatestAdmissionsPerPatient,
  filterInPatientsByListStatus,
  priorAdmissionBalanceFromDischarge,
  getPreviousInPatientSessions,
  getPriorInPatientEpisodes,
  parseReadmitAdmissionSource,
  formatReadmitAdmissionSource,
} from "./inPatientAdmissionService";

describe("inPatientAdmissionService", () => {
  it("computes prior admission balance from discharge grand total minus payments", () => {
    expect(priorAdmissionBalanceFromDischarge(10000, 3500)).toBe(6500);
    expect(priorAdmissionBalanceFromDischarge(10000, 10000)).toBe(0);
    expect(priorAdmissionBalanceFromDischarge(10000, 12000)).toBe(0);
  });

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

  it("returns sessions from prior admissions only", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "current") {
          return { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted" } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-05-01", status: "Discharged", createdAt: new Date("2024-05-01") },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", createdAt: new Date("2024-07-01") },
      ] as any,
      getAllInPatientAdmissions: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-05-01", status: "Discharged", createdAt: new Date("2024-05-01") },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", createdAt: new Date("2024-07-01") },
      ] as any,
      getInPatientSessionsByAdmission: async (admissionId: string) => {
        if (admissionId === "prior") {
          return [
            {
              id: "s1",
              admissionId: "prior",
              sessionDate: "2024-05-10",
              sessionNumber: 1,
              patientName: "Jane",
              treatingStaffId: "st1",
              treatingStaffName: "Dr A",
              startTime: "09:00",
              endTime: "10:00",
              treatmentProvided: "Mobility",
            },
          ] as any;
        }
        if (admissionId === "current") {
          return [
            {
              id: "s2",
              admissionId: "current",
              sessionDate: "2024-07-05",
              sessionNumber: 1,
              patientName: "Jane",
              treatingStaffId: "st1",
              treatingStaffName: "Dr A",
              startTime: "11:00",
              endTime: "12:00",
              treatmentProvided: "Strength",
            },
          ] as any;
        }
        return [];
      },
    };

    const previous = await getPreviousInPatientSessions(storage as any, "current");
    expect(previous).toHaveLength(1);
    expect(previous[0].id).toBe("s1");
    expect(previous[0].priorAdmissionId).toBe("prior");
    expect(previous[0].admissionStatus).toBe("Discharged");
  });

  it("links re-admissions through admissionSource", () => {
    const priorId = "prior-admission";
    expect(formatReadmitAdmissionSource(priorId)).toBe("readmit:prior-admission");
    expect(parseReadmitAdmissionSource("readmit:prior-admission")).toBe(priorId);
    expect(parseReadmitAdmissionSource("out_patient_transfer")).toBeNull();
  });

  it("returns prior episode billing summaries", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "current") {
          return {
            id: "current",
            patientId: "p1",
            admitDate: "2024-07-01",
            status: "Admitted",
            admissionSource: "readmit:prior",
          } as any;
        }
        if (id === "prior") {
          return {
            id: "prior",
            patientId: "p1",
            admitDate: "2024-05-01",
            status: "Discharged",
          } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-05-01", status: "Discharged" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted" },
      ] as any,
      getAllInPatientAdmissions: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-05-01", status: "Discharged" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", admissionSource: "readmit:prior" },
      ] as any,
      getInPatientDischargeByAdmission: async (id: string) =>
        id === "prior"
          ? ({ dischargeDate: "2024-06-01", grandTotal: "10000" } as any)
          : undefined,
      getPaymentTotalByAdmission: async (id: string) => (id === "prior" ? 3500 : 0),
      getInPatientSessionsByAdmission: async (id: string) =>
        id === "prior" ? ([{ id: "s1" }] as any) : [],
    };

    const episodes = await getPriorInPatientEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(1);
    expect(episodes[0].pendingBalance).toBe(6500);
    expect(episodes[0].sessionCount).toBe(1);
  });
});
