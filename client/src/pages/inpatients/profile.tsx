import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { useInPatient, useInPatientSessions, useInPatientPreviousSessions, useInPatientPriorEpisodes, useInPatientBillingSummary, useInPatientDischarge, useDeleteInPatient, useReadmitInPatient, useUpdateInPatientAdmitDate, useTransferInPatient, useInPatientTransfers, useInPatientPayments, useInPatientPaymentTotal, useCreateInPatientPayment, useUpdateInPatientPayment, useInPatientExtraExpenses, useInPatientExtraExpenseTotal, useCreateInPatientExtraExpense, useUpdateInPatientExtraExpense, useDeleteInPatientExtraExpense, useUpdateInPatient, useSetInPatientDeduction, useTreatingStaff, useUpdateInPatientSession, useDeleteInPatientSession, usePatientStats, useTransferBranches, useBranches } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { downloadAuthenticatedFile } from "@/lib/api";
import { getClinicalStaff } from "@/components/staff/treating-staff-combobox";
import { useBranding } from "@/context/branding-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Phone, MapPin, Calendar, User, Clock, Trash2, Edit, Pencil, Plus, CreditCard, Receipt, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { formatMoney } from "@/lib/reportDatePresets";
import { clinicTodayString } from "@/lib/utils";
import { getDueDisplay } from "@/lib/paymentStatus";
import {
  computeDeductionAmount,
  formatInpatientPaymentTimestamp,
  getPaymentsForPriorTransferStays,
  isCarriedForwardExpense,
  isTransferCarriedForwardExpense,
  isTransferCarriedForwardCredit,
  parseReadmitAdmissionSource,
  resolveDeductionSegmentIndex,
  sumPaymentAmounts,
} from "@shared/inpatientBilling";
import { useToast } from "@/hooks/use-toast";
import type {
  InPatientSession,
  InPatientDischarge,
  InPatientPayment,
  InPatientExtraExpense,
  InPatientPreviousSession,
  InPatientPriorEpisode,
  AdmissionBillingView,
} from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { PatientCredentials } from "@/components/patients/patient-credentials";
import { isManager, isBranchManager, canReAdmitInPatient } from "@/lib/permissions";
import { BRANCH_OPTIONS } from "@/lib/branches";
import { pickEnterpriseBranchesForTransfer, normalizeBranchName } from "@shared/branches";

const EXPENSE_CATEGORIES = ["Food", "Nurse Visit", "Doctor Visit", "Speech Therapy", "Others"];

function DueBalanceBanner({ due, testId }: { due: number; testId?: string }) {
  const display = getDueDisplay(due);
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ backgroundColor: display.bgColour, borderColor: display.colour }}
      data-testid={testId}
    >
      <span className="text-sm font-semibold text-slate-700">{display.label}</span>
      <span className="text-lg font-extrabold tabular-nums" style={{ color: display.colour }}>
        {display.value}
      </span>
    </div>
  );
}

function BillingSection({
  title,
  variant = "charges",
  children,
}: {
  title: string;
  variant?: "charges" | "prior-debt" | "prior-credit" | "payments" | "total";
  children: ReactNode;
}) {
  const styles = {
    charges: { bg: "bg-[#E8F2FA]", border: "border-[#B8D4E8]", text: "text-[#105691]" },
    "prior-debt": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
    "prior-credit": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
    payments: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900" },
    total: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900" },
  }[variant];

  return (
    <div className={`rounded-lg border ${styles.border} overflow-hidden`}>
      <div className={`px-3 py-2 ${styles.bg}`}>
        <p className={`text-xs font-bold uppercase tracking-wide ${styles.text}`}>{title}</p>
      </div>
      <div className="space-y-0.5 bg-white px-3 py-2">{children}</div>
    </div>
  );
}

function BillingLine({
  label,
  value,
  tone = "default",
  emphasized = false,
  sublabel,
  testId,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "credit";
  emphasized?: boolean;
  sublabel?: string;
  testId?: string;
}) {
  const valueTone =
    tone === "success"
      ? "text-green-700"
      : tone === "danger"
        ? "text-red-600"
        : tone === "credit"
          ? "text-emerald-700"
          : "text-foreground";

  return (
    <div
      className={`flex items-start justify-between gap-3 ${emphasized ? "border-t border-border/50 pt-3 mt-1" : "py-1.5"}`}
    >
      <div className="min-w-0 flex-1">
        <span className={`text-sm ${emphasized ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {sublabel ? (
          <span className="mt-0.5 block text-xs text-muted-foreground/80">{sublabel}</span>
        ) : null}
      </div>
      <span
        className={`shrink-0 text-right text-sm tabular-nums ${emphasized ? "text-base font-bold" : "font-medium"} ${valueTone}`}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}

export default function InPatientProfilePage() {
  const [, params] = useRoute("/inpatients/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user } = useAuth();
  const { logoUri } = useBranding();
  const { toast } = useToast();
  const patientId = params?.id || "";

  const { data: patient, isLoading, error } = useInPatient(patientId);
  const { data: linkedPatientStats } = usePatientStats(patient?.patientId ?? "");
  const { data: sessions } = useInPatientSessions(patientId);
  const { data: previousSessions = [] } = useInPatientPreviousSessions(patientId, !!patient);
  const { data: priorEpisodes = [] } = useInPatientPriorEpisodes(patientId, !!patient);
  const { data: discharge } = useInPatientDischarge(patientId);
  const billingEndDate = discharge
    ? String(discharge.dischargeDate).split("T")[0]
    : clinicTodayString();
  const { data: billingView } = useInPatientBillingSummary(patientId, !!patient, billingEndDate);
  const { data: payments } = useInPatientPayments(patientId);
  const { data: paymentTotalData } = useInPatientPaymentTotal(patientId);
  const { data: extraExpenses } = useInPatientExtraExpenses(patientId);
  const { data: extraExpenseTotalData } = useInPatientExtraExpenseTotal(patientId);
  const deleteInPatient = useDeleteInPatient();
  const readmitInPatient = useReadmitInPatient();
  const updateAdmitDate = useUpdateInPatientAdmitDate();
  const transferInPatient = useTransferInPatient();
  const { data: transferLogs = [] } = useInPatientTransfers(patientId);
  const createPayment = useCreateInPatientPayment();
  const updatePayment = useUpdateInPatientPayment();
  const updateInPatient = useUpdateInPatient();
  const setDeduction = useSetInPatientDeduction();
  const createExtraExpense = useCreateInPatientExtraExpense();
  const updateExtraExpense = useUpdateInPatientExtraExpense();
  const deleteExtraExpense = useDeleteInPatientExtraExpense();
  const deleteSession = useDeleteInPatientSession();
  const { data: staffList = [] } = useTreatingStaff();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const updateInPatientSession = useUpdateInPatientSession();

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<InPatientSession | null>(null);
  const [sessionForm, setSessionForm] = useState({
    patientName: "",
    sessionDate: "",
    treatingStaffId: "",
    treatmentProvided: "",
    improvements: "",
    startTime: "",
    endTime: "",
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    paymentMode: "Cash" as "Cash" | "Online",
    notes: "",
  });
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InPatientPayment | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    paymentMode: "Cash" as "Cash" | "Online",
    notes: "",
  });

  const [showCaretakerRateModal, setShowCaretakerRateModal] = useState(false);
  const [caretakerRateForm, setCaretakerRateForm] = useState({
    careTakerRatePerDay: "",
    careTakerDaysOverride: "",
  });

  // Bug 3: in-patient bill deduction modal state.
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionTargetSegment, setDeductionTargetSegment] = useState<"current" | "prior">("current");
  const [deductionForm, setDeductionForm] = useState({
    deductionType: "fixed" as "fixed" | "percentage",
    deductionValue: "",
    deductionReason: "",
  });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<InPatientExtraExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    expenseDate: format(new Date(), "yyyy-MM-dd"),
    category: "",
    amount: "",
    description: "",
  });

  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleteSessionId, setSessionToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // Bug 9: admit-date inline editing (Admin/MD) and re-admit date selection.
  const [editingAdmitDate, setEditingAdmitDate] = useState(false);
  const [admitDateDraft, setAdmitDateDraft] = useState("");
  const [readmitDate, setReadmitDate] = useState("");
  const [readmitOpen, setReadmitOpen] = useState(false);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  // Bug 4: branch transfer dialog state.
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBranchId, setTransferBranchId] = useState("");
  const [transferDate, setTransferDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [transferNote, setTransferNote] = useState("");
  const [billingSummaryView, setBillingSummaryView] = useState<"current" | "previous">("current");
  const [sessionsView, setSessionsView] = useState<"current" | "previous">("current");

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";
  const isReceptionist = user?.role === "Receptionist";
  // Bug 10: Managers / Branch Managers / Nexus MD may VIEW in-patient bills (branch-scoped,
  // read-only — no amount edits). Editing of amounts/caretaker rate stays Admin/MD only.
  const isBranchLead = ["Manager", "Branch Manager", "Nexus MD"].includes(user?.role || "");
  // Bug 4 (final spec): any staff may transfer an admitted in-patient to another branch.
  const canTransfer = !!user && patient?.status === "Admitted";
  const canViewPayments = isAdminMD || isReceptionist || isBranchLead;
  /** Billing summary + billing PDF — Admin, MD, and branch leads (view-only for leads). */
  const canViewBillingSummary = isAdminMD || isBranchLead;
  const canEditInPatientSession =
    isAdminMD ||
    isManager(user?.role) ||
    isBranchManager(user?.role) ||
    ["Physiotherapist", "Staff", "Receptionist"].includes(user?.role || "");
  const canAddPayment = canViewPayments;
  const canAddSession = patient?.status === "Admitted";
  const canDischarge = isAdminMD && patient?.status === "Admitted";
  const canReadmit = canReAdmitInPatient(user?.role) && patient?.status === "Discharged";

  const {
    data: transferBranches = [],
    isLoading: transferBranchesLoading,
    isError: transferBranchesError,
    refetch: refetchTransferBranches,
  } = useTransferBranches(!!user);
  const { data: allBranches = [] } = useBranches();
  const currentBranchLabel = useMemo(() => {
    const branchId = patient?.branchId ? String(patient.branchId) : "";
    if (!branchId) return "—";
    const branch = allBranches.find((entry) => String(entry.id) === branchId);
    if (!branch) return "—";
    const shortName = normalizeBranchName(branch.branchName ?? branch.name);
    return (
      BRANCH_OPTIONS.find((option) => option.value === shortName)?.label ??
      (shortName || branch.name || "—")
    );
  }, [allBranches, patient?.branchId]);
  const transferBranchChoices = useMemo(() => {
    const raw =
      Array.isArray(transferBranches) && transferBranches.length > 0
        ? transferBranches
        : Array.isArray(allBranches)
          ? allBranches
          : [];
    const rows = pickEnterpriseBranchesForTransfer(raw);
    return rows
      .filter((branch) => branch?.id)
      .map((branch) => {
        const shortName = normalizeBranchName(branch.branchName ?? branch.name);
        const friendly =
          BRANCH_OPTIONS.find((option) => option.value === shortName)?.label ??
          (shortName || branch.name || "Branch");
        const inactive = branch.isActive === false || branch.isActive === 0;
        return {
          id: String(branch.id),
          label: inactive ? `${friendly} (Inactive)` : friendly,
        };
      });
  }, [transferBranches, allBranches]);

  useEffect(() => {
    if (transferOpen) {
      void refetchTransferBranches();
    }
  }, [transferOpen, refetchTransferBranches]);

  const destinationBranches = useMemo(() => {
    const currentId = patient?.branchId ? String(patient.branchId) : "";
    return transferBranchChoices.filter((branch) => branch.id && branch.id !== currentId);
  }, [transferBranchChoices, patient?.branchId]);

  useEffect(() => {
    const action = new URLSearchParams(search).get("action");
    if (action === "readmit" && canReadmit) {
      setReadmitOpen(true);
    }
  }, [search, canReadmit]);

  useEffect(() => {
    setBillingSummaryView("current");
    setSessionsView("current");
  }, [patientId]);

  const paymentTotal = paymentTotalData?.total || 0;
  const extraExpenseTotal = extraExpenseTotalData?.total || 0;
  const displayPatientCode =
    patient?.patientCode?.trim() ||
    patient?.patientIdNo?.trim() ||
    `IP-${String(patient?.id ?? "").slice(0, 8).toUpperCase()}`;

  const handleAddPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: "Error", description: "Amount is required", variant: "destructive" });
      return;
    }

    try {
      await createPayment.mutateAsync({
        admissionId: patientId,
        data: {
          paymentDate: paymentForm.paymentDate,
          amount: paymentForm.amount,
          paymentMode: paymentForm.paymentMode,
          notes: paymentForm.notes || undefined,
        },
      });
      toast({ title: "Success", description: "Payment recorded successfully" });
      setShowPaymentModal(false);
      setPaymentForm({
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        paymentMode: "Cash",
        notes: "",
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to add payment",
        variant: "destructive"
      });
    }
  };

  const openEditPayment = (payment: InPatientPayment) => {
    setEditingPayment(payment);
    setEditPaymentForm({
      paymentDate: payment.paymentDate ? format(new Date(payment.paymentDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      amount: String(payment.amount ?? ""),
      paymentMode: (payment.paymentMode as "Cash" | "Online") || "Cash",
      notes: payment.notes || "",
    });
    setShowEditPaymentModal(true);
  };

  const handleEditPaymentSave = async () => {
    if (!editingPayment) return;
    if (!editPaymentForm.amount || parseFloat(editPaymentForm.amount) <= 0) {
      toast({ title: "Error", description: "Amount is required", variant: "destructive" });
      return;
    }
    try {
      await updatePayment.mutateAsync({
        admissionId: patientId,
        paymentId: editingPayment.id,
        data: {
          paymentDate: editPaymentForm.paymentDate,
          amount: editPaymentForm.amount,
          paymentMode: editPaymentForm.paymentMode,
          notes: editPaymentForm.notes || undefined,
        },
      });
      toast({ title: "Success", description: "Payment updated successfully" });
      setShowEditPaymentModal(false);
      setEditingPayment(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update payment",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteInPatient.mutateAsync(patientId);
      toast({ title: "Success", description: "In-patient record deleted" });
      setLocation("/inpatients");
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete record",
        variant: "destructive"
      });
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;
    try {
      await deleteSession.mutateAsync({ admissionId: patientId, sessionId: deleteSessionId });
      toast({ title: "Success", description: "Session deleted successfully" });
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete session", 
        variant: "destructive" 
      });
    }
  };

  const handleSaveAdmitDate = async () => {
    if (!admitDateDraft) return;
    try {
      await updateAdmitDate.mutateAsync({ id: patientId, admitDate: admitDateDraft });
      toast({ title: "Admit date updated" });
      setEditingAdmitDate(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update admit date",
        variant: "destructive",
      });
    }
  };

  const handleTransfer = async () => {
    if (!transferBranchId) {
      toast({ title: "Select a branch", description: "Please choose a destination branch.", variant: "destructive" });
      return;
    }
    try {
      await transferInPatient.mutateAsync({
        id: patientId,
        targetBranchId: transferBranchId,
        transferDate,
        transferNote: transferNote.trim() || undefined,
      });
      toast({ title: "Patient transferred", description: "The in-patient was moved to the selected branch." });
      setTransferOpen(false);
      setTransferBranchId("");
      setTransferNote("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to transfer patient",
        variant: "destructive",
      });
    }
  };

  const openCaretakerRateModal = () => {
    setCaretakerRateForm({
      careTakerRatePerDay: patient?.careTakerRatePerDay || "0",
      careTakerDaysOverride: patient?.careTakerDaysOverride ? String(patient.careTakerDaysOverride) : "",
    });
    setShowCaretakerRateModal(true);
  };

  // Bug 3: only Admin/MD/Managers may apply or change a deduction (never staff/receptionist).
  // Server enforces the same set; this just gates the UI.
  const canApplyDeduction = isAdminMD || ["Manager", "Branch Manager", "Nexus MD"].includes(user?.role || "");

  const openDeductionModal = (target: "current" | "prior" = "current") => {
    setDeductionTargetSegment(target);
    const patientAny = patient as {
      deductionType?: "fixed" | "percentage" | null;
      deductionValue?: string | null;
      deductionReason?: string | null;
      currentDeductionType?: "fixed" | "percentage" | null;
      currentDeductionValue?: string | null;
      currentDeductionReason?: string | null;
    };
    const useCurrentFields = target === "current" && (transferLogs as any[]).length > 0;
    const type = useCurrentFields ? patientAny.currentDeductionType : patientAny.deductionType;
    const value = useCurrentFields ? patientAny.currentDeductionValue : patientAny.deductionValue;
    const reason = useCurrentFields ? patientAny.currentDeductionReason : patientAny.deductionReason;
    setDeductionForm({
      deductionType: (type as "fixed" | "percentage") || "fixed",
      deductionValue: type && parseFloat(value ?? "0") > 0 ? String(value) : "",
      deductionReason: reason || "",
    });
    setShowDeductionModal(true);
  };

  const handleSaveDeduction = async () => {
    const value = parseFloat(deductionForm.deductionValue);
    if (!deductionForm.deductionValue || isNaN(value) || value <= 0) {
      toast({ title: "Error", description: "Enter a deduction amount greater than zero", variant: "destructive" });
      return;
    }
    if (deductionForm.deductionType === "percentage" && value > 100) {
      toast({ title: "Error", description: "Percentage deduction cannot exceed 100%", variant: "destructive" });
      return;
    }
    try {
      await setDeduction.mutateAsync({
        id: patientId,
        data: {
          deductionType: deductionForm.deductionType,
          deductionValue: value,
          deductionReason: deductionForm.deductionReason.trim() || null,
          targetSegment: deductionTargetSegment,
        },
      });
      toast({ title: "Success", description: "Deduction applied" });
      setShowDeductionModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply deduction",
        variant: "destructive",
      });
    }
  };

  const handleClearDeduction = async () => {
    try {
      await setDeduction.mutateAsync({
        id: patientId,
        data: {
          deductionType: null,
          deductionValue: 0,
          deductionReason: null,
          targetSegment: deductionTargetSegment,
        },
      });
      toast({ title: "Success", description: "Deduction removed" });
      setShowDeductionModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove deduction",
        variant: "destructive",
      });
    }
  };

  const handleSaveCaretakerRate = async () => {
    try {
      const data: any = {
        careTakerRatePerDay: caretakerRateForm.careTakerRatePerDay || "0",
      };
      if (caretakerRateForm.careTakerDaysOverride && parseInt(caretakerRateForm.careTakerDaysOverride) > 0) {
        data.careTakerDaysOverride = parseInt(caretakerRateForm.careTakerDaysOverride);
      } else {
        data.careTakerDaysOverride = null;
      }
      await updateInPatient.mutateAsync({ id: patientId, data });
      toast({ title: "Success", description: "Caretaker rate updated" });
      setShowCaretakerRateModal(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update caretaker rate",
        variant: "destructive",
      });
    }
  };

  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setExpenseForm({
      expenseDate: format(new Date(), "yyyy-MM-dd"),
      category: "",
      amount: "",
      description: "",
    });
    setShowExpenseModal(true);
  };

  const openEditExpenseModal = (expense: InPatientExtraExpense) => {
    setEditingExpense(expense);
    setExpenseForm({
      expenseDate: expense.expenseDate,
      category: expense.category,
      amount: expense.amount,
      description: expense.description || "",
    });
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.category.trim()) {
      toast({ title: "Error", description: "Category is required", variant: "destructive" });
      return;
    }
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast({ title: "Error", description: "Amount is required", variant: "destructive" });
      return;
    }

    try {
      const data = {
        expenseDate: expenseForm.expenseDate,
        category: expenseForm.category,
        amount: expenseForm.amount,
        description: expenseForm.description || undefined,
      };

      if (editingExpense) {
        await updateExtraExpense.mutateAsync({
          admissionId: patientId,
          id: editingExpense.id,
          data,
        });
        toast({ title: "Success", description: "Expense updated successfully" });
      } else {
        await createExtraExpense.mutateAsync({
          admissionId: patientId,
          data,
        });
        toast({ title: "Success", description: "Expense added successfully" });
      }
      setShowExpenseModal(false);
      setEditingExpense(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteExtraExpense.mutateAsync({
        admissionId: patientId,
        id: deleteExpenseId,
      });
      toast({ title: "Success", description: "Expense deleted" });
      setDeleteExpenseId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const openSessionEdit = (s: InPatientSession) => {
    setEditingSession(s);
    setSessionForm({
      patientName: s.patientName,
      sessionDate: s.sessionDate,
      treatingStaffId: s.treatingStaffId,
      treatmentProvided: s.treatmentProvided,
      improvements: s.improvements || "",
      startTime: s.startTime,
      endTime: s.endTime,
    });
    setSessionDialogOpen(true);
  };

  const handleSaveSession = async () => {
    if (!editingSession) return;
    if (!sessionForm.patientName.trim() || !sessionForm.treatmentProvided.trim()) {
      toast({ title: "Error", description: "Patient name and session details are required", variant: "destructive" });
      return;
    }
    try {
      await updateInPatientSession.mutateAsync({
        admissionId: patientId,
        sessionId: editingSession.id,
        data: {
          patientName: sessionForm.patientName.trim(),
          sessionDate: sessionForm.sessionDate,
          treatingStaffId: sessionForm.treatingStaffId,
          treatmentProvided: sessionForm.treatmentProvided.trim(),
          improvements: sessionForm.improvements.trim() || null,
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
        },
      });
      toast({ title: "Session updated" });
      setSessionDialogOpen(false);
      setEditingSession(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update session",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-[720px] mx-auto">
          <div className="text-red-600 mb-4" data-testid="error-message">
            {error instanceof Error ? error.message : "Patient not found"}
          </div>
          <Button onClick={() => setLocation("/inpatients")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const sessionsByDate = sessions?.reduce((acc: Record<string, InPatientSession[]>, session: InPatientSession) => {
    const date = session.sessionDate;
    if (!acc[date]) acc[date] = [];
    acc[date].push(session);
    return acc;
  }, {}) || {};

  const sortedDates = Object.keys(sessionsByDate).sort((a, b) => b.localeCompare(a));
  const hasPriorEpisodes = priorEpisodes.length > 0;
  const hasPreviousSessions = previousSessions.length > 0 || priorEpisodes.some((episode) => episode.sessionCount > 0);
  const isReadmitFromSource = Boolean(
    parseReadmitAdmissionSource((patient as { admissionSource?: string | null }).admissionSource),
  );
  const hasTransferHistory = (transferLogs as any[]).length > 0;
  const showSessionsHistoryToggle =
    hasPriorEpisodes ||
    hasPreviousSessions ||
    isReadmitFromSource ||
    hasTransferHistory;
  const showingPreviousSessions = showSessionsHistoryToggle && sessionsView === "previous";
  const displayedSessions = showingPreviousSessions ? previousSessions : (sessions || []);
  const previousSessionsByAdmission = previousSessions.reduce<
    Record<string, { admitDate: string; status: string; sessionsByDate: Record<string, InPatientPreviousSession[]> }>
  >((acc, session) => {
    if (!acc[session.priorAdmissionId]) {
      acc[session.priorAdmissionId] = {
        admitDate: session.admissionAdmitDate,
        status: session.admissionStatus,
        sessionsByDate: {},
      };
    }
    const bucket = acc[session.priorAdmissionId].sessionsByDate;
    if (!bucket[session.sessionDate]) bucket[session.sessionDate] = [];
    bucket[session.sessionDate].push(session);
    return acc;
  }, {});
  const previousAdmissionGroups = Object.entries(previousSessionsByAdmission).sort(([, left], [, right]) =>
    right.admitDate.localeCompare(left.admitDate),
  );

  const transferLogsAsc = [...(transferLogs as any[])].sort((left, right) =>
    String(left.transferDate).localeCompare(String(right.transferDate)),
  );
  const priorStayPayments = hasTransferHistory
    ? getPaymentsForPriorTransferStays(payments ?? [], transferLogsAsc).sort(
        (left, right) =>
          new Date(right.createdAt ?? right.paymentDate).getTime() -
          new Date(left.createdAt ?? left.paymentDate).getTime(),
      )
    : [];

  const deductionType = (patient as any).deductionType as "fixed" | "percentage" | null;
  const deductionValue = parseFloat((patient as any).deductionValue ?? "0") || 0;
  const admissionDeductionSource = {
    admitDate: patient.admitDate,
    deductionType,
    deductionValue,
    deductionReason: (patient as any).deductionReason ?? null,
    deductionAppliedAt: (patient as any).deductionAppliedAt ?? null,
    currentDeductionType: (patient as any).currentDeductionType ?? null,
    currentDeductionValue: (patient as any).currentDeductionValue ?? null,
    currentDeductionReason: (patient as any).currentDeductionReason ?? null,
  };
  const transferDates = transferLogsAsc.map((transfer) => ({ transferDate: String(transfer.transferDate) }));
  const deductionSegment = resolveDeductionSegmentIndex(
    admissionDeductionSource.deductionAppliedAt,
    patient.admitDate,
    transferDates,
  );
  const billing = billingView?.currentBilling;
  const totals = billingView?.totals;
  const previousBilling = billingView?.previousBilling;
  const breakdown = billingView?.currentBreakdown;
  const stayDays = billing?.stayDays ?? 0;
  const roomCharges = billing?.roomCharges ?? 0;
  const careTakerDays = billing?.careTakerDays ?? 0;
  const caretakerCharges = billing?.caretakerCharges ?? 0;
  const currentExtraExpenseTotal = billing?.otherCharges ?? 0;
  const currentSubtotal = billing?.subtotal ?? 0;
  const currentDeductionAmount = billing?.deductionAmount ?? 0;
  const currentGrandTotal = billing?.chargesTotal ?? 0;
  const grandTotal = totals?.totalBill ?? 0;
  const totalPreviousPending = previousBilling?.totalPending ?? 0;
  const carriedForwardDebt = Math.max(0, totalPreviousPending);
  const carriedForwardCreditApplied = Math.max(0, -totalPreviousPending);
  const carriedForwardTotal = totalPreviousPending;
  const amountPerDay = parseFloat(patient.amountPerDay) || 0;
  const careTakerRate = parseFloat(patient.careTakerRatePerDay) || 0;
  const hasCarriedForwardBalance = carriedForwardDebt > 0;
  const hasCarriedForwardCredit = carriedForwardCreditApplied > 0;
  const hasLivePriorCredit = hasCarriedForwardCredit;
  const hasPriorAdjustment = previousBilling?.applicable ?? false;
  const priorBalanceLabel = hasTransferHistory ? "Previous Branch Balance" : "Previous Admission Balance";
  const showBillingHistoryToggle = hasPriorAdjustment || hasPriorEpisodes || hasTransferHistory;
  const priorDischargeNote = previousBilling?.lines[0]?.dischargeDate
    ? format(new Date(previousBilling.lines[0].dischargeDate), "dd MMM yyyy")
    : undefined;
  const deductionLabel =
    billing?.deductionType === "percentage"
      ? `Deduction (${billing.deductionValue ?? 0}%)`
      : "Deduction";
  const hasCurrentDeduction = currentDeductionAmount > 0;
  const hasPriorSegmentDeduction =
    hasTransferHistory && deductionSegment !== "current" && deductionType && deductionValue > 0;
  const targetHasDeduction =
    deductionTargetSegment === "current" ? hasCurrentDeduction : hasPriorSegmentDeduction;
  const currentStayPaymentTotal = billing?.paymentsTotal ?? 0;
  const currentStayPayments = (billing?.payments ?? []).map((payment: NonNullable<typeof billing>["payments"][number]) => ({
    id: payment.id,
    admissionId: patientId,
    paymentDate: payment.paymentDate,
    amount: String(payment.amount),
    paymentMode: payment.paymentMode,
    notes: payment.notes ?? "",
    createdByStaffId: "",
    createdByName: "",
    createdAt: payment.createdAt ?? payment.paymentDate,
    updatedAt: payment.createdAt ?? payment.paymentDate,
  })) as InPatientPayment[];
  const currentEpisodePaid = totals?.currentBalancePaid ?? 0;
  const priorBalancePaid = totals?.priorBalancePaid ?? 0;
  const currentBalanceDue = totals?.currentBalanceRemaining ?? 0;
  const priorBalanceDue = totals?.priorBalanceRemaining ?? 0;
  const netBalanceDue = totals?.totalBalanceDue ?? 0;
  const overpaymentCredit = totals?.overpaymentCredit ?? 0;
  const totalBalanceDue = netBalanceDue;
  const priorPendingForCurrentAdmission = priorBalanceDue;
  const hasPriorPendingInSummary = hasCarriedForwardBalance || hasCarriedForwardCredit;
  const effectivePaymentTotal = currentStayPaymentTotal;
  const displayExtraExpenses: InPatientExtraExpense[] = (extraExpenses ?? []).filter(
    (expense) =>
      !isCarriedForwardExpense(expense) &&
      !isTransferCarriedForwardExpense(expense) &&
      !isTransferCarriedForwardCredit(expense),
  );
  const showingPreviousBilling = showBillingHistoryToggle && billingSummaryView === "previous";
  const getPriorEpisodeBilling = (episode: InPatientPriorEpisode) => {
    const pending = episode.pendingBalance;
    const credit = pending < 0 ? Math.abs(pending) : 0;
    return {
      grandTotal: episode.grandTotal ?? 0,
      paidDuringAdmission: episode.amountPaid,
      paidAfterReadmit: 0,
      paid: episode.amountPaid,
      pending: credit > 0 ? -credit : pending,
      credit,
    };
  };
  const totalPriorPendingBalance = priorEpisodes.reduce((sum, episode) => {
    return sum + getPriorEpisodeBilling(episode).pending;
  }, 0);
  const dischargeBalance = discharge ? netBalanceDue : 0;
  const pastDueAdmission = dischargeBalance > 0 ? dischargeBalance : 0;
  const pastDueOutpatient = Math.max(0, Number(linkedPatientStats?.outstandingAmount ?? 0));
  const totalPastDue = pastDueAdmission + pastDueOutpatient;

  const handleReadmit = async () => {
    try {
      const newAdmission = await readmitInPatient.mutateAsync({
        admissionId: patientId,
        admitDate: readmitDate || undefined,
      });
      const carriedForward = Number(newAdmission?.carriedForwardBalance ?? 0);
      toast({
        title: "Success",
        description:
          carriedForward > 0
            ? `Patient re-admitted. Previous admission balance LKR ${formatMoney(carriedForward)} added to billing.`
            : carriedForward < 0
              ? `Patient re-admitted. Previous overpayment credit LKR ${formatMoney(Math.abs(carriedForward))} auto-deducted from this bill.`
              : totalPastDue > 0
                ? `Patient re-admitted. Past due balance: LKR ${formatMoney(totalPastDue)}`
                : "Patient re-admitted",
      });
      setReadmitDate("");
      setReadmitOpen(false);
      if (newAdmission?.id && newAdmission.id !== patientId) {
        setLocation(`/inpatients/${newAdmission.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to re-admit",
        variant: "destructive",
      });
    }
  };

  const billingColumns = [
    { key: "item", label: "Item" },
    { key: "quantity", label: "Qty/Days" },
    { key: "rate", label: "Rate LKR" },
    { key: "amount", label: "Amount LKR" },
  ];
  const billingRows = showingPreviousBilling
    ? priorEpisodes.length > 0
      ? priorEpisodes.flatMap((episode, index) => {
          const billing = getPriorEpisodeBilling(episode);
          return [
            {
              item:
                episode.episodeType === "transfer"
                  ? `Branch stay — ${episode.branchName ?? "Previous branch"} (${format(new Date(episode.admitDate), "dd MMM yyyy")} to ${episode.dischargeDate ? format(new Date(episode.dischargeDate), "dd MMM yyyy") : "—"})`
                  : `Admission ${format(new Date(episode.admitDate), "dd MMM yyyy")} (${episode.status})`,
              quantity: "-",
              rate: "-",
              amount:
                episode.episodeType === "transfer"
                  ? episode.status
                  : episode.dischargeDate
                    ? `Discharged ${format(new Date(episode.dischargeDate), "dd MMM yyyy")}`
                    : "-",
            },
        { item: "Grand Total", quantity: "-", rate: "-", amount: formatMoney(billing.grandTotal) },
        { item: "Paid during that admission", quantity: "-", rate: "-", amount: formatMoney(billing.paidDuringAdmission) },
        ...(billing.paidAfterReadmit > 0
          ? [{ item: "Paid after re-admit", quantity: "-", rate: "-", amount: formatMoney(billing.paidAfterReadmit) }]
          : []),
        { item: "Total Paid", quantity: "-", rate: "-", amount: formatMoney(billing.paid) },
        billing.credit > 0
          ? { item: "Credit Balance", quantity: "-", rate: "-", amount: formatMoney(billing.credit) }
          : { item: "Pending Balance", quantity: "-", rate: "-", amount: formatMoney(billing.pending) },
          ];
        })
      : [
          ...(hasCarriedForwardBalance
            ? [{
                item: priorBalanceLabel,
                quantity: "-",
                rate: "-",
                amount: formatMoney(carriedForwardDebt),
              }]
            : []),
          ...(hasCarriedForwardCredit
            ? [{
                item: "Previous Overpayment Credit Applied",
                quantity: "-",
                rate: "-",
                amount: `-${formatMoney(carriedForwardCreditApplied)}`,
              }]
            : []),
          { item: "Amount Paid", quantity: "-", rate: "-", amount: formatMoney(priorBalancePaid) },
          { item: "Pending Balance", quantity: "-", rate: "-", amount: formatMoney(priorBalanceDue) },
        ]
    : [
        { item: "Room Charges", quantity: String(stayDays), rate: formatMoney(amountPerDay), amount: formatMoney(roomCharges) },
        { item: "Caretaker Charges", quantity: String(careTakerDays), rate: formatMoney(careTakerRate), amount: formatMoney(caretakerCharges) },
        { item: "Extra Expenses", quantity: "-", rate: "-", amount: formatMoney(currentExtraExpenseTotal) },
        { item: "Subtotal (current stay)", quantity: "-", rate: "-", amount: formatMoney(currentSubtotal) },
        ...(hasCurrentDeduction
          ? [{ item: deductionLabel, quantity: "-", rate: "-", amount: `-${formatMoney(currentDeductionAmount)}` }]
          : []),
        { item: "Current Stay Total", quantity: "-", rate: "-", amount: formatMoney(currentGrandTotal) },
        ...(hasCarriedForwardBalance
          ? [{ item: priorBalanceLabel, quantity: "-", rate: "-", amount: formatMoney(carriedForwardDebt) }]
          : []),
        ...(hasCarriedForwardCredit
          ? [{ item: "Previous Overpayment Credit Applied", quantity: "-", rate: "-", amount: `-${formatMoney(carriedForwardCreditApplied)}` }]
          : []),
        { item: "Total Bill", quantity: "-", rate: "-", amount: formatMoney(grandTotal) },
        ...(hasTransferHistory
          ? [
              ...currentStayPayments.map((payment) => ({
                item: `Payment — ${formatInpatientPaymentTimestamp(payment)}`,
                quantity: payment.paymentMode,
                rate: "-",
                amount: formatMoney(parseFloat(String(payment.amount)) || 0),
              })),
              {
                item: "Total paid (current stay)",
                quantity: "-",
                rate: "-",
                amount: formatMoney(currentStayPaymentTotal),
              },
            ]
          : hasCarriedForwardBalance
          ? [
              { item: "Paid toward previous due", quantity: "-", rate: "-", amount: formatMoney(priorBalancePaid) },
              { item: "Paid toward current stay", quantity: "-", rate: "-", amount: formatMoney(currentEpisodePaid) },
            ]
          : [
              ...((payments ?? []).map((payment) => ({
                item: `Payment — ${formatInpatientPaymentTimestamp(payment)}`,
                quantity: payment.paymentMode,
                rate: "-",
                amount: formatMoney(parseFloat(String(payment.amount)) || 0),
              }))),
              { item: "Total Payments Recorded", quantity: "-", rate: "-", amount: formatMoney(paymentTotal) },
            ]),
        ...(overpaymentCredit > 0
          ? [{ item: "Overpayment / Credit", quantity: "-", rate: "-", amount: formatMoney(overpaymentCredit) }]
          : []),
        ...(hasPriorPendingInSummary
          ? [
              {
                item: currentBalanceDue < 0 ? "Current Episode Credit" : "Current Episode Balance Due",
                quantity: "-",
                rate: "-",
                amount: getDueDisplay(currentBalanceDue).value,
              },
              {
                item: priorPendingForCurrentAdmission < 0 ? "Previous Admission Credit" : "Previous Admission Due",
                quantity: "-",
                rate: "-",
                amount: getDueDisplay(priorPendingForCurrentAdmission).value,
              },
              { item: getDueDisplay(totalBalanceDue).label, quantity: "-", rate: "-", amount: getDueDisplay(totalBalanceDue).value },
            ]
          : [{ item: getDueDisplay(netBalanceDue).label, quantity: "-", rate: "-", amount: getDueDisplay(netBalanceDue).value }]),
      ];

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-[720px] mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/inpatients")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-patient-name">
              {patient.patientName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdminMD && (
              <>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setLocation(`/inpatients/${patientId}/edit`)}
                  data-testid="button-edit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" data-testid="button-delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the in-patient record
                        and all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleteInPatient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
          patient.status === "Admitted" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
        }`} data-testid="badge-status">
          {patient.status}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <PatientCredentials
            kind="inpatient"
            id={patientId}
            patientName={patient.patientName}
            patientCode={patient.patientCode ?? patient.patientIdNo}
            phone={patient.phone}
            address={patient.address}
            condition={patient.condition}
            branchId={patient.branchId}
            registeredDate={patient.admitDate}
          />
        </div>

        {/* Bug 13: discharge/transfer never remove the record — surface the status prominently. */}
        {patient.status === "Discharged" && discharge && (
          <div className="rounded-lg mb-4 px-4 py-3 text-sm" style={{ background: "#FEF2F2", color: "#DC2626" }} data-testid="banner-discharged">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p>
                Patient discharged on {format(new Date((discharge as any).dischargeDate), "dd MMM yyyy")}.
                Full admission history, sessions and bills below are retained.
              </p>
              {canReadmit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-red-300 bg-white hover:bg-red-50"
                  onClick={() => setReadmitOpen(true)}
                  data-testid="button-readmit-banner"
                >
                  Re-admit Patient
                </Button>
              )}
            </div>
          </div>
        )}
        {(transferLogs as any[]).length > 0 && (
          <div className="mb-4" data-testid="transfer-history-section">
            <h4 className="text-[#105691] text-sm font-bold mb-2">Transfer History</h4>
            {(transferLogs as any[]).map((transfer: any, index: number) => (
              <div
                key={transfer.id ?? index}
                className="rounded-lg border border-[#F19F39] bg-[#FFF3ED] px-3.5 py-2.5 mb-2 text-sm"
                data-testid={`transfer-log-${index}`}
              >
                <span className="text-[#F45627] font-semibold">↗ Transferred</span>
                <span className="text-slate-700 ml-2">
                  from <strong>{transfer.fromBranchName ?? "previous branch"}</strong> to{" "}
                  <strong>{transfer.toBranchName ?? "new branch"}</strong>
                </span>
                <span className="text-slate-400 ml-2">
                  on {format(new Date(transfer.transferDate), "dd MMM yyyy")}
                </span>
                {transfer.transferNote ? (
                  <div className="text-slate-400 mt-1 text-xs">Note: {transfer.transferNote}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Age:</span>
            <span className="font-medium" data-testid="text-age">{patient.age} years</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Phone:</span>
            <span className="font-medium" data-testid="text-phone">{patient.phone}</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-muted-foreground">Address:</span>
            <span className="font-medium" data-testid="text-address">{patient.address}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Admitted:</span>
            {editingAdmitDate ? (
              <span className="flex items-center gap-2">
                {/* Bug 9: admit date editable by Admin/MD; future dates disabled, past allowed. */}
                <Input
                  type="date"
                  value={admitDateDraft}
                  max={todayStr}
                  onChange={(e) => setAdmitDateDraft(e.target.value)}
                  className="h-8 w-40"
                  data-testid="input-edit-admit-date"
                />
                <Button size="sm" className="h-8" onClick={handleSaveAdmitDate} disabled={updateAdmitDate.isPending} data-testid="button-save-admit-date">
                  {updateAdmitDate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingAdmitDate(false)}>Cancel</Button>
              </span>
            ) : (
              <>
                <span className="font-medium" data-testid="text-admit-date">
                  {format(new Date(patient.admitDate), "dd MMM yyyy")}
                </span>
                {isAdminMD && (
                  <button
                    type="button"
                    className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                    onClick={() => {
                      setAdmitDateDraft(format(new Date(patient.admitDate), "yyyy-MM-dd"));
                      setEditingAdmitDate(true);
                    }}
                    aria-label="Edit admit date"
                    data-testid="button-edit-admit-date"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Condition: </span>
            <span className="font-medium" data-testid="text-condition">{patient.condition}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Package: </span>
            <span className="font-medium" data-testid="text-package">{patient.packageType}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Rate: </span>
            <span className="font-medium" data-testid="text-rate">LKR {patient.amountPerDay}/day</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2">Caretaker Information</h3>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Name: </span>
              <span className="font-medium" data-testid="text-caretaker-name">{patient.careTakerName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Relationship: </span>
              <span className="font-medium" data-testid="text-caretaker-relationship">{patient.careTakerRelationship}</span>
            </div>
            {patient.careTakerIdNo && (
              <div>
                <span className="text-muted-foreground">ID: </span>
                <span className="font-medium">{patient.careTakerIdNo}</span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground">Caretaker Rate: </span>
              <span className="font-medium" data-testid="text-caretaker-rate">LKR {patient.careTakerRatePerDay || "0"}/day</span>
              {patient.careTakerDaysOverride && (
                <span className="font-medium text-xs text-muted-foreground" data-testid="text-caretaker-days-override">
                  (Override: {patient.careTakerDaysOverride} days)
                </span>
              )}
              {isAdminMD && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={openCaretakerRateModal}
                  data-testid="button-edit-caretaker-rate"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {canViewBillingSummary && (
        <div id="inpatient-billing-report" className="mb-6 overflow-hidden rounded-xl border border-[#D6E8F5] bg-white shadow-sm">
          <div className="border-b border-[#D6E8F5] bg-[#F8FBFE] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <img src={logoUri} alt="Clinic logo" className="h-10 w-10 shrink-0 rounded-lg border border-[#D6E8F5] bg-white object-contain p-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#105691]">Maximus Care</div>
                  <div className="text-xs text-muted-foreground">In-Patient Billing Report</div>
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div className="max-w-[9rem] truncate font-medium text-foreground">{patient.patientName}</div>
                <div className="font-mono">ID: {displayPatientCode}</div>
              </div>
            </div>
            <div className="mt-3">
              <StructuredReportActions
                layout="toolbar"
                reportTitle={
                  showingPreviousBilling
                    ? `Previous Billing Summary - ${patient.patientName}`
                    : `In-Patient Billing Report - ${patient.patientName}`
                }
                fileBaseName={`inpatient-billing-${patientId}${showingPreviousBilling ? "-previous" : ""}`}
                columns={billingColumns}
                rows={billingRows}
                logoUri={logoUri}
                themeColor="#105691"
                meta={[
                  { label: "Patient", value: patient.patientName },
                  { label: "Patient ID", value: displayPatientCode },
                  { label: "Admit Date", value: format(new Date(patient.admitDate), "dd MMM yyyy") },
                  { label: "Generated", value: format(new Date(), "dd MMM yyyy hh:mm a") },
                  { label: "Prepared By", value: user?.name || "System" },
                ]}
              />
            </div>
          </div>

          <div className="space-y-3 p-3 sm:p-4" data-testid="billing-summary">
            {showBillingHistoryToggle && (
              <SegmentedToggle
                value={billingSummaryView}
                onChange={setBillingSummaryView}
                options={[
                  {
                    value: "current",
                    label: "Current Billing",
                    mobileLabel: "Current",
                    testId: "button-current-billing-summary",
                  },
                  {
                    value: "previous",
                    label: "Previous Billing",
                    mobileLabel: "Previous",
                    testId: "button-previous-billing-summary",
                  },
                ]}
              />
            )}

            <div className="rounded-xl bg-[#EEF5FB] p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#105691] sm:text-base">
                  <Receipt className="h-4 w-4 shrink-0" />
                  {showingPreviousBilling ? "Previous Billing Summary" : "Billing Summary"}
                </h3>
                {canApplyDeduction && !showingPreviousBilling && (
                  <Button
                    variant="outline"
                    size="compact"
                    className="h-7 min-h-7 shrink-0 border-[#D6E8F5] bg-white px-2.5 py-0 text-[11px] font-medium print:hidden sm:h-8 sm:px-3 sm:text-xs"
                    onClick={() => openDeductionModal("current")}
                    data-testid="button-apply-deduction"
                  >
                    {hasCurrentDeduction ? "Edit Deduction" : "New Deduction"}
                  </Button>
                )}
                {canApplyDeduction && showingPreviousBilling && hasPriorSegmentDeduction && (
                  <Button
                    variant="outline"
                    size="compact"
                    className="h-7 min-h-7 shrink-0 border-[#D6E8F5] bg-white px-2.5 py-0 text-[11px] font-medium print:hidden sm:h-8 sm:px-3 sm:text-xs"
                    onClick={() => openDeductionModal("prior")}
                    data-testid="button-edit-prior-deduction"
                  >
                    Edit Deduction
                  </Button>
                )}
              </div>

              <div className="rounded-lg bg-white p-3 shadow-sm sm:p-4">
                {showingPreviousBilling ? (
                  priorEpisodes.length > 0 ? (
                    <div className="space-y-3">
                      {priorEpisodes.map((episode, index) => {
                        const billing = getPriorEpisodeBilling(episode);
                        const b = episode.breakdown;
                        const priorDeductionLabel =
                          b?.deductionType === "percentage" && b.deductionValue
                            ? `Deduction (${b.deductionValue}%)`
                            : "Deduction";
                        return (
                          <div
                            key={episode.admissionId}
                            className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3"
                            data-testid={`prior-billing-${episode.admissionId}`}
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {episode.episodeType === "transfer"
                                  ? `${episode.branchName ?? "Previous branch"} stay`
                                  : `Admission ${format(new Date(episode.admitDate), "dd MMM yyyy")}`}
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                                {episode.episodeType === "transfer" ? "Transferred" : episode.status}
                              </span>
                              {episode.episodeType === "transfer" && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(episode.admitDate), "dd MMM yyyy")}
                                  {episode.dischargeDate
                                    ? ` → ${format(new Date(episode.dischargeDate), "dd MMM yyyy")}`
                                    : ""}
                                </span>
                              )}
                            </div>
                            {episode.dischargeDate && episode.episodeType !== "transfer" && (
                              <BillingLine
                                label="Discharged"
                                value={format(new Date(episode.dischargeDate), "dd MMM yyyy")}
                              />
                            )}
                            {episode.dischargeDate && episode.episodeType === "transfer" && (
                              <BillingLine
                                label="Transferred on"
                                value={format(new Date(episode.dischargeDate), "dd MMM yyyy")}
                              />
                            )}
                            {b ? (
                              <>
                                <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                                  {episode.episodeType === "transfer" ? "Branch bill details" : "Discharge bill details"}
                                </p>
                                <BillingLine
                                  label="Stay Days"
                                  value={`${b.stayDays} day${b.stayDays > 1 ? "s" : ""}`}
                                />
                                <BillingLine
                                  label={`Room (${formatMoney(b.amountPerDay)} × ${b.stayDays})`}
                                  value={`LKR ${formatMoney(b.roomCharges)}`}
                                />
                                <BillingLine
                                  label={`Caretaker (${formatMoney(b.careTakerRatePerDay)} × ${b.careTakerDays})`}
                                  value={`LKR ${formatMoney(b.caretakerCharges)}`}
                                />
                                <BillingLine
                                  label="Extra Expenses"
                                  value={`LKR ${formatMoney(b.extraExpenseTotal)}`}
                                />
                                <BillingLine label="Subtotal" value={`LKR ${formatMoney(b.subtotal)}`} emphasized />
                                {b.deductionAmount > 0 && (
                                  <BillingLine
                                    label={priorDeductionLabel}
                                    value={`- LKR ${formatMoney(b.deductionAmount)}`}
                                    tone="danger"
                                    sublabel={b.deductionReason || undefined}
                                  />
                                )}
                              </>
                            ) : null}
                            <BillingLine label="Grand Total" value={`LKR ${formatMoney(billing.grandTotal)}`} emphasized />
                            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                              Payments
                            </p>
                            {episode.episodeType === "transfer" && priorStayPayments.length > 0 ? (
                              <>
                                {priorStayPayments.map((payment) => (
                                  <BillingLine
                                    key={payment.id}
                                    label={formatInpatientPaymentTimestamp(payment)}
                                    value={`LKR ${formatMoney(parseFloat(String(payment.amount)) || 0)}`}
                                    tone="success"
                                    sublabel={payment.paymentMode}
                                  />
                                ))}
                                <BillingLine
                                  label="Total paid (previous branch)"
                                  value={`LKR ${formatMoney(sumPaymentAmounts(priorStayPayments))}`}
                                  tone="success"
                                  emphasized
                                />
                              </>
                            ) : (
                              <>
                            <BillingLine
                              label="Paid during that admission"
                              value={`LKR ${formatMoney(billing.paidDuringAdmission)}`}
                              tone="success"
                            />
                            {billing.paidAfterReadmit > 0 && (
                              <BillingLine
                                label="Paid after re-admit (this admission)"
                                value={`LKR ${formatMoney(billing.paidAfterReadmit)}`}
                                tone="success"
                              />
                            )}
                            <BillingLine
                              label="Total Paid"
                              value={`LKR ${formatMoney(billing.paid)}`}
                              tone="success"
                            />
                              </>
                            )}
                            <BillingLine
                              label={billing.credit > 0 ? "Credit Balance" : "Pending Balance"}
                              value={
                                billing.credit > 0
                                  ? `LKR ${formatMoney(billing.credit)}`
                                  : `LKR ${formatMoney(billing.pending)}`
                              }
                              tone={billing.pending > 0 ? "danger" : billing.credit > 0 ? "credit" : "success"}
                              emphasized
                            />
                          </div>
                        );
                      })}
                      {priorEpisodes.length > 1 && (
                        <BillingLine
                          label="Total pending from previous admissions"
                          value={`LKR ${formatMoney(totalPriorPendingBalance)}`}
                          tone={totalPriorPendingBalance > 0 ? "danger" : "success"}
                          emphasized
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {priorDischargeNote && (
                        <BillingLine label="Previous Discharge Date" value={priorDischargeNote} />
                      )}
                      {hasCarriedForwardBalance && (
                        <BillingSection title="Previous Admission — Balance Due" variant="prior-debt">
                          <BillingLine
                            label={priorBalanceLabel}
                            value={`LKR ${formatMoney(carriedForwardDebt)}`}
                            tone="danger"
                            testId="text-prior-balance"
                          />
                          <BillingLine
                            label="Paid after re-admit (this admission)"
                            value={`LKR ${formatMoney(priorBalancePaid)}`}
                            tone="success"
                            testId="text-prior-paid"
                          />
                          <BillingLine
                            label="Total paid toward previous due"
                            value={`LKR ${formatMoney(carriedForwardDebt - priorBalanceDue)}`}
                            tone="success"
                          />
                          <BillingLine
                            label="Pending Balance"
                            value={`LKR ${formatMoney(priorBalanceDue)}`}
                            tone={priorBalanceDue > 0 ? "danger" : "success"}
                            emphasized
                            testId="text-prior-balance-due"
                          />
                        </BillingSection>
                      )}
                      {hasCarriedForwardCredit && (
                        <BillingSection title="Previous Admission — Overpayment Credit" variant="prior-credit">
                          <BillingLine
                            label="Previous Overpayment Credit Applied"
                            value={`- LKR ${formatMoney(carriedForwardCreditApplied)}`}
                            tone="credit"
                            sublabel="Auto-deducted from current bill"
                            testId="text-prior-credit"
                          />
                        </BillingSection>
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <BillingSection title="Current Stay Charges" variant="charges">
                      <BillingLine
                        label="Stay Days"
                        value={`${stayDays} day${stayDays > 1 ? "s" : ""}`}
                        testId="text-stay-days"
                      />
                      <BillingLine
                        label={`Room Charges (${formatMoney(amountPerDay)} × ${stayDays})`}
                        value={`LKR ${formatMoney(roomCharges)}`}
                        testId="text-room-charges"
                      />
                      <BillingLine
                        label={`Caretaker Charges (${formatMoney(careTakerRate)} × ${careTakerDays})`}
                        value={`LKR ${formatMoney(caretakerCharges)}`}
                        testId="text-caretaker-charges"
                      />
                      <BillingLine
                        label="Extra Expenses"
                        value={`LKR ${formatMoney(currentExtraExpenseTotal)}`}
                        testId="text-extra-expenses-total"
                      />
                      <BillingLine
                        label="Subtotal"
                        value={`LKR ${formatMoney(currentSubtotal)}`}
                        emphasized
                        testId="text-subtotal"
                      />
                      {hasCurrentDeduction && (
                        <BillingLine
                          label={deductionLabel}
                          value={`- LKR ${formatMoney(currentDeductionAmount)}`}
                          tone="danger"
                          sublabel={(patient as any).deductionReason || undefined}
                          testId="text-deduction"
                        />
                      )}
                      <BillingLine
                        label="Current Stay Total"
                        value={`LKR ${formatMoney(currentGrandTotal)}`}
                        emphasized
                        testId="text-current-stay-total"
                      />
                    </BillingSection>

                    {hasCarriedForwardBalance && (
                      <BillingSection title="Previous Admission — Balance Due" variant="prior-debt">
                        {priorDischargeNote && (
                          <BillingLine label="Discharged on" value={priorDischargeNote} />
                        )}
                        <BillingLine
                          label="Previous Admission Balance"
                          value={`LKR ${formatMoney(carriedForwardDebt)}`}
                          tone="danger"
                          testId="text-carried-forward"
                        />
                      </BillingSection>
                    )}

                    {hasCarriedForwardCredit && (
                      <BillingSection title="Previous Admission — Overpayment Credit" variant="prior-credit">
                        {priorDischargeNote && (
                          <BillingLine label="Discharged on" value={priorDischargeNote} />
                        )}
                        <BillingLine
                          label="Previous Overpayment Credit Applied"
                          value={`- LKR ${formatMoney(carriedForwardCreditApplied)}`}
                          tone="credit"
                          sublabel={
                            hasLivePriorCredit
                              ? "Auto-deducted from previous admission credit balance"
                              : "Auto-deducted from this bill"
                          }
                          testId="text-carried-forward-credit"
                        />
                      </BillingSection>
                    )}

                    <BillingSection title="Total Bill" variant="total">
                      <BillingLine
                        label="Total Bill"
                        value={`LKR ${formatMoney(grandTotal)}`}
                        emphasized
                        testId="text-grand-total"
                      />
                    </BillingSection>

                    <BillingSection title="Payments" variant="payments">
                      {hasTransferHistory ? (
                        <>
                          {currentStayPayments.length > 0 ? (
                            currentStayPayments.map((payment) => (
                              <BillingLine
                                key={payment.id}
                                label={formatInpatientPaymentTimestamp(payment)}
                                value={`LKR ${formatMoney(parseFloat(String(payment.amount)) || 0)}`}
                                tone="success"
                                sublabel={payment.paymentMode}
                                testId={`text-current-payment-${payment.id}`}
                              />
                            ))
                          ) : (
                            <BillingLine
                              label="No payments recorded for current stay"
                              value="LKR 0.00"
                              tone="success"
                            />
                          )}
                          {hasCarriedForwardBalance && currentStayPaymentTotal > 0 && (
                            <>
                              <BillingLine
                                label="Paid toward previous admission"
                                value={`LKR ${formatMoney(priorBalancePaid)}`}
                                tone="success"
                                testId="text-transfer-prior-paid"
                              />
                              <BillingLine
                                label="Paid toward current stay"
                                value={`LKR ${formatMoney(currentEpisodePaid)}`}
                                tone="success"
                                testId="text-transfer-current-paid"
                              />
                            </>
                          )}
                          <BillingLine
                            label="Total paid (current stay)"
                            value={`LKR ${formatMoney(currentStayPaymentTotal)}`}
                            tone="success"
                            emphasized
                            testId="text-current-stay-paid"
                          />
                        </>
                      ) : hasCarriedForwardBalance ? (
                        <>
                          <BillingLine
                            label="Paid toward previous admission"
                            value={`LKR ${formatMoney(priorBalancePaid)}`}
                            tone="success"
                          />
                          <BillingLine
                            label="Paid toward current stay"
                            value={`LKR ${formatMoney(currentEpisodePaid)}`}
                            tone="success"
                          />
                        </>
                      ) : (
                        <>
                          {(payments ?? []).map((payment) => (
                            <BillingLine
                              key={payment.id}
                              label={formatInpatientPaymentTimestamp(payment)}
                              value={`LKR ${formatMoney(payment.amount)}`}
                              tone="success"
                              sublabel={payment.paymentMode}
                            />
                          ))}
                          <BillingLine
                            label="Total Payments Recorded"
                            value={`LKR ${formatMoney(paymentTotal)}`}
                            tone="success"
                            emphasized
                            testId="text-total-paid"
                          />
                        </>
                      )}
                      {overpaymentCredit > 0 && (
                        <BillingLine
                          label="Overpayment / Credit"
                          value={`LKR ${formatMoney(overpaymentCredit)}`}
                          tone="credit"
                          sublabel="Paid more than total bill"
                          testId="text-overpayment-credit"
                        />
                      )}
                    </BillingSection>

                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Balance</p>
                      {hasPriorPendingInSummary && priorPendingForCurrentAdmission > 0 && (
                        <BillingLine
                          label="Previous admission due"
                          value={`LKR ${formatMoney(priorPendingForCurrentAdmission)}`}
                          tone="danger"
                          testId="text-prior-balance-due-inline"
                        />
                      )}
                      {hasPriorPendingInSummary && priorPendingForCurrentAdmission < 0 && (
                        <BillingLine
                          label="Previous admission credit"
                          value={`LKR ${formatMoney(Math.abs(priorPendingForCurrentAdmission))}`}
                          tone="credit"
                          testId="text-prior-balance-credit-inline"
                        />
                      )}
                      {!hasPriorPendingInSummary && (
                        <DueBalanceBanner due={netBalanceDue} testId="text-balance-due" />
                      )}
                      {hasPriorPendingInSummary && (
                        <>
                          {currentBalanceDue !== 0 && (
                            <BillingLine
                              label={currentBalanceDue > 0 ? "Current stay due" : "Current stay credit"}
                              value={
                                currentBalanceDue > 0
                                  ? `LKR ${formatMoney(currentBalanceDue)}`
                                  : `LKR ${formatMoney(Math.abs(currentBalanceDue))}`
                              }
                              tone={currentBalanceDue > 0 ? "danger" : "credit"}
                              testId="text-current-balance-due"
                            />
                          )}
                          <DueBalanceBanner due={netBalanceDue} testId="text-total-balance-due" />
                        </>
                      )}
                    </div>

                    <div
                      className="rounded-lg border border-[#B8D4E8] bg-[#F8FBFE] px-3 py-2.5 text-xs text-slate-700"
                      data-testid="text-stay-summary"
                    >
                      Admitted: {format(new Date(patient.admitDate), "dd MMM yyyy")} →{" "}
                      {discharge
                        ? `Discharged: ${format(new Date(discharge.dischargeDate), "dd MMM yyyy")}`
                        : "Today"}
                      {" | "}
                      <strong>
                        {stayDays} day{stayDays !== 1 ? "s" : ""}
                      </strong>
                    </div>
                  </div>
                )}

                {showBillingHistoryToggle && !showingPreviousBilling && hasPriorAdjustment && (
                  <p
                    className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                      hasCarriedForwardCredit
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                    data-testid="text-prior-balance-note"
                  >
                    {hasCarriedForwardCredit
                      ? `Previous overpayment credit of LKR ${formatMoney(carriedForwardCreditApplied)} has been auto-deducted from this bill.`
                      : hasTransferHistory
                        ? "Current stay payments are applied to the previous branch balance first, then to the current stay."
                        : "Payments are applied to the previous admission balance first, then to the current stay."}{" "}
                    Switch to <span className="font-semibold">Previous</span> for the full discharge bill breakdown.
                  </p>
                )}
              </div>
            </div>

            {discharge && !showingPreviousBilling && (
              <div className="rounded-xl bg-blue-50 p-3 sm:p-4" data-testid="discharge-summary">
                <h3 className="mb-3 text-sm font-semibold text-[#105691] sm:text-base">Discharge Summary</h3>
                <div className="rounded-lg bg-white p-3 shadow-sm sm:p-4">
                  <BillingLine
                    label="Discharge Date"
                    value={format(new Date(discharge.dischargeDate), "dd MMM yyyy")}
                  />
                  <BillingLine label="Days Stayed" value={`${breakdown.stayDays} days`} />
                  <BillingLine label="Room Charges" value={`LKR ${formatMoney(breakdown.roomCharges)}`} />
                  {breakdown.caretakerCharges > 0 && (
                    <BillingLine label="Caretaker Charges" value={`LKR ${formatMoney(breakdown.caretakerCharges)}`} />
                  )}
                  {breakdown.extraExpenseTotal > 0 && (
                    <BillingLine label="Extra Expenses" value={`LKR ${formatMoney(breakdown.extraExpenseTotal)}`} />
                  )}
                  {breakdown.carriedForwardTotal > 0 && (
                    <BillingLine
                      label="Previous Admission Balance"
                      value={`LKR ${formatMoney(breakdown.carriedForwardTotal)}`}
                    />
                  )}
                  {breakdown.deductionAmount > 0 && (
                    <BillingLine
                      label={`${deductionLabel}${(patient as any).deductionReason ? "" : ""}`}
                      value={`- LKR ${formatMoney(breakdown.deductionAmount)}`}
                      tone="danger"
                      sublabel={(patient as any).deductionReason || undefined}
                    />
                  )}
                  <BillingLine
                    label="Total Bill"
                    value={`LKR ${formatMoney(grandTotal)}`}
                    emphasized
                  />
                  <BillingLine
                    label="Amount Paid"
                    value={`LKR ${formatMoney(hasTransferHistory ? currentStayPaymentTotal : effectivePaymentTotal)}`}
                    tone="success"
                  />
                  <div className="mt-2">
                    <DueBalanceBanner due={dischargeBalance} testId="text-discharge-balance" />
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-muted-foreground">Payment Status</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        dischargeBalance <= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {dischargeBalance <= 0 ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        <div className="mb-6" data-testid="extra-expenses-section">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">Extra Expenses</h2>
            <Button
              size="compact"
              onClick={openAddExpenseModal}
              data-testid="button-add-expense"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {!displayExtraExpenses || displayExtraExpenses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="text-no-expenses">
              No extra expenses recorded
            </div>
          ) : (
            <div className="space-y-2">
              {displayExtraExpenses.map((expense: InPatientExtraExpense) => (
                <div key={expense.id} className="border rounded-lg p-3 text-sm" data-testid={`expense-${expense.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                      </span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs" data-testid={`expense-category-${expense.id}`}>
                        {expense.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" data-testid={`expense-amount-${expense.id}`}>
                        LKR {parseFloat(expense.amount).toLocaleString()}
                      </span>
                      {isAdminMD && !expense.id.startsWith("live-carried-forward-") && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditExpenseModal(expense)}
                            data-testid={`button-edit-expense-${expense.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500"
                            onClick={() => setDeleteExpenseId(expense.id)}
                            data-testid={`button-delete-expense-${expense.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {expense.description && (
                    <div className="text-muted-foreground text-xs" data-testid={`expense-description-${expense.id}`}>
                      {expense.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1" data-testid={`expense-staff-${expense.id}`}>
                    Added by: {expense.createdByStaffName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6" data-testid="treatment-sessions-section">
          <div className="mb-4 space-y-3">
            <h2 className="text-lg font-semibold">
              {showingPreviousSessions ? "Previous Sessions" : "Treatment Sessions"}
            </h2>
            {showSessionsHistoryToggle && (
              <SegmentedToggle
                value={sessionsView}
                onChange={setSessionsView}
                options={[
                  {
                    value: "current",
                    label: "Current Sessions",
                    mobileLabel: "Current",
                    testId: "button-current-sessions",
                  },
                  {
                    value: "previous",
                    label: "Previous Sessions",
                    mobileLabel: "Previous",
                    testId: "button-previous-sessions",
                  },
                ]}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <StructuredReportActions
                layout="toolbar"
                reportTitle={
                  showingPreviousSessions
                    ? `Previous In-Patient Sessions - ${patient?.patientName || "Patient"}`
                    : `In-Patient Sessions - ${patient?.patientName || "Patient"}`
                }
                fileBaseName={`inpatient-sessions-${patientId.substring(0, 8)}${showingPreviousSessions ? "-previous" : ""}`}
                columns={[
                  { label: "Date", key: "date" },
                  { label: "Time", key: "time" },
                  { label: "Session #", key: "sessionNumber" },
                  { label: "Branch", key: "branch" },
                  { label: "Treatment", key: "treatmentProvided" },
                  { label: "Therapist", key: "treatingStaffName" },
                  { label: "Improvements", key: "improvements" },
                  ...(showingPreviousSessions
                    ? [{ label: "Admission", key: "admissionLabel" }]
                    : []),
                ]}
                rows={displayedSessions.map((s) => ({
                  ...s,
                  date: format(new Date(s.sessionDate), "yyyy-MM-dd"),
                  time: [s.startTime, s.endTime].filter(Boolean).join(" - ") || "-",
                  branch: s.branchName || currentBranchLabel || "—",
                  improvements: s.improvements || "-",
                  admissionLabel: showingPreviousSessions
                    ? `${format(new Date((s as InPatientPreviousSession).admissionAdmitDate), "dd MMM yyyy")} (${(s as InPatientPreviousSession).admissionStatus})`
                    : "-",
                }))}
                logoUri={logoUri}
                meta={[
                  { label: "Patient", value: patient?.patientName || "—" },
                  { label: "Current Branch", value: currentBranchLabel },
                  { label: "Generated", value: format(new Date(), "dd MMM yyyy hh:mm a") },
                ]}
              />
              {canAddSession && !showingPreviousSessions && (
                <Button 
                  size="compact"
                  onClick={() => setLocation(`/inpatients/${patientId}/session/new`)}
                  data-testid="button-add-session"
                >
                  <Plus className="h-4 w-4" />
                  Add Session
                </Button>
              )}
            </div>
          </div>

          {showingPreviousSessions ? (
            previousAdmissionGroups.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground space-y-2" data-testid="text-no-previous-sessions">
                <p>No treatment sessions on previous admissions.</p>
                {priorEpisodes.length > 0 && (
                  <p className="text-xs">
                    {priorEpisodes.length} previous admission{priorEpisodes.length === 1 ? "" : "s"} on record.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {previousAdmissionGroups.map(([priorAdmissionId, group]) => {
                  const dates = Object.keys(group.sessionsByDate).sort((a, b) => b.localeCompare(a));
                  return (
                    <div key={priorAdmissionId} className="space-y-3" data-testid={`previous-admission-${priorAdmissionId}`}>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
                        <span className="font-medium text-amber-950">
                          Admission: {format(new Date(group.admitDate), "dd MMM yyyy")}
                        </span>
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-amber-900">
                          {group.status}
                        </span>
                      </div>
                      <div className="space-y-4">
                        {dates.map((date) => (
                          <div key={`${priorAdmissionId}-${date}`} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                              {format(new Date(date), "EEEE, dd MMM yyyy")} ({group.sessionsByDate[date].length} session{group.sessionsByDate[date].length > 1 ? "s" : ""})
                            </div>
                            <div className="divide-y">
                              <div className="hidden md:grid md:grid-cols-[1fr_1fr_2fr] gap-2 px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
                                <span>Patient Name</span>
                                <span>Physio</span>
                                <span>Session</span>
                              </div>
                              {group.sessionsByDate[date]
                                .sort((a, b) => a.sessionNumber - b.sessionNumber)
                                .map((session) => (
                                  <div
                                    key={session.id}
                                    className="p-3 md:grid md:grid-cols-[1fr_1fr_2fr] md:gap-2 md:items-start"
                                    data-testid={`previous-session-${session.id}`}
                                  >
                                    <div className="font-medium text-sm md:font-normal">{session.patientName}</div>
                                    <div className="text-sm text-muted-foreground md:text-foreground">
                                      <span className="md:hidden font-medium text-foreground">Physio: </span>
                                      {session.treatingStaffName}
                                    </div>
                                    <div className="text-sm min-w-0">
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                                        <Clock className="h-3 w-3 shrink-0" />
                                        #{session.sessionNumber} · {session.startTime}–{session.endTime}
                                      </div>
                                      <div className="line-clamp-3">{session.treatmentProvided}</div>
                                      {session.improvements ? (
                                        <div className="text-xs text-green-700 mt-1 line-clamp-2">{session.improvements}</div>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : sortedDates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="text-no-sessions">
              No sessions recorded yet
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((date) => (
                <div key={date} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-medium text-sm">
                    {format(new Date(date), "EEEE, dd MMM yyyy")} ({sessionsByDate[date].length} session{sessionsByDate[date].length > 1 ? "s" : ""})
                  </div>
                  <div className="divide-y">
                    <div className="hidden md:grid md:grid-cols-[1fr_1fr_2fr_auto] gap-2 px-3 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
                      <span>Patient Name</span>
                      <span>Physio</span>
                      <span>Session</span>
                      <span className="text-right pr-1">Edit</span>
                    </div>
                    {sessionsByDate[date]
                      .sort((a: InPatientSession, b: InPatientSession) => a.sessionNumber - b.sessionNumber)
                      .map((session: InPatientSession) => (
                      <div
                        key={session.id}
                        className="p-3 md:grid md:grid-cols-[1fr_1fr_2fr_auto] md:gap-2 md:items-start"
                        data-testid={`session-${session.id}`}
                      >
                        <div className="font-medium text-sm md:font-normal">{session.patientName}</div>
                        <div className="text-sm text-muted-foreground md:text-foreground">
                          <span className="md:hidden font-medium text-foreground">Physio: </span>
                          {session.treatingStaffName}
                        </div>
                        <div className="text-sm min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" />
                              #{session.sessionNumber} · {session.startTime}–{session.endTime}
                            </span>
                            {session.branchName ? (
                              <span
                                className="rounded-full bg-[#EEF5FB] px-2 py-0.5 text-[0.72rem] font-semibold text-[#105691]"
                                data-testid={`session-branch-${session.id}`}
                              >
                                {session.branchName}
                              </span>
                            ) : null}
                          </div>
                          <div className="line-clamp-3">{session.treatmentProvided}</div>
                          {session.improvements ? (
                            <div className="text-xs text-green-700 mt-1 line-clamp-2">{session.improvements}</div>
                          ) : null}
                        </div>
                        <div className="flex justify-end pt-2 md:pt-0 gap-1 flex-wrap">
                          {canEditInPatientSession ? (
                            <>
                              <Button type="button" variant="outline" size="sm" onClick={() => openSessionEdit(session)} data-testid={`button-edit-session-${session.id}`}>
                                Edit
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive hover:text-white" onClick={() => { setSessionToDelete(session.id); setDeleteDialogOpen(true); }} data-testid={`button-delete-session-${session.id}`}>
                                Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canViewPayments && (
          <div className="bg-green-50 rounded-lg p-4 mb-6" data-testid="payment-section">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payments
              </h3>
              {canAddPayment && (
                <Button 
                  size="compact"
                  onClick={() => setShowPaymentModal(true)}
                  data-testid="button-add-payment"
                >
                  <Plus className="h-4 w-4" />
                  Add Payment
                </Button>
              )}
            </div>

            <div className="bg-white rounded-lg p-3 mb-4 border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">
                  {hasTransferHistory ? "Paid (current stay):" : "Payment Done (Total):"}
                </span>
                <span className="font-bold text-lg text-green-700" data-testid="text-payment-total">
                  LKR{" "}
                  {(hasTransferHistory ? currentStayPaymentTotal : paymentTotal).toLocaleString()}
                </span>
              </div>
            </div>

            {(hasTransferHistory ? currentStayPayments : payments) &&
            (hasTransferHistory ? currentStayPayments : payments)!.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {hasTransferHistory ? "Current stay payments:" : "Payment History:"}
                </div>
                {(hasTransferHistory ? currentStayPayments : payments)!.map((payment: InPatientPayment) => (
                  <div key={payment.id} className="bg-white rounded p-3 border text-sm" data-testid={`payment-${payment.id}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-700 text-sm">
                        {formatInpatientPaymentTimestamp(payment)} — {payment.paymentMode}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#16A34A] text-sm tabular-nums">
                          + LKR{" "}
                          {parseFloat(payment.amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </span>
                        {isAdminMD && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditPayment(payment)}
                            title="Edit payment"
                            data-testid={`button-edit-payment-${payment.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground text-xs">By: {payment.createdByName}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{payment.paymentMode}</span>
                    </div>
                    {payment.notes && (
                      <div className="text-xs text-muted-foreground mt-1">{payment.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : hasTransferHistory ? (
              <div className="text-sm text-muted-foreground py-2" data-testid="text-no-current-payments">
                No payments recorded for the current stay yet.
              </div>
            ) : null}
          </div>
        )}

        {canDischarge && (
          <Button 
            className="w-full h-12"
            onClick={() => setLocation(`/inpatients/${patientId}/discharge`)}
            data-testid="button-discharge"
          >
            Discharge Patient
          </Button>
        )}

        {/* Bug 4: transfer the in-patient to another branch (all staff, admitted patients). */}
        {canTransfer && patient?.status === "Admitted" && (
          <Button
            className="w-full h-12"
            variant="outline"
            onClick={() => setTransferOpen(true)}
            data-testid="button-transfer-branch"
          >
            Transfer to Branch
          </Button>
        )}

        <Dialog
          open={transferOpen}
          onOpenChange={(open) => {
            setTransferOpen(open);
            if (!open) {
              setTransferBranchId("");
              setTransferNote("");
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer to another branch</DialogTitle>
              <DialogDescription>
                The patient's full treatment history stays intact — only the current branch changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Destination Branch</Label>
                <Select value={transferBranchId} onValueChange={setTransferBranchId} modal={false}>
                  <SelectTrigger data-testid="select-transfer-branch">
                    <SelectValue placeholder={transferBranchesLoading ? "Loading branches..." : "Select branch"} />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!transferBranchesLoading && transferBranchesError && (
                  <p className="text-xs text-destructive" data-testid="text-transfer-branches-error">
                    Could not load branches. Please try again.
                  </p>
                )}
                {!transferBranchesLoading && !transferBranchesError && destinationBranches.length === 0 && (
                  <p className="text-xs text-amber-700" data-testid="text-no-transfer-branches">
                    No other branches are available for transfer.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-date">Transfer Date</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={transferDate}
                  max={todayStr}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="h-11"
                  data-testid="input-transfer-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-note">Note (optional)</Label>
                <Textarea
                  id="transfer-note"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Reason for transfer"
                  data-testid="input-transfer-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button onClick={handleTransfer} disabled={transferInPatient.isPending} data-testid="button-confirm-transfer">
                {transferInPatient.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bug 4: branch transfer history timeline. */}
        {(transferLogs as any[]).length > 0 && (
          <div className="rounded-lg border border-border/60 bg-white p-4">
            <h3 className="font-semibold mb-3 text-sm">Branch Transfer History</h3>
            <div className="space-y-2">
              {(transferLogs as any[]).map((t) => (
                <div key={t.id} className="text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="font-medium">
                    {t.fromBranchName || "—"} → {t.toBranchName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.transferDate}{t.transferredByName ? ` · by ${t.transferredByName}` : ""}
                    {t.transferNote ? ` · ${t.transferNote}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {canReadmit && (
          <>
            <Button
              className="w-full h-12"
              variant="outline"
              disabled={readmitInPatient.isPending}
              onClick={() => setReadmitOpen(true)}
              data-testid="button-readmit"
            >
              {readmitInPatient.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Re-admit Patient"
              )}
            </Button>

            <AlertDialog open={readmitOpen} onOpenChange={setReadmitOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-admit this patient?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will open a new admission so sessions can be added again.
                  Choose the admit date (today or a past date).
                </AlertDialogDescription>
              </AlertDialogHeader>
              {totalPastDue > 0 ? (
                <div
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-1"
                  data-testid="readmit-past-due-warning"
                >
                  <div className="flex items-center gap-2 font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Past due amount
                  </div>
                  {pastDueAdmission > 0 && (
                    <p className="text-amber-900">
                      Previous admission balance: <span className="font-bold">LKR {formatMoney(pastDueAdmission)}</span>
                    </p>
                  )}
                  {pastDueOutpatient > 0 && (
                    <p className="text-amber-900">
                      Outpatient visit balance: <span className="font-bold">LKR {formatMoney(pastDueOutpatient)}</span>
                    </p>
                  )}
                  <p className="text-red-700 font-bold pt-1">
                    Total due: LKR {formatMoney(totalPastDue)}
                  </p>
                  <p className="text-xs text-amber-800/90 pt-1">
                    {pastDueAdmission > 0
                      ? "The previous admission balance will be added to the new admission billing as a carried-forward charge."
                      : "Outpatient visit balances remain on the patient visit records."}
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
                  data-testid="readmit-no-past-due"
                >
                  No past due balance on the previous admission.
                </div>
              )}
              {/* Bug 9: re-admit allows selecting a past/present admit date (no future). */}
              <div className="space-y-2">
                <Label htmlFor="readmit-date">Admit Date</Label>
                <Input
                  id="readmit-date"
                  type="date"
                  value={readmitDate || todayStr}
                  max={todayStr}
                  onChange={(e) => setReadmitDate(e.target.value)}
                  className="h-11"
                  data-testid="input-readmit-date"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReadmit}>Re-admit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Session</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this session? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSessionToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteSession.isPending}>
                {deleteSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Session"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                className="h-12"
                data-testid="input-payment-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Amount (LKR) *</Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
                className="h-12"
                data-testid="input-payment-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMode">Mode</Label>
              <Select 
                value={paymentForm.paymentMode} 
                onValueChange={(v) => setPaymentForm(prev => ({ ...prev, paymentMode: v as "Cash" | "Online" }))}
              >
                <SelectTrigger className="h-12" data-testid="select-payment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (optional)</Label>
              <Textarea
                id="paymentNotes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
                data-testid="input-payment-notes"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowPaymentModal(false)}
                data-testid="button-cancel-payment"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-12"
                onClick={handleAddPayment}
                disabled={createPayment.isPending}
                data-testid="button-save-payment"
              >
                {createPayment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPaymentModal} onOpenChange={setShowEditPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editPaymentDate">Date</Label>
              <Input
                id="editPaymentDate"
                type="date"
                value={editPaymentForm.paymentDate}
                onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPaymentAmount">Amount (LKR) *</Label>
              <Input
                id="editPaymentAmount"
                type="number"
                value={editPaymentForm.amount}
                onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPaymentMode">Mode</Label>
              <Select
                value={editPaymentForm.paymentMode}
                onValueChange={(v) => setEditPaymentForm((prev) => ({ ...prev, paymentMode: v as "Cash" | "Online" }))}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPaymentNotes">Notes (optional)</Label>
              <Textarea
                id="editPaymentNotes"
                value={editPaymentForm.notes}
                onChange={(e) => setEditPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowEditPaymentModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-12"
                onClick={handleEditPaymentSave}
                disabled={updatePayment.isPending}
              >
                {updatePayment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCaretakerRateModal} onOpenChange={setShowCaretakerRateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Caretaker Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="caretakerRate">Rate Per Day (LKR)</Label>
              <Input
                id="caretakerRate"
                type="number"
                value={caretakerRateForm.careTakerRatePerDay}
                onChange={(e) => setCaretakerRateForm(prev => ({ ...prev, careTakerRatePerDay: e.target.value }))}
                placeholder="Enter rate per day"
                className="h-12"
                data-testid="input-caretaker-rate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caretakerDaysOverride">Days Override (optional)</Label>
              <Input
                id="caretakerDaysOverride"
                type="number"
                value={caretakerRateForm.careTakerDaysOverride}
                onChange={(e) => setCaretakerRateForm(prev => ({ ...prev, careTakerDaysOverride: e.target.value }))}
                placeholder="Leave empty to use stay days"
                className="h-12"
                data-testid="input-caretaker-days-override"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => setShowCaretakerRateModal(false)}
                data-testid="button-cancel-caretaker-rate"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-12"
                onClick={handleSaveCaretakerRate}
                disabled={updateInPatient.isPending}
                data-testid="button-save-caretaker-rate"
              >
                {updateInPatient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bug 3: apply a fixed or percentage deduction against the bill subtotal. */}
      <Dialog open={showDeductionModal} onOpenChange={setShowDeductionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {targetHasDeduction
                ? "Edit Deduction"
                : deductionTargetSegment === "current"
                  ? "New Deduction"
                  : "Apply Deduction"}
            </DialogTitle>
            <DialogDescription>
              {deductionTargetSegment === "current"
                ? `Applied against the current stay subtotal of LKR ${formatMoney(currentSubtotal)}.`
                : "Applied against the previous branch stay subtotal."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deduction Type</Label>
              <Select
                value={deductionForm.deductionType}
                onValueChange={(v) => setDeductionForm((prev) => ({ ...prev, deductionType: v as "fixed" | "percentage" }))}
              >
                <SelectTrigger className="h-12" data-testid="select-deduction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount (LKR)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deductionValue">
                {deductionForm.deductionType === "percentage" ? "Percentage (%)" : "Amount (LKR)"}
              </Label>
              <Input
                id="deductionValue"
                type="number"
                min="0"
                value={deductionForm.deductionValue}
                onChange={(e) => setDeductionForm((prev) => ({ ...prev, deductionValue: e.target.value }))}
                placeholder={deductionForm.deductionType === "percentage" ? "e.g. 10" : "e.g. 500"}
                className="h-12"
                data-testid="input-deduction-value"
              />
              {(() => {
                const v = parseFloat(deductionForm.deductionValue) || 0;
                const priorTransferEpisodes = priorEpisodes
                  .filter((episode) => episode.episodeType === "transfer")
                  .sort((left, right) => left.admitDate.localeCompare(right.admitDate));
                const priorPreviewIndex =
                  deductionTargetSegment === "prior"
                    ? deductionSegment === "current"
                      ? priorTransferEpisodes.length - 1
                      : (deductionSegment as number)
                    : null;
                const deductionPreviewSubtotal =
                  deductionTargetSegment === "current"
                    ? currentSubtotal
                    : priorTransferEpisodes[priorPreviewIndex ?? 0]?.breakdown?.subtotal ?? currentSubtotal;
                const preview = computeDeductionAmount(
                  deductionPreviewSubtotal,
                  deductionForm.deductionType,
                  v,
                );
                if (v <= 0) return null;
                const previewLabel =
                  deductionTargetSegment === "current" ? "Current stay" : "Prior branch stay";
                const newSegmentTotal = Math.max(0, deductionPreviewSubtotal - preview);
                const newTotalBill =
                  deductionTargetSegment === "current"
                    ? newSegmentTotal + carriedForwardTotal
                    : grandTotal - preview;
                return (
                  <p className="text-xs text-muted-foreground" data-testid="text-deduction-preview">
                    Deduction: - LKR {formatMoney(preview)} → {previewLabel}: LKR {formatMoney(newSegmentTotal)}
                    {deductionTargetSegment === "current" && hasCarriedForwardBalance
                      ? ` → Total bill: LKR ${formatMoney(newTotalBill)}`
                      : null}
                  </p>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deductionReason">Reason (optional)</Label>
              <Textarea
                id="deductionReason"
                value={deductionForm.deductionReason}
                onChange={(e) => setDeductionForm((prev) => ({ ...prev, deductionReason: e.target.value }))}
                placeholder="e.g. Loyalty discount, goodwill adjustment"
                data-testid="input-deduction-reason"
              />
            </div>

            <div className="flex gap-3 pt-2">
              {targetHasDeduction && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12 text-destructive"
                  onClick={handleClearDeduction}
                  disabled={setDeduction.isPending}
                  data-testid="button-clear-deduction"
                >
                  Remove
                </Button>
              )}
              <Button
                type="button"
                className="flex-1 h-12"
                onClick={handleSaveDeduction}
                disabled={setDeduction.isPending}
                data-testid="button-save-deduction"
              >
                {setDeduction.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExpenseModal} onOpenChange={(open) => { setShowExpenseModal(open); if (!open) setEditingExpense(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expenseDate">Date</Label>
              <Input
                id="expenseDate"
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                className="h-12"
                data-testid="input-expense-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseCategory">Category</Label>
              <Input
                id="expenseCategory"
                list="expense-category-list"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Select or type category"
                className="h-12"
                data-testid="input-expense-category"
              />
              <datalist id="expense-category-list">
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseAmount">Amount (LKR) *</Label>
              <Input
                id="expenseAmount"
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
                className="h-12"
                data-testid="input-expense-amount"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseDescription">Description (optional)</Label>
              <Textarea
                id="expenseDescription"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description..."
                rows={2}
                data-testid="input-expense-description"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12"
                onClick={() => { setShowExpenseModal(false); setEditingExpense(null); }}
                data-testid="button-cancel-expense"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-12"
                onClick={handleSaveExpense}
                disabled={createExtraExpense.isPending || updateExtraExpense.isPending}
                data-testid="button-save-expense"
              >
                {(createExtraExpense.isPending || updateExtraExpense.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingExpense ? "Update" : "Add"} Expense
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit in-patient session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="session-patient-name">Patient name</Label>
              <Input
                id="session-patient-name"
                value={sessionForm.patientName}
                onChange={(e) => setSessionForm((f) => ({ ...f, patientName: e.target.value }))}
                data-testid="input-session-patient-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-date">Date</Label>
              <Input
                id="session-date"
                type="date"
                value={sessionForm.sessionDate}
                onChange={(e) => setSessionForm((f) => ({ ...f, sessionDate: e.target.value }))}
                data-testid="input-session-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Assigned physiotherapist</Label>
              <Select
                value={sessionForm.treatingStaffId}
                onValueChange={(v) => setSessionForm((f) => ({ ...f, treatingStaffId: v }))}
              >
                <SelectTrigger data-testid="select-session-staff">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {getClinicalStaff(staffList as any[])
                    .map((s: { id: string; name: string }) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="session-start">Start</Label>
                <Input
                  id="session-start"
                  type="time"
                  value={sessionForm.startTime}
                  onChange={(e) => setSessionForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="session-end">End</Label>
                <Input
                  id="session-end"
                  type="time"
                  value={sessionForm.endTime}
                  onChange={(e) => setSessionForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-treatment">Session details</Label>
              <Textarea
                id="session-treatment"
                rows={4}
                value={sessionForm.treatmentProvided}
                onChange={(e) => setSessionForm((f) => ({ ...f, treatmentProvided: e.target.value }))}
                data-testid="textarea-session-treatment"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="session-improvements">Improvements (optional)</Label>
              <Textarea
                id="session-improvements"
                rows={2}
                value={sessionForm.improvements}
                onChange={(e) => setSessionForm((f) => ({ ...f, improvements: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setSessionDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveSession()} disabled={updateInPatientSession.isPending} data-testid="button-save-session">
                {updateInPatientSession.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteExpenseId} onOpenChange={(open) => { if (!open) setDeleteExpenseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-expense">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} data-testid="button-confirm-delete-expense">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
