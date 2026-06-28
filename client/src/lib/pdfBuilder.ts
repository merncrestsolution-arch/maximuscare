import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { format } from "date-fns";

export interface PDFColumn {
  header: string;
  dataKey: string;
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  columns: PDFColumn[];
  data: Record<string, any>[];
  fileName: string;
  logoUri?: string;
}

/**
 * Bug 1: amount/currency columns must be right-aligned and rendered with a
 * consistent 2-decimal format so bills and reports line up. We detect such
 * columns by their header text (Amount, LKR, Rate, Balance, Total, Paid, Fee,
 * Charge, Price, Salary) and format any numeric value within them.
 */
function isAmountHeader(header: string): boolean {
  return /amount|lkr|rate|balance|total|paid|fee|charge|price|salary|incentive/i.test(header);
}

function formatMoney2dp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  // Strip currency labels / thousands separators before parsing.
  const cleaned = String(value).replace(/lkr/i, "").replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function generateStandardPDF(options: PDFExportOptions): Promise<void> {
  const isLandscape = options.columns.length > 6;
  const doc = new jsPDF(isLandscape ? "l" : "p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const isManyColumns = options.columns.length > 10;
  const baseFontSize = isManyColumns ? 7 : 9;
  const headerFontSize = isManyColumns ? 8 : 10;
  const cellPadding = isManyColumns ? 2 : 4;

  let startY = 15;

  // 1. HEADER (Left: Logo, Right: Titles)
  if (options.logoUri) {
    try {
      const isPng = options.logoUri.startsWith("data:image/png");
      doc.addImage(options.logoUri, isPng ? "PNG" : "JPEG", 14, 10, 25, 25, undefined, "FAST");
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }

  // Right-aligned Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(16, 86, 145); // #105691 (Blue Dark)
  doc.text(options.title, pageWidth - 14, 20, { align: "right" });

  // Right-aligned Subtitle
  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(options.subtitle, pageWidth - 14, 28, { align: "right" });
  }

  // Right-aligned Timestamp
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")} (SLST)`, pageWidth - 14, 34, { align: "right" });

  // Header Accent Line (Orange #F45627 block)
  doc.setFillColor(244, 86, 39); // #F45627
  doc.rect(0, 40, pageWidth, 3, "F");

  startY = 48;

  // Right-align (and 2-decimal format) every amount column so currency lines up.
  const amountColumnIndexes = options.columns.reduce<Record<number, { halign: "right" }>>(
    (acc, c, idx) => {
      if (isAmountHeader(c.header)) acc[idx] = { halign: "right" };
      return acc;
    },
    {}
  );

  // 2. DATA TABLE (Clean & Professional)
  const tableOptions: UserOptions = {
    startY: startY,
    head: [options.columns.map(c => c.header)],
    body: options.data.map(row => options.columns.map(c => {
      const val = row[c.dataKey];
      const isAmount = isAmountHeader(c.header);
      if (isAmount) {
        const money = formatMoney2dp(val);
        if (money !== null) {
          return { content: money, styles: { halign: 'right' as const } };
        }
      }
      if (typeof val === 'number') {
        return { content: val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right' as const } };
      }
      return val ?? "";
    })),
    columnStyles: amountColumnIndexes,
    theme: "grid", // Grid theme gives us explicit borders
    headStyles: {
      fillColor: [16, 86, 145], // #105691 deep navy
      textColor: 255,
      fontStyle: 'bold',
      fontSize: headerFontSize,
    },
    styles: {
      fontSize: baseFontSize,
      cellPadding: cellPadding,
      textColor: [30, 41, 59], // Slate 800
      lineColor: [226, 232, 240], // Light grey grid lines #e2e8f0
      lineWidth: 0.1, // Very thin, elegant lines
    },
    alternateRowStyles: {
      fillColor: [238, 245, 251], // #EEF5FB pale blue
    },
    margin: { left: 14, right: 14, bottom: 25 },
    didDrawPage: (data) => {
      // 3. FOOTER (Structured & Informative)
      
      // Footer Divider (Light Grey)
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400

      // Left: System Name
      doc.text("Maximus Care Management System", 14, pageHeight - 9);

      // Center: Report Type
      doc.text(options.title, pageWidth / 2, pageHeight - 9, { align: "center" });

      // Right: Page Numbers
      doc.text(
        `Page ${(doc.internal as any).getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 9,
        { align: "right" }
      );
    },
  };

  autoTable(doc, tableOptions);

  doc.save(`${options.fileName}.pdf`);
}
