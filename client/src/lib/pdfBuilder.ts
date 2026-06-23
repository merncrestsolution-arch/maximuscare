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
  doc.setTextColor(30, 41, 59); // Slate-800
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

  // Header Divider (Primary Teal)
  doc.setDrawColor(45, 157, 139); // #2d9d8b
  doc.setLineWidth(0.5);
  doc.line(14, 40, pageWidth - 14, 40);

  startY = 48;

  // 2. DATA TABLE (Clean & Professional)
  const tableOptions: UserOptions = {
    startY: startY,
    head: [options.columns.map(c => c.header)],
    body: options.data.map(row => options.columns.map(c => {
      const val = row[c.dataKey];
      if (typeof val === 'number') {
        return { content: val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right' } };
      }
      return val ?? "";
    })),
    theme: "grid", // Grid theme gives us explicit borders
    headStyles: {
      fillColor: [45, 157, 139], // Primary teal
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
      fillColor: [248, 250, 252], // Extremely subtle off-white #f8fafc
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
