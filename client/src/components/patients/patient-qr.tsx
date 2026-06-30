import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePatientQrToken } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode as QrIcon, Download, Loader2 } from "lucide-react";

interface Props {
  patientId: string;
  patientName: string;
  patientCode?: string | null;
}

/**
 * "Show QR" button + dialog. Encodes a server-signed token (not the raw patient ID)
 * into the QR so a scanned card can't be forged across organizations. The QR is
 * downloadable as a PNG for printing physical patient cards.
 */
export function PatientQrButton({ patientId, patientName, patientCode }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = usePatientQrToken(patientId, open);
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (open && data?.token) {
      QRCode.toDataURL(data.token, { width: 320, margin: 2, errorCorrectionLevel: "M" })
        .then((url) => {
          if (!cancelled) setDataUrl(url);
        })
        .catch(() => {
          if (!cancelled) setDataUrl("");
        });
    } else {
      setDataUrl("");
    }
    return () => {
      cancelled = true;
    };
  }, [open, data?.token]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    const safeName = patientName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `patient-qr-${safeName || patientId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="compact"
        onClick={() => setOpen(true)}
        data-testid="button-show-qr"
      >
        <QrIcon className="h-4 w-4" />
        Show QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs !bg-white" data-testid="dialog-patient-qr">
          <DialogHeader>
            <DialogTitle>Patient QR Code</DialogTitle>
            <DialogDescription>
              Scan from Quick Add → Scan QR to pull up this patient.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : error ? (
              <p className="text-sm text-destructive">Could not generate QR code.</p>
            ) : dataUrl ? (
              <>
                <img
                  src={dataUrl}
                  alt={`QR code for ${patientName}`}
                  className="h-56 w-56 rounded-lg border bg-white"
                  data-testid="img-patient-qr"
                />
                <div className="text-center">
                  <div className="font-semibold text-foreground">{patientName}</div>
                  {patientCode && (
                    <div className="text-xs font-mono text-muted-foreground">{patientCode}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="compact"
                  onClick={handleDownload}
                  data-testid="button-download-qr"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </Button>
              </>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
