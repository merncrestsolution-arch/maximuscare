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
  
  let startY = 15;

  // Add Logo if provided
  if (options.logoUri) {
    try {
      const isPng = options.logoUri.startsWith("data:image/png");
      doc.addImage(options.logoUri, isPng ? "PNG" : "JPEG", 14, 10, 20, 20, undefined, "FAST");
      startY = 35;
    } catch (e) {
      console.warn("Could not add logo to PDF:", e);
    }
  }

  // Add Title
  doc.setFontSize(22);
  doc.setTextColor(225, 29, 72); // vibrant rose
  const titleX = options.logoUri ? 40 : 14;
  const titleY = options.logoUri ? 20 : startY;
  doc.text(options.title, titleX, titleY);

  // Add Subtitle
  if (options.subtitle) {
    doc.setFontSize(12);
    doc.setTextColor(147, 51, 234); // vibrant purple
    doc.text(options.subtitle, titleX, titleY + 7);
    if (!options.logoUri) startY += 15;
  } else if (!options.logoUri) {
    startY += 10;
  }

  // Add Generation Timestamp
  doc.setFontSize(9);
  doc.setTextColor(14, 165, 233); // vibrant sky blue
  doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, HH:mm")} (SLST)`, titleX, titleY + 13);

  // Add Table
  const tableOptions: UserOptions = {
    startY: startY + 5,
    head: [options.columns.map(c => c.header)],
    body: options.data.map(row => options.columns.map(c => {
      const val = row[c.dataKey];
      if (typeof val === 'number') {
        return { content: val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right' } };
      }
      return val ?? "";
    })),
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229], // vibrant indigo
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [244, 114, 182], // pink 400
      lineWidth: 0.2,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [254, 240, 138], // vibrant yellow 200
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Add Footer
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(9);
      doc.setTextColor(234, 88, 12); // vibrant orange
      doc.text(
        str,
        data.settings.margin.left,
        doc.internal.pageSize.getHeight() - 10
      );
      doc.text(
        "Maximus Care Management System",
        pageWidth - data.settings.margin.right,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );
    },
  };

  autoTable(doc, tableOptions);

  doc.save(`${options.fileName}.pdf`);
}
