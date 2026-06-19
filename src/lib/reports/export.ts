import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ReportColumn<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => string | number;
}

export interface ReportConfig<T> {
  title: string;
  columns: ReportColumn<T>[];
  data: T[];
  filename?: string;
  subtitle?: string;
}

// Convert data row based on column config
function extractRow<T>(item: T, columns: ReportColumn<T>[]): (string | number)[] {
  return columns.map(col => {
    if (col.cell) {
      return col.cell(item);
    }
    if (col.accessorKey) {
      const val = (item as any)[col.accessorKey];
      return val ?? "";
    }
    return "";
  });
}

export function exportToCSV<T>({ title, columns, data, filename }: ReportConfig<T>) {
  const headers = columns.map(c => c.header).join(",");
  const rows = data.map(item => {
    const row = extractRow(item, columns);
    // escape commas
    return row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filename || title.replace(/\s+/g, "_")}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel<T>({ title, columns, data, filename }: ReportConfig<T>) {
  const headers = columns.map(c => c.header);
  const rows = data.map(item => extractRow(item, columns));
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  
  XLSX.writeFile(workbook, `${filename || title.replace(/\s+/g, "_")}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
}

export function exportToPDF<T>({ title, subtitle, columns, data, filename }: ReportConfig<T>) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 30);
  }
  
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, subtitle ? 36 : 30);

  const head = [columns.map(c => c.header)];
  const body = data.map(item => extractRow(item, columns));

  (doc as any).autoTable({
    startY: subtitle ? 42 : 36,
    head,
    body,
    theme: 'striped',
    headStyles: { fillColor: [29, 78, 216] }, // blue-700
    styles: { fontSize: 8 },
  });

  doc.save(`${filename || title.replace(/\s+/g, "_")}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}
