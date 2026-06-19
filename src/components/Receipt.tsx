import React from "react";
import { formatNaira } from "@/lib/format";

type CartItem = {
  cartItemId?: string;
  id?: string;
  name: string;
  qty: number;
  price: number;
};

export const Receipt = ({
  receiptRef,
  items,
  total,
  paymentMethod,
  customerName,
  orderId,
  restaurantName,
  change,
  cashGiven,
}: {
  receiptRef: React.RefObject<HTMLDivElement>;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerName: string;
  orderId: string;
  restaurantName: string;
  change?: number;
  cashGiven?: number;
}) => (
  <div
    ref={receiptRef}
    style={{
      position: "fixed",
      left: "-9999px",
      top: 0,
      width: "320px",
      background: "#ffffff",
      color: "#000000",
      fontFamily: "monospace",
      fontSize: "13px",
      padding: "20px 16px",
      lineHeight: "1.6",
    }}
  >
    {/* Header */}
    <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "10px", marginBottom: "10px" }}>
      <div style={{ fontWeight: "bold", fontSize: "16px" }}>{restaurantName}</div>
      <div style={{ fontSize: "11px", color: "#555" }}>RECEIPT</div>
      <div style={{ fontSize: "11px" }}>{new Date().toLocaleString("en-NG")}</div>
      <div style={{ fontSize: "11px" }}>Order: {orderId}</div>
      {customerName && <div style={{ fontSize: "11px" }}>Customer: {customerName}</div>}
    </div>

    {/* Items */}
    {items.map((item, idx) => {
      const lineTotal = (item.price || 0) * (item.qty || 1);
      return (
        <div key={item.cartItemId || idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>{item.qty}x {item.name}</span>
          <span>{lineTotal > 0 ? formatNaira(lineTotal) : "—"}</span>
        </div>
      );
    })}

    {/* Totals */}
    <div style={{ borderTop: "1px dashed #000", marginTop: "10px", paddingTop: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "15px" }}>
        <span>TOTAL</span>
        <span>{formatNaira(total)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span>Payment</span>
        <span>
          {paymentMethod === "cash" || paymentMethod === "cash_paid" || paymentMethod === "cash_pos" ? "Cash" : 
           paymentMethod === "pos_terminal" || paymentMethod === "pos_paid" ? "POS Terminal" : 
           paymentMethod === "bank_transfer" || paymentMethod === "confirmed" ? "Bank Transfer" : "Paid"}
        </span>
      </div>
      {(cashGiven ?? 0) > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Cash Given</span>
            <span>{formatNaira(cashGiven || 0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>Change</span>
            <span>{formatNaira(change || 0)}</span>
          </div>
        </>
      )}
    </div>

    {/* Footer */}
    <div style={{ borderTop: "1px dashed #000", marginTop: "12px", paddingTop: "10px", textAlign: "center", fontSize: "11px", color: "#555" }}>
      <div>Thank you for your patronage!</div>
      <div>Powered by PharmIQ</div>
    </div>
  </div>
);
