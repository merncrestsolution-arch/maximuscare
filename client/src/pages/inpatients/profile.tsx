import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useInPatient, useInPatientSessions, useInPatientDischarge, useDeleteInPatient, useInPatientPayments, useInPatientPaymentTotal, useCreateInPatientPayment, useInPatientExtraExpenses, useInPatientExtraExpenseTotal, useCreateInPatientExtraExpense, useUpdateInPatientExtraExpense, useDeleteInPatientExtraExpense, useUpdateInPatient, useTreatingStaff, useUpdateInPatientSession } from "@/hooks/useData";
import { useAuth } from "@/context/auth-context";
import { getClinicalStaff } from "@/components/staff/treating-staff-combobox";
import { useBranding } from "@/context/branding-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Phone, MapPin, Calendar, User, Clock, Trash2, Edit, Plus, CreditCard, Receipt } from "lucide-react";
import { format, differenceInDays } from "date-fns";
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
} from "@/components/ui/dialog";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";

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
  const createPayment = useCreateInPatientPayment();
  const updateInPatient = useUpdateInPatient();
  const createExtraExpense = useCreateInPatientExtraExpense();
  const updateExtraExpense = useUpdateInPatientExtraExpense();
  const deleteExtraExpense = useDeleteInPatientExtraExpense();
  const { data: staffList = [] } = useTreatingStaff();
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

  const isAdminMD = user?.role === "Admin" || user?.role === "MD";
  const isReceptionist = user?.role === "Receptionist";
  const canViewPayments = isAdminMD || isReceptionist;
  /** Billing summary + billing PDF — Admin & MD only (hidden from physiotherapy staff). */
  const canViewBillingSummary = isAdminMD;
  const canEditInPatientSession = ["Admin", "MD", "Physiotherapist", "Staff", "Receptionist"].includes(user?.role || "");
  const canAddPayment = canViewPayments;
  const canAddSession = patient?.status === "Admitted";
  const canDischarge = isAdminMD && patient?.status === "Admitted";

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
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive"
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
    { item: "Room Charges", quantity: String(stayDays), rate: String(amountPerDay), amount: String(roomCharges) },
    { item: "Caretaker Charges", quantity: String(careTakerDays), rate: String(careTakerRate), amount: String(caretakerCharges) },
    { item: "Extra Expenses", quantity: "-", rate: "-", amount: String(extraExpenseTotal) },
    { item: "Grand Total", quantity: "-", rate: "-", amount: String(grandTotal) },
    { item: "Total Paid", quantity: "-", rate: "-", amount: String(paymentTotal) },
    { item: "Balance Due", quantity: "-", rate: "-", amount: String(balanceDue) },
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
                      <AlertDialogTitle>Delete In-Patient Record?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this admission record and all associated sessions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
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
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Admitted:</span>
            <span className="font-medium" data-testid="text-admit-date">
              {format(new Date(patient.admitDate), "dd MMM yyyy")}
            </span>
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
                <span className="text-xs text-muted-foreground" data-testid="text-caretaker-days-override">
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
          themeColor="#0F766E"
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

          <div className="bg-blue-50 rounded-lg p-4" data-testid="billing-summary">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Billing Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-muted-foreground">Stay Days:</span>
                <span className="font-medium" data-testid="text-stay-days">{stayDays} day{stayDays > 1 ? "s" : ""}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-muted-foreground break-words min-w-0">Room Charges ({amountPerDay.toLocaleString()} × {stayDays}):</span>
                <span className="font-medium shrink-0" data-testid="text-room-charges">LKR {roomCharges.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-muted-foreground break-words min-w-0">
                  Caretaker Charges ({careTakerRate.toLocaleString()} × {careTakerDays}):
                </span>
                <span className="font-medium shrink-0" data-testid="text-caretaker-charges">
                  LKR {caretakerCharges.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-muted-foreground">Extra Expenses:</span>
                <span className="font-medium" data-testid="text-extra-expenses-total">LKR {extraExpenseTotal.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center border-t pt-2 mt-2">
                <span className="font-semibold">Grand Total:</span>
                <span className="font-bold" data-testid="text-grand-total">LKR {grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center">
                <span className="text-muted-foreground">Total Paid:</span>
                <span className="font-medium text-green-700" data-testid="text-total-paid">LKR {paymentTotal.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:items-center border-t pt-2 mt-2">
                <span className="font-semibold">Balance Due:</span>
                <span className={`font-bold ${balanceDue > 0 ? "text-red-600" : "text-green-700"}`} data-testid="text-balance-due">
                  LKR {balanceDue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {discharge && (
            <div className="bg-blue-50 rounded-lg p-4" data-testid="discharge-summary">
              <h3 className="font-semibold mb-3">Discharge Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discharge Date:</span>
                  <span className="font-medium">{format(new Date(discharge.dischargeDate), "dd MMM yyyy")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Stayed:</span>
                  <span className="font-medium">{discharge.daysCount} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stay Amount:</span>
                  <span className="font-medium">LKR {discharge.stayAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Charges:</span>
                  <span className="font-medium">LKR {discharge.otherTotal}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-semibold">Grand Total:</span>
                  <span className="font-bold">LKR {discharge.grandTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid:</span>
                  <span className="font-medium text-green-700">LKR {discharge.amountPaid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance:</span>
                  <span className={`font-medium ${parseFloat(discharge.balance) > 0 ? "text-red-600" : "text-green-700"}`}>
                    LKR {discharge.balance}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status:</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    discharge.paymentStatus === "Paid" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {discharge.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
          </>
        )}

        <div className="mb-6" data-testid="extra-expenses-section">
          <div className="flex items-center justify-between mb-4">
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Treatment Sessions</h2>
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
                        <div className="flex justify-end pt-2 md:pt-0">
                          {canEditInPatientSession ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => openSessionEdit(session)} data-testid={`button-edit-session-${session.id}`}>
                              Edit
                            </Button>
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
