import { useEffect, useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export type ReportColumn = {
  key: string;
  label: string;
};

type StructuredReportActionsProps = {
  reportTitle: string;
  fileBaseName: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  meta?: Array<{ label: string; value: string }>;
  logoUri?: string;
  themeColor?: string;
};

function sanitizeName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function StructuredReportActions({
  reportTitle,
  fileBaseName,
  columns,
  rows,
  meta = [],
  logoUri,
  themeColor = "#2D9D8B",
}: StructuredReportActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string>("");
  const safeBase = sanitizeName(fileBaseName) || "report";

  useEffect(() => {
    let active = true;
    async function loadLogo() {
      if (!logoUri) {
        setLogoDataUrl("");
        return;
      }
      try {
        const res = await fetch(logoUri);
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (!active) return;
          setLogoDataUrl(typeof reader.result === "string" ? reader.result : "");
        };
        reader.readAsDataURL(blob);
      } catch {
        if (active) setLogoDataUrl("");
      }
    }
    void loadLogo();
    return () => {
      active = false;
    };
  }, [logoUri]);

  const exportCsv = () => {
    const header = columns.map((c) => `"${c.label.replaceAll('"', '""')}"`).join(",");
    const lines = rows.map((row) =>
      columns
        .map((c) => `"${toDisplay(row[c.key]).replaceAll('"', '""')}"`)
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${safeBase}.csv`);
  };

  const exportPdf = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 16;
    const innerW = pageW - margin * 2;
    let y = margin;

    let r = 45,
      g = 157,
      b = 139;
    if (/^#[0-9A-Fa-f]{6}$/.test(themeColor)) {
      const hex = themeColor.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageW, 24, "F");

    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", margin, 5, 11, 11);
      } catch {
        /* ignore */
      }
    }

    const titleX = margin + (logoDataUrl ? 14 : 0);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(doc.splitTextToSize(reportTitle, innerW - 18), titleX, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Maximus Care", titleX, 18);
    doc.setTextColor(33, 37, 41);

    y = 30;
    doc.setFontSize(8.5);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 4;
    meta.forEach((m) => {
      const block = doc.splitTextToSize(`${m.label}: ${m.value}`, innerW);
      doc.text(block, margin, y);
      y += block.length * 3.8 + 0.5;
    });
    y += 4;

    const labelLens = columns.map((c) => c.label.length);
    const contentLens = rows.map((row) => columns.map((c) => toDisplay(row[c.key]).length));
    const maxPerCol = columns.map((_, i) =>
      Math.max(labelLens[i] ?? 8, ...contentLens.map((r) => Math.min(90, r[i] ?? 0)), 10)
    );
    const weightSum = maxPerCol.reduce((a, x) => a + x, 0);
    const colW = maxPerCol.map((w) => (w / weightSum) * innerW);

    const lineH = 3.6;
    const cellPad = 1.8;

    const drawHeaderRow = () => {
      const headerLines = columns.map((c, i) => doc.splitTextToSize(c.label, colW[i] - cellPad * 2));
      const headerH = Math.max(8, ...headerLines.map((l) => l.length * lineH)) + 2;
      if (y + headerH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, innerW, headerH, "F");
      doc.setDrawColor(200, 210, 220);
      doc.rect(margin, y, innerW, headerH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let cx = margin + cellPad;
      for (let i = 0; i < columns.length; i++) {
        doc.text(headerLines[i], cx, y + 5);
        if (i < columns.length - 1) {
          const lineX = cx + colW[i] - cellPad;
          doc.line(lineX, y, lineX, y + headerH);
        }
        cx += colW[i];
      }
      y += headerH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    };

    drawHeaderRow();

    rows.forEach((row) => {
      const cellLines = columns.map((c, i) =>
        doc.splitTextToSize(toDisplay(row[c.key]), colW[i] - cellPad * 2)
      );
      const rowH = Math.max(6, ...cellLines.map((l) => l.length * lineH)) + 2;

      if (y + rowH > pageH - margin) {
        doc.addPage();
        y = margin;
        drawHeaderRow();
      }

      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, innerW, rowH, "S");
      let cx = margin + cellPad;
      for (let i = 0; i < columns.length; i++) {
        doc.text(cellLines[i], cx, y + 4.5);
        if (i < columns.length - 1) {
          const lineX = cx + colW[i] - cellPad;
          doc.line(lineX, y, lineX, y + rowH);
        }
        cx += colW[i];
      }
      y += rowH;
    });

    doc.save(`${safeBase}.pdf`);
  };

  const exportXlsx = async () => {
    const exceljs = await import("exceljs");
    const workbook = new exceljs.Workbook();
    const sheet = workbook.addWorksheet("Report");

    sheet.addRow([reportTitle]);
    sheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
    meta.forEach((m) => sheet.addRow([`${m.label}: ${m.value}`]));
    sheet.addRow([]);

    sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 24 }));
    rows.forEach((row) => {
      const out: Record<string, string> = {};
      columns.forEach((c) => {
        out[c.key] = toDisplay(row[c.key]);
      });
      sheet.addRow(out);
    });

    const headRow = sheet.getRow(meta.length + 5);
    headRow.font = { bold: true };
    headRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F6F2" },
    };

    if (logoDataUrl) {
      try {
        const imageId = workbook.addImage({
          base64: logoDataUrl,
          extension: "png",
        });
        sheet.addImage(imageId, {
          tl: { col: 7.2, row: 0.2 },
          ext: { width: 64, height: 64 },
        });
      } catch {
        // ignore bad logo format
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeBase}.xlsx`);
  };

  const runExport = async (type: "xlsx" | "csv" | "pdf") => {
    setBusy(type);
    try {
      if (type === "xlsx") await exportXlsx();
      if (type === "csv") exportCsv();
      if (type === "pdf") exportPdf();
      toast({ title: `${type.toUpperCase()} generated`, description: `Saved ${safeBase}.${type}` });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not generate report",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        size="sm"
        className="bg-emerald-600 text-white hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        disabled={busy !== null}
        onClick={() => runExport("xlsx")}
      >
        {busy === "xlsx" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
        Excel
      </Button>
      <Button
        size="sm"
        className="bg-sky-600 text-white hover:bg-sky-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        disabled={busy !== null}
        onClick={() => runExport("csv")}
      >
        {busy === "csv" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
        CSV
      </Button>
      <Button
        size="sm"
        className="bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
        disabled={busy !== null}
        onClick={() => runExport("pdf")}
      >
        {busy === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
        PDF
      </Button>
    </div>
  );
}
