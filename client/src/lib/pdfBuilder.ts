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
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // ==========================
  // TOP BANNER (Very Colorful!)
  // ==========================
  doc.setFillColor(79, 70, 229); // Vibrant Indigo
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Decorative Accent Bar
  doc.setFillColor(236, 72, 153); // Pink
  doc.rect(0, 45, pageWidth, 2, 'F');

  let startY = 55;

  // Add Logo if provided
  if (options.logoUri) {
    try {
      const isPng = options.logoUri.startsWith("data:image/png");
      doc.addImage(options.logoUri, isPng ? "PNG" : "JPEG", 14, 10, 25, 25, undefined, "FAST");
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }

  // Add Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255); // White text on indigo banner
  const titleX = options.logoUri ? 45 : 14;
  doc.text(options.title, titleX, 22);

  // Add Subtitle
  if (options.subtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(254, 240, 138); // Yellow text
    doc.text(options.subtitle, titleX, 30);
  }

  // Add Generation Timestamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(191, 219, 254); // Light blue
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")} (SLST)`, titleX, 38);

  // Add Table
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
    theme: "grid",
    headStyles: {
      fillColor: [225, 29, 72], // Rose 600 header
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [203, 213, 225], // Slate 300
      lineWidth: 0.1,
      textColor: [30, 41, 59], // Slate 800
    },
    alternateRowStyles: {
      fillColor: [240, 253, 250], // Light Teal / Cyan hue for rows
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didDrawPage: (data) => {
      // Add Footer Banner
      doc.setFillColor(30, 41, 59); // Slate 800
      doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
      
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(253, 186, 116); // Orange
      doc.text(str, data.settings.margin.left, pageHeight - 6);
      
      doc.setTextColor(244, 114, 182); // Pink
      doc.text(
        "Maximus Care Management System",
        pageWidth - data.settings.margin.right,
        pageHeight - 6,
        { align: "right" }
      );
    },
  };

  autoTable(doc, tableOptions);

  doc.save(`${options.fileName}.pdf`);
}
