import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePatientQrToken, useInPatientQrToken } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCode as QrIcon, Download, Loader2, IdCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadPatientIdCard } from "@/lib/idCard";

interface Props {
  /** Out-patient master record vs. in-patient admission — selects the QR token endpoint. */
  kind: "outpatient" | "inpatient";
  /** Patient master id (out-patient) or admission id (in-patient). */
  id: string;
  patientName: string;
  patientCode?: string | null;
  phone?: string | null;
  address?: string | null;
  condition?: string | null;
  branchName?: string | null;
  branchId?: string | null;
  registeredDate?: string | null;
}

/**
 * Shared "Show QR Code" + "Download ID Card" actions for any patient profile
 * (out-patient or in-patient). The QR encodes a server-signed token (never the raw
 * id) so a scanned/printed card can't be forged across organizations. The ID card is
 * a print-ready PDF generated on the server.
 */
export function PatientCredentials({ kind, id, patientName, patientCode }: Props) {
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dataUrl, setDataUrl] = useState("");

  // Both hooks are always called (rules of hooks); only the relevant one is enabled.
  const outQuery = usePatientQrToken(id, kind === "outpatient" && active);
  const inQuery = useInPatientQrToken(id, kind === "inpatient" && active);
  const tokenQuery = kind === "outpatient" ? outQuery : inQuery;
  const token = tokenQuery.data?.token;

  useEffect(() => {
    let cancelled = false;
    if (qrOpen && token) {
      QRCode.toDataURL(token, { width: 320, margin: 2, errorCorrectionLevel: "M" })
        .then((url) => !cancelled && setDataUrl(url))
        .catch(() => !cancelled && setDataUrl(""));
    } else if (!qrOpen) {
      setDataUrl("");
    }
    return () => {
      cancelled = true;
    };
  }, [qrOpen, token]);

  const handleShowQr = () => {
    setActive(true);
    setQrOpen(true);
  };

  const handleDownloadIdCard = async () => {
    setDownloading(true);
    try {
      setActive(true);
      let qrToken = token;
      if (!qrToken) {
        const refreshed = await tokenQuery.refetch();
        qrToken = refreshed.data?.token;
      }
      await downloadPatientIdCard({
        kind,
        recordId: id,
        patientCode: patientCode ?? tokenQuery.data?.patientCode ?? null,
        qrToken: qrToken ?? null,
      });
    } catch (e) {
      toast({
        title: "Could not download ID card",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="compact"
        onClick={handleShowQr}
        data-testid="button-show-qr"
      >
        <QrIcon className="h-4 w-4" />
        Show QR Code
      </Button>
      <Button
        type="button"
        variant="outline"
        size="compact"
        onClick={handleDownloadIdCard}
        disabled={downloading}
        data-testid="button-download-id-card"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
        Download ID Card
      </Button>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs !bg-white" data-testid="dialog-patient-qr">
          <DialogHeader>
            <DialogTitle>Patient QR Code</DialogTitle>
            <DialogDescription>
              Scan from Quick Add → Scan QR to pull up this patient.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {tokenQuery.isLoading || (active && !token && !tokenQuery.error) ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : tokenQuery.error ? (
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
                  {(patientCode ?? tokenQuery.data?.patientCode) && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {patientCode ?? tokenQuery.data?.patientCode}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="compact"
                  onClick={handleDownloadIdCard}
                  disabled={downloading}
                  data-testid="button-download-id-card-dialog"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download ID Card
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
