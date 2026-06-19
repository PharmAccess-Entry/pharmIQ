import jsPDF from "jspdf";
import { formatNaira } from "@/lib/format";

export type ExportOrder = {
  short_code: string;
  table_number: string;
  intent: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  customer_name?: string | null;
  order_items?: { name: string; qty: number; price: number }[];
};

const csvEsc = (v: any) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadOrdersCSV = (orders: ExportOrder[], filename: string) => {
  const header = ["Order", "Table", "Intent", "Status", "Payment", "Total (NGN)", "Items", "Customer", "Placed at"];
  const rows = orders.map((o) => [
    o.short_code,
    o.table_number,
    o.intent,
    o.status,
    o.payment_status,
    Number(o.total).toFixed(2),
    (o.order_items || []).map((i) => `${i.qty}x ${i.name}`).join(" | "),
    o.customer_name || "",
    new Date(o.created_at).toLocaleString("en-NG"),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvEsc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export const downloadOrdersPDF = (
  orders: ExportOrder[],
  meta: { restaurantName: string; rangeLabel: string; from: Date; to: Date },
  filename: string,
) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(meta.restaurantName, margin, y); y += 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Sales Report", margin, y); y += 16;
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text(`Range: ${meta.rangeLabel}  (${meta.from.toLocaleDateString("en-NG")} – ${meta.to.toLocaleDateString("en-NG")})`, margin, y); y += 12;
  doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, margin, y); y += 18;
  doc.setTextColor(0);

  const total = orders.reduce((s, o) => s + Number(o.total), 0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Orders: ${orders.length}    Revenue: ${formatNaira(total)}`, margin, y); y += 22;

  // Table header
  const cols = [
    { k: "Order", w: 70 },
    { k: "Table", w: 40 },
    { k: "Status", w: 70 },
    { k: "Payment", w: 60 },
    { k: "Total", w: 70 },
    { k: "Items", w: pageW - margin * 2 - 70 - 40 - 70 - 60 - 70 - 80 },
    { k: "Date", w: 80 },
  ];
  const drawHeader = () => {
    doc.setFillColor(245, 245, 250); doc.rect(margin, y, pageW - margin * 2, 18, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(60);
    let x = margin + 4;
    cols.forEach((c) => { doc.text(c.k, x, y + 12); x += c.w; });
    y += 22; doc.setTextColor(0); doc.setFont("helvetica", "normal");
  };
  drawHeader();

  doc.setFontSize(8.5);
  orders.forEach((o) => {
    if (y > pageH - 60) { doc.addPage(); y = margin; drawHeader(); }
    let x = margin + 4;
    const itemsStr = (o.order_items || []).map((i) => `${i.qty}× ${i.name}`).join(", ");
    const itemsCol = cols.find((c) => c.k === "Items")!;
    const wrapped = doc.splitTextToSize(itemsStr, itemsCol.w - 6);
    const rowH = Math.max(14, wrapped.length * 10 + 4);

    const cells = [
      o.short_code,
      `T${o.table_number}`,
      o.status,
      o.payment_status,
      formatNaira(Number(o.total)),
      "",
      new Date(o.created_at).toLocaleDateString("en-NG"),
    ];
    cols.forEach((c, i) => {
      if (c.k === "Items") doc.text(wrapped, x, y + 10);
      else doc.text(String(cells[i]), x, y + 10);
      x += c.w;
    });
    y += rowH;
    doc.setDrawColor(235); doc.line(margin, y, pageW - margin, y);
    y += 4;
  });

  doc.save(filename);
};
