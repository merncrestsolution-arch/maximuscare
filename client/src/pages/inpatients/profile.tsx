import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useInPatientSessions, useInPatientDischarge, useDeleteInPatient, useReadmitInPatient, useUpdateInPatientAdmitDate, useTransferInPatient, useInPatientTransfers, useInPatientPayments, useInPatientPaymentTotal, useCreateInPatientPayment, useInPatientExtraExpenses, useInPatientExtraExpenseTotal, useCreateInPatientExtraExpense, useUpdateInPatientExtraExpense, useDeleteInPatientExtraExpense, useUpdateInPatient, useTreatingStaff, useUpdateInPatientSession, useDeleteInPatientSession } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { downloadAuthenticatedFile } from "@/lib/api";
import { getClinicalStaff } from "@/components/staff/treating-staff-combobox";
import { useBranding } from "@/context/branding-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Phone, MapPin, Calendar, User, Clock, Trash2, Edit, Pencil, Plus, CreditCard, Receipt } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { formatMoney } from "@/lib/reportDatePresets";
import { useToast } from "@/hooks/use-toast";
import type { InPatientSession, InPatientDischarge, InPatientPayment, InPatientExtraExpense } from "@/lib/types";
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
import { isManager, isBranchManager } from "@/lib/permissions";
import { useBranches } from "@/hooks/useData";

const EXPENSE_CATEGORIES = ["Food", "Nurse Visit", "Doctor Visit", "Speech Therapy", "Others"];

export default function InPatientProfilePage() {
  const [, params] = useRoute("/inpatients/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { logoUri } = useBranding();
  const { toast } = useToast();
  const patientId = params?.id || "";

  const { data: patient, isLoading, error } = useInPatient(patientId);
  const { data: sessions } = useInPatientSessions(patientId);
  const { data: discharge } = useInPatientDischarge(patientId);
  const { data: payments } = useInPatientPayments(patientId);
  const { data: paymentTotalData } = useInPatientPaymentTotal(patientId);
  const { data: extraExpenses } = useInPatientExtraExpenses(patientId);
  const { data: extraExpenseTotalData } = useInPatientExtraExpenseTotal(patientId);
  const deleteInPatient = useDeleteInPatient();
  const readmitInPatient = useReadmitInPatient();
  const updateAdmitDate = useUpdateInPatientAdmitDate();
  const transferInPatient = useTransferInPatient();
  const { data: transferLogs = [] } = useInPatientTransfers(patientId);
  // Bug 4: transfer destinations span every active branch in the org (real DB ids).
  const { data: allBranches = [] } = useBranches();
  const transferBranchChoices = (allBranches as any[])
    .filter((b) => b.isActive !== false && b.isActive !== 0)
    .map((b) => ({ id: b.id, label: b.name }));
  const createPayment = useCreateInPatientPayment();
  const updateInPatient = useUpdateInPatient();
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

  const [showCaretakerRateModal, setShowCaretakerRateModal] = useState(false);
  const [caretakerRateForm, setCaretakerRateForm] = useState({
    careTakerRatePerDay: "",
    careTakerDaysOverride: "",
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
  const todayStr = format(new Date(), "yyyy-MM-dd");
  // Bug 4: branch transfer dialog state.
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferBranchId, setTransferBranchId] = useState("");
  const [transferDate, setTransferDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [transferNote, setTransferNote] = useState("");

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";
  const isReceptionist = user?.role === "Receptionist";
  // Bug 10: Managers / Branch Managers / Nexus MD may VIEW in-patient bills (branch-scoped,
  // read-only — no amount edits). Editing of amounts/caretaker rate stays Admin/MD only.
  const isBranchLead = ["Manager", "Branch Manager", "Nexus MD"].includes(user?.role || "");
  // Bug 4 (final spec): only Admin/MD may transfer an in-patient to another branch.
  const canTransfer = isAdminMD;
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
  const canReadmit = isAdminMD && patient?.status === "Discharged";

  const paymentTotal = paymentTotalData?.total || 0;
  const extraExpenseTotal = extraExpenseTotalData?.total || 0;

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

  const handleReadmit = async () => {
    try {
      await readmitInPatient.mutateAsync({ admissionId: patientId, admitDate: readmitDate || undefined });
      toast({ title: "Success", description: "Patient re-admitted" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to re-admit",
        variant: "destructive",
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

  const endDate = discharge ? new Date(discharge.dischargeDate) : new Date();
  const stayDays = Math.max(1, differenceInDays(endDate, new Date(patient.admitDate)) + 1);
  const amountPerDay = parseFloat(patient.amountPerDay) || 0;
  const roomCharges = amountPerDay * stayDays;
  const careTakerRate = parseFloat(patient.careTakerRatePerDay) || 0;
  const careTakerDays = patient.careTakerDaysOverride ? patient.careTakerDaysOverride : stayDays;
  const caretakerCharges = careTakerRate * careTakerDays;
  const grandTotal = roomCharges + caretakerCharges + extraExpenseTotal;
  const balanceDue = grandTotal - paymentTotal;
  const billingColumns = [
    { key: "item", label: "Item" },
    { key: "quantity", label: "Qty/Days" },
    { key: "rate", label: "Rate LKR" },
    { key: "amount", label: "Amount LKR" },
  ];
  const billingRows = [
    { item: "Room Charges", quantity: String(stayDays), rate: formatMoney(amountPerDay), amount: formatMoney(roomCharges) },
    { item: "Caretaker Charges", quantity: String(careTakerDays), rate: formatMoney(careTakerRate), amount: formatMoney(caretakerCharges) },
    { item: "Extra Expenses", quantity: "-", rate: "-", amount: formatMoney(extraExpenseTotal) },
    { item: "Grand Total", quantity: "-", rate: "-", amount: formatMoney(grandTotal) },
    { item: "Total Paid", quantity: "-", rate: "-", amount: formatMoney(paymentTotal) },
    { item: "Balance Due", quantity: "-", rate: "-", amount: formatMoney(balanceDue) },
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
          <>
        <StructuredReportActions
          reportTitle={`In-Patient Billing Report - ${patient.patientName}`}
          fileBaseName={`inpatient-billing-${patientId}`}
          columns={billingColumns}
          rows={billingRows}
          logoUri={logoUri}
          themeColor="#105691"
          meta={[
            { label: "Patient", value: patient.patientName },
            { label: "Patient ID", value: patient.id },
            { label: "Admit Date", value: format(new Date(patient.admitDate), "dd MMM yyyy") },
            { label: "Generated", value: format(new Date(), "dd MMM yyyy hh:mm a") },
            { label: "Prepared By", value: user?.name || "System" },
          ]}
        />
        <div id="inpatient-billing-report" className="space-y-4 rounded-lg border border-border/60 bg-white p-4 mb-6">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <img src={logoUri} alt="Clinic logo" className="h-10 w-10 rounded-md object-contain" />
              <div>
                <div className="text-sm font-bold text-foreground">Maximus Care</div>
                <div className="text-xs text-muted-foreground">In-Patient Billing Report</div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{patient.patientName}</div>
              <div>ID: {patient.id}</div>
            </div>
          </div>

          <div className="bg-[#EEF5FB] rounded-lg p-4" data-testid="billing-summary">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Billing Summary
            </h3>
            {/* Bug 3: use a real table so description (left) and LKR amounts (right) stay
                aligned across screen sizes and in print, instead of collapsing flex rows. */}
            <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "65%" }} />
                <col style={{ width: "35%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td className="py-1 text-left text-muted-foreground align-top">Stay Days</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap" data-testid="text-stay-days">{stayDays} day{stayDays > 1 ? "s" : ""}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-muted-foreground align-top">Room Charges ({formatMoney(amountPerDay)} × {stayDays})</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap" data-testid="text-room-charges">LKR {formatMoney(roomCharges)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-muted-foreground align-top">Caretaker Charges ({formatMoney(careTakerRate)} × {careTakerDays})</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap" data-testid="text-caretaker-charges">LKR {formatMoney(caretakerCharges)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-muted-foreground align-top">Extra Expenses</td>
                  <td className="py-1 text-right font-medium whitespace-nowrap" data-testid="text-extra-expenses-total">LKR {formatMoney(extraExpenseTotal)}</td>
                </tr>
                <tr className="border-t border-border/60">
                  <td className="pt-2 text-left font-semibold align-top">Grand Total</td>
                  <td className="pt-2 text-right font-bold whitespace-nowrap" data-testid="text-grand-total">LKR {formatMoney(grandTotal)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-left text-muted-foreground align-top">Total Paid</td>
                  <td className="py-1 text-right font-medium text-green-700 whitespace-nowrap" data-testid="text-total-paid">LKR {formatMoney(paymentTotal)}</td>
                </tr>
                <tr className="border-t border-border/60">
                  <td className="pt-2 text-left font-semibold align-top">Balance Due</td>
                  <td className={`pt-2 text-right font-bold whitespace-nowrap ${balanceDue > 0 ? "text-red-600" : "text-green-700"}`} data-testid="text-balance-due">LKR {formatMoney(balanceDue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {discharge && (
            <div className="bg-blue-50 rounded-lg p-4" data-testid="discharge-summary">
              <h3 className="font-semibold mb-3">Discharge Summary</h3>
              <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "65%" }} />
                  <col style={{ width: "35%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Discharge Date</td>
                    <td className="py-1 text-right font-medium whitespace-nowrap">{format(new Date(discharge.dischargeDate), "dd MMM yyyy")}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Days Stayed</td>
                    <td className="py-1 text-right font-medium whitespace-nowrap">{discharge.daysCount} days</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Stay Amount</td>
                    <td className="py-1 text-right font-medium whitespace-nowrap">LKR {formatMoney(Number(discharge.stayAmount))}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Other Charges</td>
                    <td className="py-1 text-right font-medium whitespace-nowrap">LKR {formatMoney(Number(discharge.otherTotal))}</td>
                  </tr>
                  <tr className="border-t border-border/60">
                    <td className="pt-2 text-left font-semibold align-top">Grand Total</td>
                    <td className="pt-2 text-right font-bold whitespace-nowrap">LKR {formatMoney(Number(discharge.grandTotal))}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Amount Paid</td>
                    <td className="py-1 text-right font-medium text-green-700 whitespace-nowrap">LKR {formatMoney(Number(discharge.amountPaid))}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Balance</td>
                    <td className={`py-1 text-right font-medium whitespace-nowrap ${parseFloat(discharge.balance) > 0 ? "text-red-600" : "text-green-700"}`}>LKR {formatMoney(Number(discharge.balance))}</td>
                  </tr>
                  <tr>
                    <td className="py-1 text-left text-muted-foreground align-top">Payment Status</td>
                    <td className="py-1 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        discharge.paymentStatus === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {discharge.paymentStatus}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}

        <div className="mb-6" data-testid="extra-expenses-section">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">Extra Expenses</h2>
            <Button
              size="sm"
              onClick={openAddExpenseModal}
              data-testid="button-add-expense"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {!extraExpenses || extraExpenses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="text-no-expenses">
              No extra expenses recorded
            </div>
          ) : (
            <div className="space-y-2">
              {extraExpenses.map((expense: InPatientExtraExpense) => (
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
                      {isAdminMD && (
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

        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">Treatment Sessions</h2>
            <div className="flex flex-wrap gap-2">
              <StructuredReportActions
                reportTitle={`In-Patient Sessions - ${patient?.patientName || 'Patient'}`}
                fileBaseName={`inpatient-sessions-${patientId.substring(0, 8)}`}
                columns={[
                  { label: "Date", key: "date" },
                  { label: "Time", key: "time" },
                  { label: "Session #", key: "sessionNumber" },
                  { label: "Treatment", key: "treatmentProvided" },
                  { label: "Therapist", key: "treatingStaffName" },
                  { label: "Improvements", key: "improvements" },
                ]}
                rows={(sessions || []).map(s => ({
                  ...s,
                  date: format(new Date(s.sessionDate), "yyyy-MM-dd"),
                  // Bug 2: show session time, surface Improvements, and drop the Notes field.
                  time: [s.startTime, s.endTime].filter(Boolean).join(" - ") || "-",
                  improvements: s.improvements || "-",
                }))}
                logoUri={logoUri}
              />
              {canAddSession && (
                <Button 
                  size="sm"
                  onClick={() => setLocation(`/inpatients/${patientId}/session/new`)}
                  data-testid="button-add-session"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Session
                </Button>
              )}
            </div>
          </div>

          {sortedDates.length === 0 ? (
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
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            #{session.sessionNumber} · {session.startTime}–{session.endTime}
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
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payments
              </h3>
              {canAddPayment && (
                <Button 
                  size="sm"
                  onClick={() => setShowPaymentModal(true)}
                  data-testid="button-add-payment"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Payment
                </Button>
              )}
            </div>

            <div className="bg-white rounded-lg p-3 mb-4 border">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Done (Total):</span>
                <span className="font-bold text-lg text-green-700" data-testid="text-payment-total">
                  LKR {paymentTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {payments && payments.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">Payment History:</div>
                {payments.map((payment: InPatientPayment) => (
                  <div key={payment.id} className="bg-white rounded p-3 border text-sm" data-testid={`payment-${payment.id}`}>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{format(new Date(payment.paymentDate), "dd MMM yyyy")}</span>
                      <span className="font-medium">LKR {parseFloat(payment.amount).toLocaleString()}</span>
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
            )}
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

        {/* Bug 4: transfer the in-patient to another branch (Admin/MD + branch leads). */}
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

        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer to another branch</DialogTitle>
              <DialogDescription>
                The patient's full treatment history stays intact — only the current branch changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Destination Branch</Label>
                <Select value={transferBranchId} onValueChange={setTransferBranchId}>
                  <SelectTrigger data-testid="select-transfer-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferBranchChoices
                      .filter((b) => b.id !== patient?.branchId)
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full h-12"
                variant="outline"
                disabled={readmitInPatient.isPending}
                data-testid="button-readmit"
              >
                {readmitInPatient.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Re-admit Patient"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-admit this patient?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will set the patient back to Admitted so new sessions can be added.
                  Choose the admit date (today or a past date).
                </AlertDialogDescription>
              </AlertDialogHeader>
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
