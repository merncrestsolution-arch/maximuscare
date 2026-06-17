import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { usePatient, useVisits, useDeleteVisit, useDeletePatient, useUpdatePatient, usePatientStats, usePatientNotes, usePatientDocuments, useCreatePatientNote, useCreatePatientDocument } from "@/hooks/useData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CollectPaymentDialog } from "@/components/patients/collect-payment-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Edit2, Pencil, FileText, Phone, MapPin, Calendar, User as UserIcon, Loader2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { useBranding } from "@/context/branding-context";
import { useToast } from "@/hooks/use-toast";
import { StructuredReportActions } from "@/components/reports/structured-report-actions";
import { isPaidStatus, paymentStatusBadgeClass, computeOutstanding, isUnpaidLikeStatus } from "@/lib/paymentStatus";
import { formatLkr } from "@/lib/reportDatePresets";
import { Banknote, Plus } from "lucide-react";
import { openAuthenticatedFile, patientsApiExtended } from "@/lib/api";

export default function PatientProfile() {
  const [match, params] = useRoute("/patients/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { logoUri } = useBranding();
  const patientId = params?.id || "";
  
  const { data: patient, isLoading: patientLoading, error: patientError } = usePatient(patientId);
  const { data: allVisits = [] } = useVisits({ patientId });
  const { data: stats } = usePatientStats(patientId);
  const { data: notes = [] } = usePatientNotes(patientId);
  const { data: documents = [] } = usePatientDocuments(patientId);
  const deleteVisitMutation = useDeleteVisit();
  const deletePatientMutation = useDeletePatient();
  const updatePatientMutation = useUpdatePatient();
  const createNote = useCreatePatientNote();
  const createDocument = useCreatePatientDocument();
  const { toast } = useToast();
  const [visitToDeleteId, setVisitToDeleteId] = useState<string | null>(null);
  const [paymentVisit, setPaymentVisit] = useState<any>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [docType, setDocType] = useState("Medical Report");
  const [docFileName, setDocFileName] = useState("");
  const [docFileUri, setDocFileUri] = useState("");
  
  if (!match || !params) return null;

  if (patientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-center py-8 text-muted-foreground">
          Patient not found
        </div>
        <Button variant="outline" onClick={() => setLocation('/patients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Patients
        </Button>
      </div>
    );
  }

  const patientVisits = allVisits
    .sort((a: any, b: any) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const visitColumns = [
    { key: "date", label: "Date" },
    { key: "session", label: "Session" },
    { key: "condition", label: "Condition" },
    { key: "treatment", label: "Treatment" },
    { key: "staff", label: "Treating Staff" },
    { key: "status", label: "Status" },
    { key: "paymentStatus", label: "Payment" },
    { key: "paymentAmount", label: "Amount LKR" },
  ];
  const visitRows = patientVisits.map((v: any) => ({
    date: format(new Date(v.visitDate), "yyyy-MM-dd"),
    session: String(v.sessionNumber),
    condition: v.condition || "",
    treatment: v.treatment || "",
    staff: v.treatingStaffName || v.createdByName || "",
    status: v.status || "",
    paymentStatus: v.paymentStatus || "",
    paymentAmount: String(v.paymentAmount ?? ""),
  }));

  const handleConfirmDeleteVisit = async () => {
    if (!visitToDeleteId) return;
    try {
      await deleteVisitMutation.mutateAsync(visitToDeleteId);
      toast({ title: "Visit deleted", description: "The visit record was removed." });
    } catch (e) {
      toast({
        title: "Could not delete visit",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
    setVisitToDeleteId(null);
  };

  const isAdminMD = ["Admin", "MD"].includes(user?.role || "");
  const canCollectPayment = ["Admin", "MD", "Receptionist"].includes(user?.role || "");

  const handleDocFile = (file: File | null) => {
    if (!file) return;
    setDocFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") setDocFileUri(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePatient = async () => {
    try {
      await deletePatientMutation.mutateAsync(patientId);
      toast({ title: "Patient deleted", description: "All visits and appointments for this patient were removed." });
      setLocation("/patients");
    } catch (e) {
      toast({
        title: "Could not delete patient",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 border-b">
        <Button variant="ghost" size="icon" className="-ml-2" onClick={() => setLocation('/patients')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold truncate flex-1">{patient.name}</h1>
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/patients/${patient.id}/edit`}>
            <Button variant="ghost" size="icon" data-testid="button-edit-patient">
              <Edit2 className="h-5 w-5 text-primary" />
            </Button>
          </Link>
          {isAdminMD && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-patient"
                  disabled={deletePatientMutation.isPending}
                >
                  {deletePatientMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this patient?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the patient record, all visit history, and any appointments linked to them.
                    This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeletePatient}
                  >
                    Delete patient
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-none">
        <CardContent className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{patient.name}</h2>
              {patient.patientCode && (
                <p className="text-xs text-muted-foreground font-mono">Patient ID: {patient.patientCode}</p>
              )}
              <div className="flex items-center gap-2 mt-1 text-muted-foreground font-medium">
                 <Phone className="h-3.5 w-3.5" />
                 <span>{patient.phone}</span>
              </div>
              {stats?.assignedTherapistName && (
                <p className="text-xs text-muted-foreground mt-1">Therapist: {stats.assignedTherapistName}</p>
              )}
            </div>
            <div className="text-right">
              <span className="block text-xl font-bold text-primary">
                {patient.age != null && patient.age > 0 ? (
                  <>
                    {patient.age} <span className="text-sm font-normal text-muted-foreground">Years</span>
                  </>
                ) : (
                  <span className="text-sm font-normal text-muted-foreground">Age N/A</span>
                )}
              </span>
              <span className="text-sm text-muted-foreground">{patient.gender}</span>
            </div>
          </div>
          
          <div className="pt-3 border-t border-primary/10 flex flex-wrap gap-2">
             <Badge
               variant="outline"
               className="bg-background/50 border-primary/20 text-foreground flex items-center gap-1"
               data-testid="badge-patient-branch"
             >
               <MapPin className="h-3 w-3 text-primary" /> {patient.branch}
             </Badge>
             {patient.defaultVisitType && (
               <Badge
                 className="bg-black text-white"
                 data-testid="badge-patient-default-visit-type"
               >
                 {patient.defaultVisitType === 'Clinic' ? 'Clinic Visit' : 'Home Visit'}
               </Badge>
             )}
             {patient.condition && (
               <Badge
                 variant="secondary"
                 className="bg-muted/20 text-foreground"
                 data-testid="badge-patient-condition"
               >
                 {patient.condition}
               </Badge>
             )}
             <Badge className={patient.status === 'Active' ? 'bg-success' : 'bg-muted'} data-testid="badge-patient-status">
               {patient.status}
             </Badge>
             {patient.status === "Discharged" && ["Admin", "MD", "Receptionist"].includes(user?.role ?? "") && (
               <Button
                 size="sm"
                 variant="outline"
                 className="h-7"
                 data-testid="button-readmit-patient"
                 onClick={async () => {
                   try {
                     await updatePatientMutation.mutateAsync({
                       id: patientId,
                       data: { status: "Active", registeredDate: new Date().toISOString().slice(0, 10) },
                     });
                     toast({ title: "Patient re-admitted", description: "Status set to Active with a new admission date." });
                   } catch (e: any) {
                     toast({ title: "Error", description: e?.message || "Failed to re-admit patient", variant: "destructive" });
                   }
                 }}
               >
                 Re-Admit Patient
               </Button>
             )}
          </div>
          
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 pt-1">
            <MapPin className="h-3.5 w-3.5 opacity-70" /> {patient.address}
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-sm">
          <Card><CardContent className="p-3"><div className="font-bold">{stats.totalVisits}</div><div className="text-muted-foreground text-xs">Visits</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="font-bold">{stats.totalSessions}</div><div className="text-muted-foreground text-xs">Sessions</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="font-bold">Rs.{stats.totalRevenue?.toLocaleString()}</div><div className="text-muted-foreground text-xs">Revenue</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="font-bold text-amber-700">Rs.{stats.outstandingAmount?.toLocaleString()}</div><div className="text-muted-foreground text-xs">Outstanding</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="font-bold text-xs">{stats.lastVisitDate || "—"}</div><div className="text-muted-foreground text-xs">Last Visit</div></CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="visits" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-3 pt-4">
          <Card><CardContent className="p-4 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Registered:</span> {patient.registeredDate}</p>
            <p><span className="text-muted-foreground">Address:</span> {patient.address}</p>
            {(patient as any).emergencyContact && <p><span className="text-muted-foreground">Emergency:</span> {(patient as any).emergencyContact}</p>}
            {(patient as any).referralSource && <p><span className="text-muted-foreground">Referral:</span> {(patient as any).referralSource}</p>}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="notes" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add Note</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Title</Label><Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" /></div>
              <div><Label>Description</Label><Textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} rows={3} /></div>
              <Button size="sm" disabled={!noteTitle.trim() || createNote.isPending} onClick={() => {
                createNote.mutate({ patientId, title: noteTitle.trim(), description: noteDescription.trim() }, {
                  onSuccess: () => { setNoteTitle(""); setNoteDescription(""); toast({ title: "Note added" }); },
                  onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
                });
              }}>Save Note</Button>
            </CardContent>
          </Card>
          {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
            <ul className="space-y-2">{notes.map((n: any) => (
              <li key={n.id} className="border rounded-lg p-3"><div className="font-medium">{n.title}</div><p className="text-sm text-muted-foreground">{n.description}</p><p className="text-xs mt-1">{n.createdByName} · {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}</p></li>
            ))}</ul>
          )}
        </TabsContent>
        <TabsContent value="documents" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Upload Document</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Document type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Medical Report", "Prescription", "X-Ray", "Scan", "Other"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File</Label>
                <Input type="file" accept="image/*,.pdf" onChange={(e) => handleDocFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button size="sm" disabled={!docFileUri || createDocument.isPending} onClick={() => {
                createDocument.mutate({
                  patientId,
                  fileName: docFileName || "document",
                  documentType: docType,
                  contentBase64: docFileUri,
                }, {
                  onSuccess: () => { setDocFileUri(""); setDocFileName(""); toast({ title: "Document uploaded" }); },
                  onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
                });
              }}>Upload</Button>
            </CardContent>
          </Card>
          {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded.</p> : (
            <ul className="space-y-2">{documents.map((d: any) => (
              <li key={d.id} className="border rounded-lg p-3 flex justify-between"><div><div className="font-medium">{d.fileName}</div><div className="text-xs text-muted-foreground">{d.documentType} · {d.uploadedByName}</div></div><button type="button" className="text-primary text-sm hover:underline" onClick={() => openAuthenticatedFile(patientsApiExtended.documents.filePath(d.id)).catch((e: Error) => toast({ title: e.message, variant: "destructive" }))}>View</button></li>
            ))}</ul>
          )}
        </TabsContent>
        <TabsContent value="visits" className="pt-0">
      <StructuredReportActions
        reportTitle={`Patient Visit History - ${patient.name}`}
        fileBaseName={`patient-visit-history-${patient.id}`}
        columns={visitColumns}
        rows={visitRows}
        logoUri={logoUri}
        themeColor="#7C3AED"
        meta={[
          { label: "Patient", value: patient.name },
          { label: "Patient ID", value: patient.id },
          { label: "Generated", value: format(new Date(), "dd MMM yyyy hh:mm a") },
          { label: "Prepared By", value: user?.name || "System" },
        ]}
      />
      {/* Timeline / Visits */}
      <div id="patient-visit-history-report" className="space-y-4 rounded-lg border border-border/60 bg-white p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoUri} alt="Clinic logo" className="h-10 w-10 rounded-md object-contain" />
            <div>
              <div className="text-sm font-bold text-foreground">Maximus Care</div>
              <div className="text-xs text-muted-foreground">Patient Visit History</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            <div>{patient.name}</div>
            <div>{patient.id}</div>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" /> 
            Visit History
          </h3>
          <Link href={`/visits/new?patientId=${patient.id}`}>
             <Button size="sm" className="shadow-sm font-semibold">Add New Visit</Button>
          </Link>
        </div>

        <div className="relative pl-4 border-l-2 border-muted/30 space-y-6 ml-2">
          {patientVisits.map((visit) => {
            const isManagement = ['Admin', 'MD'].includes(user?.role || '');
            const isPhysioRole = ['Physiotherapist', 'Staff'].includes(user?.role || '');
            const canEditVisit =
              isManagement ||
              isPhysioRole ||
              visit.treatingStaffId === user?.id ||
              visit.createdByStaffId === user?.id;
            const paidAmount = Number(visit.paymentAmount);
            const amountPaid = Number((visit as any).amountPaid ?? 0);
            const outstanding = computeOutstanding(paidAmount, amountPaid);
            const paidLabel = Number.isFinite(paidAmount)
              ? paidAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
              : String(visit.paymentAmount ?? "");
            const reportUri = (visit as any).reportImageUri?.trim?.() || "";

            const visitCard = (
              <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow space-y-3 active:scale-[0.99] transition-transform cursor-pointer" data-testid={`card-visit-${visit.id}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-primary text-base">Session #{visit.sessionNumber}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">{visit.visitType}</Badge>
                    </div>
                    <div className="text-sm font-medium mt-0.5">{visit.condition}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canEditVisit && (
                      <Link href={`/visits/edit/${visit.id}`}>
                        <button type="button" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700" data-testid={`button-edit-visit-${visit.id}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Link>
                    )}
                    {isAdminMD && (
                      <button
                        type="button"
                        className="p-1.5 rounded-md hover:bg-red-50 text-destructive"
                        data-testid={`button-delete-visit-${visit.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisitToDeleteId(visit.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <span className="text-xs font-medium text-muted-foreground bg-muted/10 px-2 py-1 rounded-md whitespace-nowrap">
                      {format(new Date(visit.visitDate), 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground leading-relaxed bg-muted/5 p-3 rounded-md max-h-56 overflow-y-auto">
                  {visit.treatment}
                </div>

                {reportUri ? (
                  <div className="rounded-lg overflow-hidden border bg-muted/20" data-testid={`visit-report-image-${visit.id}`}>
                    <img
                      src={reportUri}
                      alt="Visit report attachment"
                      className="w-full max-h-72 object-contain bg-black/5"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                  {(visit as any).lastUpdatedByName ? (
                    <div className="text-[11px] text-muted-foreground">
                      Last updated by {(visit as any).lastUpdatedByName}
                      {(visit as any).updatedAt
                        ? ` · ${format(new Date((visit as any).updatedAt), "dd MMM yyyy HH:mm")}`
                        : null}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-xs text-foreground/80">
                    <UserIcon className="h-3.5 w-3.5 text-secondary shrink-0" />
                    <span className="font-medium">Treating: {visit.treatingStaffName || visit.createdByName}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full font-medium bg-muted/20 text-muted-foreground">{visit.status}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold ${paymentStatusBadgeClass(visit.paymentStatus)}`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${isPaidStatus(visit.paymentStatus) ? "bg-emerald-600" : "bg-red-600"}`}
                        aria-hidden
                      />
                      {visit.paymentStatus}
                    </span>
                    <span className="font-semibold text-foreground tabular-nums" data-testid={`text-visit-paid-${visit.id}`}>
                      Total: {paidLabel} LKR
                      {amountPaid > 0 && <span className="text-muted-foreground font-normal"> · Collected: {formatLkr(amountPaid)}</span>}
                      {outstanding > 0 && isUnpaidLikeStatus(visit.paymentStatus) && (
                        <span className="text-amber-700 font-normal"> · Due: {formatLkr(outstanding)}</span>
                      )}
                    </span>
                    {canCollectPayment && isUnpaidLikeStatus(visit.paymentStatus) && outstanding > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentVisit({ ...visit, patientName: patient.name });
                        }}
                      >
                        <Banknote className="h-3 w-3 mr-1" /> Collect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div key={visit.id} className="relative group">
                <div className="absolute -left-[21px] top-4 h-3 w-3 rounded-full bg-primary border-2 border-background ring-4 ring-background" />
                {visitCard}
              </div>
            );
          })}
          
          {patientVisits.length === 0 && (
            <div className="pl-4 py-8 text-muted-foreground text-sm italic bg-muted/5 rounded-lg border border-dashed mx-2">
              No visits recorded yet. Add the first visit above.
            </div>
          )}
        </div>
      </div>
        </TabsContent>
      </Tabs>

      <CollectPaymentDialog
        visit={paymentVisit}
        open={!!paymentVisit}
        onOpenChange={(open) => !open && setPaymentVisit(null)}
        onSuccess={() => {
          setPaymentVisit(null);
        }}
      />

      <AlertDialog open={!!visitToDeleteId} onOpenChange={(open) => !open && setVisitToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the visit record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteVisit}
              disabled={deleteVisitMutation.isPending}
            >
              {deleteVisitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
