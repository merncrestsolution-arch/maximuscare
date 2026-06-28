/**
 * Server-side report export — CSV, Excel (XLSX), and PDF.
 */
import ExcelJS from "exceljs";

export interface ExportColumn {
  key: string;
  label: string;
}

export function rowsToCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(String(row[c.key] ?? ""))).join(",")
  );
  return [header, ...lines].join("\n");
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function rowsToExcelBuffer(
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  sheetName = "Report"
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: 18 }));
  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const col of columns) record[col.key] = row[col.key] ?? "";
    sheet.addRow(record);
  }
  sheet.getRow(1).font = { bold: true };
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function rowsToPdfBuffer(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // 1. Navy blue header band
  doc.setFillColor(16, 86, 145); // #105691 (Blue Dark)
  doc.rect(0, 0, pageWidth, 20, "F");
  
  // White title text
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 13);
  
  // 2. Orange accent line below
  doc.setFillColor(244, 86, 39); // #F45627
  doc.rect(0, 20, pageWidth, 3, "F");
  
  let y = 30;
  doc.setFontSize(8);
  const colWidth = (pageWidth - 28) / columns.length;
  
  // Column headers in Deep Navy
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 86, 145); // #105691
  columns.forEach((col, i) => doc.text(col.label, 14 + i * colWidth, y));
  
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85); // Slate-700
  
  for (const row of rows) {
    if (y > doc.internal.pageSize.getHeight() - 12) {
      doc.addPage();
      y = 14;
    }
    doc.setTextColor(51, 65, 85); // Slate-700 / Grey Dark
    columns.forEach((col, i) => {
      const text = String(row[col.key] ?? "").slice(0, 24);
      doc.text(text, 14 + i * colWidth, y);
    });
    y += 5;
  }
  return Buffer.from(doc.output("arraybuffer"));
}

export type ExportFormat = "csv" | "xlsx" | "pdf";

export function exportContentType(format: ExportFormat): string {
  if (format === "csv") return "text/csv; charset=utf-8";
  if (format === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/pdf";
}

export function exportFileExtension(format: ExportFormat): string {
  return format === "xlsx" ? "xlsx" : format;
}
