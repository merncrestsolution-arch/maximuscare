import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useLocation } from "wouter";
import { useScanPatient } from "@/hooks/useData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  User,
  History,
  BedDouble,
  RefreshCw,
  Stethoscope,
  NotebookPen,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";

type Phase = "scanning" | "loading" | "result" | "error";

const READER_ID = "qr-reader-region";

/** A single action in the scan sheet: round icon + label + short subtext, 56px tall. */
function ActionRow({
  icon: Icon,
  label,
  subtext,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  subtext: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{subtext}</span>
      </span>
    </button>
  );
}

/**
 * Camera QR scanner + post-scan action sheet. Scans resolve org-wide (any branch in
 * the same organization), never branch-locked. The sheet leads with a name + status
 * badge (so staff confirm the right person) then offers context-aware actions as
 * icon + label + subtext rows:
 *  - non-admitted out-patient → View Patient / View History / Add In-Patient /
 *    Transfer to In-Patient (convert the existing record into an admission)
 *  - currently admitted in-patient → View Patient / View History / Add Session /
 *    Add Experience (a quick clinical note tied to the admission)
 * Cross-org/expired/garbled codes surface a clear, non-leaking error from the server.
 */
export function ScanQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const scan = useScanPatient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [patient, setPatient] = useState<any>(null);
  const [kind, setKind] = useState<"outpatient" | "inpatient">("outpatient");
  const [isAdmitted, setIsAdmitted] = useState(false);
  const [activeAdmissionId, setActiveAdmissionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const stopScanner = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* already stopped */
      }
      try {
        s.clear();
      } catch {
        /* noop */
      }
    }
  };

  const handleDecoded = async (token: string) => {
    setPhase("loading");
    await stopScanner();
    try {
      const res = await scan.mutateAsync(token.trim());
      setPatient(res.patient);
      setKind(res.kind ?? "outpatient");
      setIsAdmitted(!!res.isAdmitted);
      setActiveAdmissionId(res.activeAdmissionId ?? null);
      setPhase("result");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Invalid QR code, please try again");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!open || phase !== "scanning") return;
    let cancelled = false;
    handledRef.current = false;

    const startWhenReady = (attempt = 0) => {
      if (cancelled) return;
      const el = document.getElementById(READER_ID);
      if (!el) {
        if (attempt < 10) requestAnimationFrame(() => startWhenReady(attempt + 1));
        return;
      }
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            void handleDecoded(decodedText);
          },
          () => {
            /* per-frame decode misses are expected; ignore */
          }
        )
        .catch(() => {
          if (!cancelled) {
            setErrorMsg("Unable to access the camera. Check camera permissions and try again.");
            setPhase("error");
          }
        });
    };

    startWhenReady();
    return () => {
      cancelled = true;
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setPhase("scanning");
      setPatient(null);
      setKind("outpatient");
      setIsAdmitted(false);
      setActiveAdmissionId(null);
      setErrorMsg("");
      handledRef.current = false;
    }
  }, [open]);

  const reset = () => {
    setPatient(null);
    setKind("outpatient");
    setIsAdmitted(false);
    setActiveAdmissionId(null);
    setErrorMsg("");
    handledRef.current = false;
    setPhase("scanning");
  };

  const go = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm !bg-white" data-testid="dialog-scan-qr">
        <DialogHeader>
          <DialogTitle>Scan Patient QR</DialogTitle>
          <DialogDescription>Point the camera at a patient's QR code.</DialogDescription>
        </DialogHeader>

        {phase === "scanning" && (
          <div id={READER_ID} className="w-full overflow-hidden rounded-lg border bg-black/5" />
        )}

        {phase === "loading" && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {phase === "result" && patient && (() => {
          const admitted = kind === "inpatient" || isAdmitted;
          return (
            <div className="space-y-3">
              {/* Confirm-the-person header with a live status badge. */}
              <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/30 p-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{patient.name}</div>
                  {patient.patientCode && (
                    <div className="truncate text-xs font-mono text-muted-foreground">
                      {patient.patientCode}
                    </div>
                  )}
                  <div className="truncate text-xs text-muted-foreground">
                    {patient.phone}
                    {patient.branch ? ` · ${patient.branch}` : ""}
                  </div>
                </div>
                <Badge
                  className={admitted ? "bg-success text-white" : "bg-muted text-foreground"}
                  data-testid="badge-scan-status"
                >
                  {admitted ? "Admitted" : "Out-Patient"}
                </Badge>
              </div>

              <div className="space-y-2">
                <ActionRow
                  icon={User}
                  label={kind === "inpatient" ? "View In-Patient" : "View Patient"}
                  subtext="View full patient profile"
                  onClick={() =>
                    go(kind === "inpatient" ? `/inpatients/${patient.id}` : `/patients/${patient.id}`)
                  }
                  testId="button-scan-view-patient"
                />

                {kind !== "inpatient" && (
                  <ActionRow
                    icon={History}
                    label="View History"
                    subtext="See past visits & sessions"
                    onClick={() => go(`/patients/${patient.id}/history`)}
                    testId="button-scan-view-history"
                  />
                )}

                {admitted && activeAdmissionId ? (
                  <>
                    <ActionRow
                      icon={Stethoscope}
                      label="Add Session"
                      subtext="Log a new therapy session"
                      onClick={() => go(`/inpatients/${activeAdmissionId}/session/new`)}
                      testId="button-scan-add-session"
                    />
                    {kind !== "inpatient" && (
                      <ActionRow
                        icon={NotebookPen}
                        label="Add Experience"
                        subtext="Add a clinical note"
                        onClick={() => go(`/patients/${patient.id}?tab=notes`)}
                        testId="button-scan-add-experience"
                      />
                    )}
                  </>
                ) : (
                  kind !== "inpatient" && (
                    <>
                      <ActionRow
                        icon={BedDouble}
                        label="Add In-Patient"
                        subtext="Start a new admission"
                        onClick={() => go(`/inpatients/new?patientId=${patient.id}`)}
                        testId="button-scan-add-inpatient"
                      />
                      <ActionRow
                        icon={ArrowRightLeft}
                        label="Transfer to In-Patient"
                        subtext="Convert to in-patient using existing record"
                        onClick={() => go(`/inpatients/new?patientId=${patient.id}&transfer=1`)}
                        testId="button-scan-transfer-inpatient"
                      />
                    </>
                  )
                )}
              </div>

              <Button
                variant="ghost"
                className="h-11 w-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-scan-cancel"
              >
                Cancel
              </Button>
            </div>
          );
        })()}

        {phase === "error" && (
          <div className="space-y-3 text-center py-4">
            <p className="text-sm text-destructive" data-testid="text-scan-error">
              {errorMsg}
            </p>
            <Button variant="outline" size="compact" onClick={reset} data-testid="button-scan-retry">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
