import { describe, expect, it } from "vitest";
import {
  compareAdmissionRecency,
  pickLatestAdmissionsPerPatient,
  filterInPatientsByListStatus,
  priorAdmissionBalanceFromDischarge,
  getPreviousInPatientSessions,
  getPriorInPatientEpisodes,
  getInPatientSessionsForAdmissionView,
  parseReadmitAdmissionSource,
  formatReadmitAdmissionSource,
} from "./inPatientAdmissionService";

describe("inPatientAdmissionService", () => {
  it("computes prior admission balance from discharge grand total minus payments", () => {
    expect(priorAdmissionBalanceFromDischarge(10000, 3500)).toBe(6500);
    expect(priorAdmissionBalanceFromDischarge(10000, 10000)).toBe(0);
    expect(priorAdmissionBalanceFromDischarge(10000, 12000)).toBe(-2000);
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

  it("returns sessions from readmit-chain prior admissions only", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "current") {
          return {
            id: "current",
            patientId: "p1",
            branchId: "branch-a",
            admitDate: "2024-07-01",
            status: "Admitted",
            admissionSource: "readmit:prior",
          } as any;
        }
        if (id === "prior") {
          return {
            id: "prior",
            patientId: "p1",
            branchId: "branch-a",
            admitDate: "2024-05-01",
            status: "Discharged",
            createdAt: new Date("2024-05-01"),
          } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [
        { id: "prior", patientId: "p1", branchId: "branch-a", admitDate: "2024-05-01", status: "Discharged", createdAt: new Date("2024-05-01") },
        { id: "current", patientId: "p1", branchId: "branch-a", admitDate: "2024-07-01", status: "Admitted", admissionSource: "readmit:prior", createdAt: new Date("2024-07-01") },
      ] as any,
      getAllInPatientAdmissions: async (branchId?: string) => {
        const rows = [
          { id: "prior", patientId: "p1", branchId: "branch-a", admitDate: "2024-05-01", status: "Discharged", createdAt: new Date("2024-05-01") },
          { id: "current", patientId: "p1", branchId: "branch-a", admitDate: "2024-07-01", status: "Admitted", admissionSource: "readmit:prior", createdAt: new Date("2024-07-01") },
        ] as any;
        return branchId ? rows.filter((r) => r.branchId === branchId) : rows;
      },
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
            admitDate: "2024-06-01",
            status: "Discharged",
            amountPerDay: "10000",
          } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-06-01", status: "Discharged", amountPerDay: "10000" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted" },
      ] as any,
      getAllInPatientAdmissions: async () => [
        { id: "prior", patientId: "p1", admitDate: "2024-06-01", status: "Discharged", amountPerDay: "10000" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", admissionSource: "readmit:prior" },
      ] as any,
      getInPatientDischargeByAdmission: async (id: string) =>
        id === "prior"
          ? ({ dischargeDate: "2024-06-01", grandTotal: "10000" } as any)
          : undefined,
      getPaymentTotalByAdmission: async (id: string) => (id === "prior" ? 3500 : 0),
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async (id: string) =>
        id === "prior" ? ([{ id: "s1" }] as any) : [],
    };

    const episodes = await getPriorInPatientEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(1);
    expect(episodes[0].pendingBalance).toBe(6500);
    expect(episodes[0].sessionCount).toBe(1);
  });

  it("does not attach unrelated prior admissions to a first-time admission bill", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "current") {
          return {
            id: "current",
            patientId: "p1",
            admitDate: "2024-07-01",
            status: "Admitted",
            amountPerDay: "1000",
          } as any;
        }
        if (id === "old") {
          return {
            id: "old",
            patientId: "p1",
            admitDate: "2024-01-01",
            status: "Discharged",
            amountPerDay: "1000",
          } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [
        { id: "old", patientId: "p1", admitDate: "2024-01-01", status: "Discharged", amountPerDay: "1000" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", amountPerDay: "1000" },
      ] as any,
      getAllInPatientAdmissions: async () => [
        { id: "old", patientId: "p1", admitDate: "2024-01-01", status: "Discharged", amountPerDay: "1000" },
        { id: "current", patientId: "p1", admitDate: "2024-07-01", status: "Admitted", amountPerDay: "1000" },
      ] as any,
      getInPatientDischargeByAdmission: async (id: string) =>
        id === "old"
          ? ({ dischargeDate: "2024-02-01", grandTotal: "5000" } as any)
          : undefined,
      getPaymentTotalByAdmission: async (id: string) => (id === "old" ? 0 : 0),
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [],
    };

    const episodes = await getPriorInPatientEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(0);
  });

  it("does not merge admissions with the same name across branches", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "dehiwala-sir") {
          return {
            id: "dehiwala-sir",
            patientName: "Sir",
            branchId: "branch-dehiwala",
            admitDate: "2024-07-01",
            status: "Admitted",
          } as any;
        }
        return undefined;
      },
      getInPatientAdmissionsForPatient: async () => [],
      getAllInPatientAdmissions: async (branchId?: string) => {
        const rows = [
          { id: "dehiwala-sir", patientName: "Sir", branchId: "branch-dehiwala", phone: "", patientIdNo: "", admitDate: "2024-07-01", status: "Admitted" },
          { id: "nexus-sir", patientName: "Sir", branchId: "branch-nexus", phone: "", patientIdNo: "", admitDate: "2024-06-01", status: "Discharged" },
        ] as any;
        return branchId ? rows.filter((r) => r.branchId === branchId) : rows;
      },
      getInPatientDischargeByAdmission: async () => undefined,
      getPaymentTotalByAdmission: async () => 0,
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [],
    };

    const previous = await getPreviousInPatientSessions(storage as any, "dehiwala-sir");
    expect(previous).toHaveLength(0);
  });

  it("merges sessions from legacy transferred admissions into the current view", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) =>
        id === "current"
          ? ({ id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01" } as any)
          : ({ id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01" } as any),
      getInPatientAdmissionsForPatient: async () => [
        { id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01" },
        { id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01" },
      ],
      getAllInPatientAdmissions: async () => [
        { id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01" },
        { id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01" },
      ],
      getInPatientSessionsByAdmission: async (id: string) =>
        id === "current"
          ? [{ id: "s2", sessionDate: "2024-07-02", sessionNumber: 2 } as any]
          : [{ id: "s1", sessionDate: "2024-06-05", sessionNumber: 1 } as any],
    };

    const sessions = await getInPatientSessionsForAdmissionView(storage as any, "current");
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.id).sort()).toEqual(["s1", "s2"]);
  });
});
