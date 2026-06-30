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
import { Loader2, User, History, BedDouble, RefreshCw, Stethoscope, NotebookPen } from "lucide-react";

type Phase = "scanning" | "loading" | "result" | "error";

const READER_ID = "qr-reader-region";

/**
 * Camera QR scanner + post-scan action sheet. Scans resolve org-wide (any branch in
 * the same organization), never branch-locked. The action sheet is context-aware:
 *  - non-admitted patient → View Patient / View History / Add In-Patient
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
      setIsAdmitted(false);
      setActiveAdmissionId(null);
      setErrorMsg("");
      handledRef.current = false;
    }
  }, [open]);

  const reset = () => {
    setPatient(null);
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

        {phase === "result" && patient && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="font-semibold text-foreground">{patient.name}</div>
              {patient.patientCode && (
                <div className="text-xs font-mono text-muted-foreground">{patient.patientCode}</div>
              )}
              <div className="text-xs text-muted-foreground">
                {patient.phone}
                {patient.branch ? ` · ${patient.branch}` : ""}
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2"
              onClick={() => go(`/patients/${patient.id}`)}
              data-testid="button-scan-view-patient"
            >
              <User className="h-5 w-5" /> View Patient
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12 bg-white border-2"
              onClick={() => go(`/patients/${patient.id}/history`)}
              data-testid="button-scan-view-history"
            >
              <History className="h-5 w-5" /> View History
            </Button>
            {isAdmitted && activeAdmissionId ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-12 bg-white border-2"
                  onClick={() => go(`/inpatients/${activeAdmissionId}/session/new`)}
                  data-testid="button-scan-add-session"
                >
                  <Stethoscope className="h-5 w-5" /> Add Session
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-12 bg-white border-2"
                  onClick={() => go(`/patients/${patient.id}?tab=notes`)}
                  data-testid="button-scan-add-experience"
                >
                  <NotebookPen className="h-5 w-5" /> Add Experience
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-12 bg-white border-2"
                onClick={() => go(`/inpatients/new?patientId=${patient.id}`)}
                data-testid="button-scan-add-inpatient"
              >
                <BedDouble className="h-5 w-5" /> Add In-Patient
              </Button>
            )}
          </div>
        )}

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
