import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const buildWorkbook = ({ sheetName, columns, rows, shopProfile, title, summaryLines = [] }) => {
  const worksheetRows = rows.map((row) =>
    columns.reduce((accumulator, column) => {
      accumulator[column.header] = row[column.key];
      return accumulator;
    }, {})
  );

  const metaRows = [
  [shopProfile?.shopName || "Skyline Journeys POS"],
    [shopProfile?.address || ""],
    [title || sheetName],
    ...summaryLines.map((line) => [line]),
    []
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.sheet_add_json(worksheet, worksheetRows, { origin: `A${metaRows.length + 1}` });
  const workbook = XLSX.utils.book_new();

  const columnWidths = columns.map((column) => ({
    wch: Math.max(column.header.length + 4, 16)
  }));

  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
};

const getImageDataUrl = async (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  const response = await fetch(imageUrl);
  const blob = await response.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const exportReportToExcel = ({ fileName, sheetName, columns, rows, shopProfile, title, summaryLines = [] }) => {
  const workbook = buildWorkbook({ sheetName, columns, rows, shopProfile, title, summaryLines });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportReportToPdf = async ({ title, fileName, columns, rows, summaryLines = [], shopProfile }) => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  let startY = 40;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const rightEdge = pageWidth - 40;
  const logoUrl = shopProfile?.logo
    ? `${import.meta.env.VITE_SERVER_URL || "http://localhost:5000"}${shopProfile.logo}`
    : "";

  if (logoUrl) {
    try {
      const logoDataUrl = await getImageDataUrl(logoUrl);
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, "PNG", rightEdge - 42, 28, 42, 42);
      }
    } catch {
      // Ignore logo failures and continue with the report export.
    }
  }

  pdf.setFontSize(18);
  pdf.text(shopProfile?.shopName || "Skyline Journeys POS", rightEdge - (logoUrl ? 52 : 0), 42, { align: "right" });

  if (shopProfile?.address) {
    pdf.setFontSize(10);
    const addressLines = pdf.splitTextToSize(shopProfile.address, 180);
    addressLines.forEach((line, index) => {
      pdf.text(line, rightEdge, 58 + index * 12, { align: "right" });
    });
    startY = 82 + Math.max(0, (addressLines.length - 1) * 12);
  } else {
    startY = 68;
  }

  pdf.setFontSize(15);
  pdf.text(title, 40, startY);

  pdf.setFontSize(10);
  summaryLines.forEach((line, index) => {
    pdf.text(line, 40, startY + 22 + index * 14);
  });

  autoTable(pdf, {
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => row[column.key])),
    startY: summaryLines.length ? startY + 42 + summaryLines.length * 8 : startY + 26,
    styles: {
      fontSize: 9,
      cellPadding: 6
    },
    headStyles: {
      fillColor: [241, 121, 35]
    },
    margin: {
      left: 40,
      right: 40
    }
  });

  pdf.save(`${fileName}.pdf`);
};
