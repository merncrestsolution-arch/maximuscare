import { describe, expect, it } from "vitest";
import {
  compareAdmissionRecency,
  pickLatestAdmissionsPerPatient,
  filterInPatientsByListStatus,
  priorAdmissionBalanceFromDischarge,
  getPreviousInPatientSessions,
  getPriorInPatientEpisodes,
  getTransferPriorBillingEpisodes,
  computeTransferSegmentPendingBalance,
  getInPatientSessionsForAdmissionView,
  collectPriorAdmissionIdsForSessionHistory,
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
      getPatient: async () => ({ id: "p1", branch: "Dehiwala", patientCode: "PC1" }) as any,
      getAllBranches: async () => [
        { id: "branch-a", branchName: "Dehiwala", name: "Dehiwala Main Branch" },
      ] as any,
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
      getPatientTransferLogsByAdmission: async () => [],
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
      getPatientTransferLogsByAdmission: async () => [],
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
      getPatientTransferLogsByAdmission: async () => [],
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
      getInPatientPaymentsByAdmission: async () => [],
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [],
      getPatientTransferLogsByAdmission: async () => [],
    };

    const previous = await getPreviousInPatientSessions(storage as any, "dehiwala-sir");
    expect(previous).toHaveLength(0);
  });

  it("includes cross-branch transferred sessions for the same linked patient", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) => {
        if (id === "nexus-current") {
          return {
            id: "nexus-current",
            patientId: "p1",
            branchId: "branch-nexus",
            admitDate: "2024-08-01",
            status: "Admitted",
          } as any;
        }
        return undefined;
      },
      getPatient: async () => ({ id: "p1", branch: "Nexus Physio", patientCode: "NX1" }) as any,
      getAllBranches: async () => [
        { id: "branch-dehiwala", branchName: "Dehiwala", name: "Dehiwala Main Branch" },
        { id: "branch-nexus", branchName: "Nexus Physio", name: "Nexus Physio & Rehab Center" },
      ] as any,
      getInPatientAdmissionsForPatient: async () => [
        { id: "dehiwala-old", patientId: "p1", branchId: "branch-dehiwala", status: "Transferred", admitDate: "2024-05-01" },
        { id: "nexus-current", patientId: "p1", branchId: "branch-nexus", status: "Admitted", admitDate: "2024-08-01" },
      ] as any,
      getAllInPatientAdmissions: async (branchId?: string) => {
        const rows = [
          { id: "dehiwala-old", patientId: "p1", branchId: "branch-dehiwala", status: "Transferred", admitDate: "2024-05-01" },
          { id: "nexus-current", patientId: "p1", branchId: "branch-nexus", status: "Admitted", admitDate: "2024-08-01" },
        ] as any;
        return branchId ? rows.filter((r) => r.branchId === branchId) : rows;
      },
      getInPatientSessionsByAdmission: async (id: string) =>
        id === "dehiwala-old"
          ? ([{ id: "s1", sessionDate: "2024-05-10", sessionNumber: 1, admissionId: "dehiwala-old" }] as any)
          : [],
      getPatientTransferLogsByAdmission: async () => [],
    };

    const previous = await getPreviousInPatientSessions(storage as any, "nexus-current");
    expect(previous).toHaveLength(1);
    expect(previous[0].id).toBe("s1");
    expect(previous[0].priorAdmissionId).toBe("dehiwala-old");
  });

  it("collects prior admission ids for re-admit without unrelated patients", () => {
    const current = {
      id: "current",
      patientId: "p1",
      admissionSource: "readmit:prior",
      status: "Admitted",
    } as any;
    const related = [
      current,
      { id: "prior", patientId: "p1", status: "Discharged" },
    ] as any;
    const orgLinked = [
      { id: "prior", patientId: "p1", status: "Discharged" },
    ] as any;
    const allPatientLinked = orgLinked;
    const ids = collectPriorAdmissionIdsForSessionHistory(current, related, orgLinked, allPatientLinked);
    expect([...ids]).toEqual(["prior"]);
  });

  it("merges sessions from legacy transferred admissions into the current view", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) =>
        id === "current"
          ? ({ id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01", branchId: "b1" } as any)
          : ({ id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01", branchId: "b1" } as any),
      getPatient: async () => ({ id: "p1", branch: "Dehiwala", patientCode: "PC1" }) as any,
      getAllBranches: async () => [{ id: "b1", branchName: "Dehiwala", name: "Dehiwala Main Branch" }] as any,
      getInPatientAdmissionsForPatient: async () => [
        { id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01", branchId: "b1" },
        { id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01", branchId: "b1" },
      ],
      getAllInPatientAdmissions: async () => [
        { id: "current", patientId: "p1", patientCode: "PC1", status: "Admitted", admitDate: "2024-07-01", branchId: "b1" },
        { id: "old", patientId: "p1", patientCode: "PC1", status: "Transferred", admitDate: "2024-06-01", branchId: "b1" },
      ],
      getInPatientSessionsByAdmission: async (id: string) =>
        id === "current"
          ? [{ id: "s2", sessionDate: "2024-07-02", sessionNumber: 2 } as any]
          : [{ id: "s1", sessionDate: "2024-06-05", sessionNumber: 1 } as any],
      getPatientTransferLogsByAdmission: async () => [],
    };

    const sessions = await getInPatientSessionsForAdmissionView(storage as any, "current");
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.id).sort()).toEqual(["s1", "s2"]);
  });

  it("returns prior branch billing with pending balance after transfer", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) =>
        id === "current"
          ? ({
              id: "current",
              patientId: "p1",
              admitDate: "2024-06-01",
              status: "Admitted",
              branchId: "branch-b",
              amountPerDay: "1000",
              careTakerRatePerDay: "0",
              careTakerDaysOverride: null,
            } as any)
          : undefined,
      getPatientTransferLogsByAdmission: async () => [
        {
          id: "t1",
          admissionId: "current",
          fromBranchId: "branch-a",
          toBranchId: "branch-b",
          transferDate: "2024-06-10",
        },
      ],
      getInPatientPaymentsByAdmission: async () => [],
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [
        { id: "s1", sessionDate: "2024-06-05", sessionNumber: 1 } as any,
      ],
      getAllBranches: async () => [
        { id: "branch-a", branchName: "Nexus", name: "Nexus Branch" },
        { id: "branch-b", branchName: "Dehiwala", name: "Dehiwala Branch" },
      ],
      getInPatientDischargeByAdmission: async () => undefined,
    };

    const episodes = await getTransferPriorBillingEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(1);
    expect(episodes[0].episodeType).toBe("transfer");
    expect(episodes[0].branchName).toBe("Nexus");
    expect(episodes[0].pendingBalance).toBeGreaterThan(0);
    expect(episodes[0].sessionCount).toBe(1);
  });

  it("includes pre-transfer deduction on the prior branch billing episode", async () => {
    const storage = {
      getInPatientAdmission: async (id: string) =>
        id === "current"
          ? ({
              id: "current",
              patientId: "p1",
              admitDate: "2024-06-01",
              status: "Admitted",
              branchId: "branch-b",
              amountPerDay: "1000",
              careTakerRatePerDay: "0",
              careTakerDaysOverride: null,
              deductionType: "fixed",
              deductionValue: "500",
              deductionReason: "Staff discount",
              deductionAppliedAt: new Date("2024-06-08"),
            } as any)
          : undefined,
      getPatientTransferLogsByAdmission: async () => [
        {
          id: "t1",
          admissionId: "current",
          fromBranchId: "branch-dehiwala",
          toBranchId: "branch-neuro",
          transferDate: "2024-06-10",
        },
      ],
      getInPatientPaymentsByAdmission: async () => [],
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [],
      getAllBranches: async () => [
        { id: "branch-dehiwala", branchName: "Dehiwala", name: "Dehiwala Branch" },
        { id: "branch-neuro", branchName: "Neuro", name: "Neuro Unit" },
      ],
      getInPatientDischargeByAdmission: async () => undefined,
    };

    const episodes = await getTransferPriorBillingEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(1);
    expect(episodes[0].branchName).toBe("Dehiwala");
    expect(episodes[0].breakdown?.deductionAmount).toBe(500);
    expect(episodes[0].breakdown?.deductionReason).toBe("Staff discount");
    expect(episodes[0].grandTotal).toBe(10_000 - 500);
  });

  it("keeps prior branch pending when payments are made after transfer", async () => {
    const transferAt = "2026-07-02T10:00:00.000Z";
    const storage = {
      getInPatientAdmission: async (id: string) =>
        id === "current"
          ? ({
              id: "current",
              patientId: "p1",
              admitDate: "2026-07-01",
              status: "Admitted",
              branchId: "branch-neuro",
              amountPerDay: "7000",
              careTakerRatePerDay: "0",
              careTakerDaysOverride: null,
              deductionType: "fixed",
              deductionValue: "2000",
              deductionReason: "no food",
              deductionAppliedAt: new Date("2026-07-02T07:00:00.000Z"),
            } as any)
          : undefined,
      getPatientTransferLogsByAdmission: async () => [
        {
          id: "t1",
          admissionId: "current",
          fromBranchId: "branch-nexus",
          toBranchId: "branch-neuro",
          transferDate: "2026-07-02",
          createdAt: transferAt,
        },
      ],
      getInPatientPaymentsByAdmission: async () => [
        {
          id: "p1",
          paymentDate: "2026-07-02",
          createdAt: "2026-07-02T07:36:00.000Z",
          amount: "10000",
          paymentMode: "Cash",
        },
        {
          id: "p2",
          paymentDate: "2026-07-02",
          createdAt: "2026-07-02T12:47:00.000Z",
          amount: "5000",
          paymentMode: "Cash",
        },
      ],
      getInPatientExtraExpensesByAdmission: async () => [],
      getInPatientSessionsByAdmission: async () => [],
      getAllBranches: async () => [
        { id: "branch-nexus", branchName: "Nexus Physio", name: "Nexus Physio" },
        { id: "branch-neuro", branchName: "Neuro", name: "Neuro Unit" },
      ],
      getInPatientDischargeByAdmission: async () => undefined,
    };

    const episodes = await getTransferPriorBillingEpisodes(storage as any, "current");
    expect(episodes).toHaveLength(1);
    expect(episodes[0].grandTotal).toBe(12_000);
    expect(episodes[0].amountPaid).toBe(10_000);
    expect(episodes[0].pendingBalance).toBe(2_000);

    const admission = {
      id: "current",
      admitDate: "2026-07-01",
      amountPerDay: "7000",
      careTakerRatePerDay: "0",
      careTakerDaysOverride: null,
      deductionType: "fixed",
      deductionValue: "2000",
      deductionAppliedAt: new Date("2026-07-02T07:00:00.000Z"),
    } as any;
    const pending = await computeTransferSegmentPendingBalance(storage as any, admission, "2026-07-02", [
      { id: "t1", transferDate: "2026-07-02", fromBranchId: "branch-nexus", createdAt: transferAt },
    ]);
    expect(pending).toBe(2_000);
  });

  it("moves pre-transfer sessions on the same admission into previous session history", async () => {
    const admission = {
      id: "current",
      patientId: "p1",
      admitDate: "2026-07-02",
      status: "Admitted",
      branchId: "branch-neuro",
    } as any;
    const storage = {
      getInPatientAdmission: async (id: string) => (id === "current" ? admission : undefined),
      getPatientTransferLogsByAdmission: async () => [
        {
          id: "t1",
          admissionId: "current",
          fromBranchId: "branch-nexus",
          toBranchId: "branch-neuro",
          transferDate: "2026-07-02",
          createdAt: "2026-07-02T10:00:00.000Z",
        },
      ],
      getRelatedInPatientAdmissions: async () => [admission],
      getOrgScopedPatientAdmissions: async () => [],
      getInPatientAdmissionsForPatient: async () => [admission],
      getPatient: async () => ({ id: "p1", branch: "Neuro Rehabilitation" }) as any,
      getInPatientSessionsByAdmission: async () => [
        {
          id: "s-nexus",
          admissionId: "current",
          sessionDate: "2026-07-02",
          createdAt: "2026-07-02T08:00:00.000Z",
          sessionNumber: 1,
          branchId: "branch-nexus",
        } as any,
        {
          id: "s-neuro",
          admissionId: "current",
          sessionDate: "2026-07-02",
          createdAt: "2026-07-02T12:00:00.000Z",
          sessionNumber: 2,
          branchId: "branch-neuro",
        } as any,
      ],
      getAllBranches: async () => [],
      getAllInPatientAdmissions: async () => [admission],
    };

    const current = await getInPatientSessionsForAdmissionView(storage as any, "current");
    const previous = await getPreviousInPatientSessions(storage as any, "current");
    expect(current.map((session) => session.id)).toEqual(["s-neuro"]);
    expect(previous.map((session) => session.id)).toEqual(["s-nexus"]);
    expect(previous[0].priorAdmissionId).toBe("transfer:t1");
  });
});
