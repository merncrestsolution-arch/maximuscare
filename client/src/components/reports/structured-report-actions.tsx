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
  themeColor = "#105691",
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

  const exportPdf = async () => {
    const { generateStandardPDF } = await import("@/lib/pdfBuilder");
    
    await generateStandardPDF({
      title: reportTitle,
      subtitle: meta.map(m => `${m.label}: ${m.value}`).join(" | "),
      columns: columns.map(c => ({ header: c.label, dataKey: c.key })),
      data: rows.map(r => {
        const out: Record<string, any> = {};
        for (const c of columns) out[c.key] = toDisplay(r[c.key]);
        return out;
      }),
      fileName: safeBase,
      logoUri: logoDataUrl ?? undefined,
    });
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
      if (type === "pdf") await exportPdf();
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
