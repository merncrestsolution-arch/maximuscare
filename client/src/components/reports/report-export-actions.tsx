import { useMemo, useState } from "react";
import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";
import { Download, FileImage, FileText, Mail, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ShareChannel = "email" | "whatsapp";
type ReportFormat = "pdf" | "jpg";

interface ReportExportActionsProps {
  targetId: string;
  fileBaseName: string;
  reportTitle: string;
}

function sanitizeName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

async function renderReportImage(target: HTMLElement) {
  const canvas = await toCanvas(target, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
  return {
    width: canvas.width,
    height: canvas.height,
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
  };
}

function dataUrlToFile(dataUrl: string, filename: string, mimeType: string) {
  const [meta, data] = dataUrl.split(",");
  if (!meta || !data) return null;
  const binary = atob(data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openShareFallback(channel: ShareChannel, subject: string, text: string) {
  if (channel === "email") {
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export function ReportExportActions({ targetId, fileBaseName, reportTitle }: ReportExportActionsProps) {
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const safeBase = useMemo(() => sanitizeName(fileBaseName) || "report", [fileBaseName]);

  const getTarget = () => {
    const el = document.getElementById(targetId);
    if (!el) {
      toast({
        title: "Report not found",
        description: "Could not find the report section to export.",
        variant: "destructive",
      });
      return null;
    }
    return el;
  };

  const exportJpgDataUrl = async () => {
    const target = getTarget();
    if (!target) return null;
    const image = await renderReportImage(target);
    return image.dataUrl;
  };

  const exportPdfDataUrl = async () => {
    const target = getTarget();
    if (!target) return null;
    const image = await renderReportImage(target);
    const img = image.dataUrl;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (image.height * imgW) / image.width;

    let renderedHeight = 0;
    let pageIndex = 0;
    while (renderedHeight < imgH) {
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", margin, margin - renderedHeight, imgW, imgH, undefined, "FAST");
      renderedHeight += pageH - margin * 2;
      pageIndex += 1;
    }

    return pdf.output("datauristring");
  };

  const downloadByFormat = async (format: ReportFormat) => {
    const actionKey = `download-${format}`;
    setBusyAction(actionKey);
    try {
      const dataUrl = format === "pdf" ? await exportPdfDataUrl() : await exportJpgDataUrl();
      if (!dataUrl) return;
      const filename = `${safeBase}.${format}`;
      downloadDataUrl(dataUrl, filename);
      toast({ title: `${format.toUpperCase()} downloaded`, description: filename });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export report",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const shareByChannel = async (format: ReportFormat, channel: ShareChannel) => {
    const actionKey = `share-${channel}-${format}`;
    setBusyAction(actionKey);
    try {
      const dataUrl = format === "pdf" ? await exportPdfDataUrl() : await exportJpgDataUrl();
      if (!dataUrl) return;

      const filename = `${safeBase}.${format}`;
      const mime = format === "pdf" ? "application/pdf" : "image/jpeg";
      const file = dataUrlToFile(dataUrl, filename, mime);
      const shareText = `Please find attached: ${reportTitle}`;

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: reportTitle,
          text: shareText,
          files: [file],
        });
        toast({ title: "Shared successfully" });
        return;
      }

      downloadDataUrl(dataUrl, filename);
      openShareFallback(
        channel,
        reportTitle,
        `${shareText}\n\n${filename} has been downloaded. Please attach it to this message.`
      );
      toast({
        title: "File downloaded",
        description: `Attach ${filename} in ${channel === "email" ? "email" : "WhatsApp"}.`,
      });
    } catch (error) {
      toast({
        title: "Share failed",
        description: error instanceof Error ? error.message : "Could not share report",
        variant: "destructive",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden" data-testid={`report-actions-${targetId}`}>
      <Button variant="outline" size="sm" onClick={() => window.print()} data-testid={`button-print-${targetId}`}>
        <Printer className="mr-1 h-4 w-4" />
        Print
      </Button>
      <Button variant="outline" size="sm" disabled={busyAction === "download-pdf"} onClick={() => downloadByFormat("pdf")} data-testid={`button-download-pdf-${targetId}`}>
        <FileText className="mr-1 h-4 w-4" />
        PDF
      </Button>
      <Button variant="outline" size="sm" disabled={busyAction === "download-jpg"} onClick={() => downloadByFormat("jpg")} data-testid={`button-download-jpg-${targetId}`}>
        <FileImage className="mr-1 h-4 w-4" />
        JPG
      </Button>
      <Button variant="outline" size="sm" disabled={busyAction === "share-email-pdf"} onClick={() => shareByChannel("pdf", "email")} data-testid={`button-email-pdf-${targetId}`}>
        <Mail className="mr-1 h-4 w-4" />
        Email PDF
      </Button>
      <Button variant="outline" size="sm" disabled={busyAction === "share-whatsapp-jpg"} onClick={() => shareByChannel("jpg", "whatsapp")} data-testid={`button-whatsapp-jpg-${targetId}`}>
        <MessageCircle className="mr-1 h-4 w-4" />
        WhatsApp JPG
      </Button>
      <Button variant="outline" size="sm" disabled={busyAction === "share-whatsapp-pdf"} onClick={() => shareByChannel("pdf", "whatsapp")} data-testid={`button-whatsapp-pdf-${targetId}`}>
        <Download className="mr-1 h-4 w-4" />
        WhatsApp PDF
      </Button>
    </div>
  );
}
