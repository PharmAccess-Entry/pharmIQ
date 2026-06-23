import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Minus, Plus, AlertTriangle, Printer, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusPill } from "./Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/format";
import { RealTimeAgo } from "@/components/RealTimeAgo";
import { toast } from "sonner";
import { OrderDetailSkeleton } from "@/components/LoadingState";
import { Receipt } from "@/components/Receipt";
import html2canvas from "html2canvas";
import { useRef } from "react";

type Order = any;
type OrderItem = { id: string; name: string; qty: number; price: number; item_intent: string | null; selected_option: string | null; notes: string | null; bundle_id?: string | null };

export const OrderDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [shortageItem, setShortageItem] = useState<OrderItem | null>(null);
  const [shortageQty, setShortageQty] = useState<number>(0);
  const [processedByName, setProcessedByName] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState(false);
  const [refundingOrder, setRefundingOrder] = useState(false);
  const [restockInventory, setRestockInventory] = useState(true);
  
  const { role } = useRestaurant();
  
  const receiptRef = useRef<HTMLDivElement>(null);

  const printReceipt = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:13px;padding:20px;}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current || !order) return;
    const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgData;
    link.download = `receipt-${order.short_code}.png`;
    link.click();
    toast.success("Receipt downloaded");
  };


  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [{ data: o }, { data: it }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);
      setOrder(o);
      setItems((it as OrderItem[]) || []);
      if (o?.restaurant_id) {
        const { data: r } = await supabase.from("restaurants").select("*").eq("id", o.restaurant_id).maybeSingle();
        setRestaurant(r);
      }
      if (o?.processed_by) {
        const { data: users } = await supabase.rpc("get_users_by_ids", { user_ids: [o.processed_by] });
        if (users && users[0]) {
          setProcessedByName(users[0].full_name || users[0].email || null);
        }
      }
      setNotFound(!o);
      setLoading(false);
    };
    load();

    const orderCh = supabase
      .channel(`order-meta-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if ((payload.new as any)?.id === id || (payload.old as any)?.id === id) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
        const record = payload.new || payload.old;
        if (record && record.order_id === id) load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(orderCh);
    };
  }, [id]);

  // No chat state or effects needed — messages feature removed

  if (!order) {
    if (loading) return <DashboardLayout><OrderDetailSkeleton /></DashboardLayout>;
    return (
      <DashboardLayout>
        <Link to="/dashboard/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4"><ArrowLeft className="h-4 w-4" />Back to orders</Link>
        <div className="py-16 text-center">
          <p className="font-display text-xl font-bold mb-2">Order not found</p>
          <p className="text-sm text-muted-foreground">{notFound ? "This order may have been removed or the link is invalid." : "Something went wrong."}</p>
        </div>
      </DashboardLayout>
    );
  }

  const advance = async (status: string) => {
    const originalOrder = { ...order };
    // Optimistic UI update
    setOrder({ ...order, status, acknowledged: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("orders").update({
        status,
        acknowledged: true
      }).eq("id", order.id);

      if (error) throw error;
      toast.success(`Status: ${status.replace("_", " ")}`);
    } catch (err: any) {
      console.error("Failed to advance order:", err);
      toast.error("Failed to update status", { description: err.message });
      setOrder(originalOrder); // Rollback
    }
  };

  const collectPaymentAndServe = async (method: "cash_paid" | "pos_paid" | "confirmed") => {
      try {
        setOrder((prev: any) => ({ ...prev, status: "completed", payment_status: method, acknowledged: true }));
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("orders").update({
          status: "completed",
          payment_status: method,
          acknowledged: true
        }).eq("id", id);
        if (error) throw error;
        toast.success("Transfer confirmed ✓ Order moved to Completed");
        setCollectingPayment(false);
      } catch (e: any) {
        toast.error("Failed to collect payment", { description: e.message });
      }
    };

  const processRefund = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !order) return;

    // Fetch the current active shift for this user so the refund cash event
    // Use the unified process_refund RPC — single authoritative mutation path.
    // We MUST pass an active shift ID because the DB now strictly requires it.
    let activeShiftId: string | null = null;
    try {
      const { data: activeShift } = await supabase
        .from("shifts")
        .select("id")
        .eq("restaurant_id", order.restaurant_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      activeShiftId = activeShift?.id || null;
    } catch (_) {
      // Ignore select errors
    }

    if (!activeShiftId) {
      toast.error("You must have an active shift to process a refund.");
      setRefundingOrder(false);
      return;
    }

    // This produces exactly ONE inventory_log entry per restocked item
    const { data, error } = await supabase.rpc("process_refund", {
      p_order_id: order.id,
      p_user_id: user.id,
      p_restock: restockInventory,
      p_shift_id: activeShiftId,
    });

    if (error) {
      toast.error("Refund failed: " + error.message);
      return;
    }

    setOrder({ ...order, status: "refunded", payment_status: "refunded" });
    setRefundingOrder(false);
    toast.success("Order refunded successfully" + (restockInventory ? " and inventory restocked." : "."));
  };

  const sendMessage = async () => {
    const body = chatBody.trim();
    if (!body) return;

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      sender: "staff",
      kind: "message",
      body,
      payload: null,
      created_at: new Date().toISOString(),
      read_at: null
    }]);
    setChatBody("");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted } = await supabase.from("order_messages").insert({
      order_id: order.id,
      sender: "staff",
      kind: "message",
      body,
      processed_by: user?.id
    }).select().maybeSingle();

    // Safely replace temp with real DB record without duplicating realtime broadcast
    if (inserted) {
      setMessages((prev) => {
        const alreadyHasReal = prev.some(m => m.id === inserted.id);
        if (alreadyHasReal) return prev.filter(m => m.id !== tempId);
        return prev.map(m => m.id === tempId ? { ...inserted } as Message : m);
      });
    }
  };

  const sendQtyOffer = async (itemId?: string, qty?: number) => {
    const targetId = itemId || offerItem;
    const targetQty = qty !== undefined ? qty : offerQty;

    if (!targetId || targetQty < 0) return;
    const item = items.find((i) => i.id === targetId);
    if (!item) return;

    const body = targetQty === 0
      ? `Sorry, ${item.name} is currently out of stock — please choose something else.`
      : `We only have ${targetQty} ${item.name} available — accept reduced quantity?`;

    const payload = { order_item_id: item.id, name: item.name, original_qty: item.qty, offered_qty: targetQty, price: item.price };

    // Optimistic UI — show immediately
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      sender: "staff",
      kind: "qty_offer",
      body,
      payload,
      created_at: new Date().toISOString(),
      read_at: null
    }]);

    setOfferQty(1);
    setShortageItem(null);
    toast.success(targetQty === 0 ? "Out-of-stock notice sent" : "Offer sent to customer");

    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted } = await supabase.from("order_messages").insert({
      order_id: order.id,
      sender: "staff",
      kind: "qty_offer",
      body,
      payload,
      processed_by: user?.id
    }).select().maybeSingle();

    // Safely replace temp with real DB record without duplicating realtime broadcast
    if (inserted) {
      setMessages((prev) => {
        const alreadyHasReal = prev.some(m => m.id === inserted.id);
        if (alreadyHasReal) return prev.filter(m => m.id !== tempId);
        return prev.map(m => m.id === tempId ? { ...inserted } as Message : m);
      });
    }
  };

  const confirmPayment = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    // Delete the screenshot from storage if it exists to save space
    if (order.payment_screenshot_url) {
      try {
        const urlParts = order.payment_screenshot_url.split("/");
        const fileName = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2];
        const path = `${folderName}/${fileName}`;
        await supabase.storage.from("payment-screenshots").remove([path]);
      } catch (e) {
        console.error("Failed to delete screenshot:", e);
      }
    }

    await supabase.from("orders").update({
      payment_status: "confirmed",
      processed_by: user?.id,
      processed_at: new Date().toISOString()
    }).eq("id", order.id);
    toast.success("Payment confirmed ✓ (Screenshot cleared)");
  };

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <Link to="/dashboard/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to orders</Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={printReceipt} className="bg-card gap-1.5"><Printer className="h-4 w-4" /> Print Receipt</Button>
          <Button variant="outline" size="sm" onClick={downloadReceipt} className="bg-card gap-1.5"><Download className="h-4 w-4" /> Download</Button>
        </div>
      </div>

      <Receipt
        receiptRef={receiptRef}
        items={items}
        total={total}
        paymentMethod={order.payment_status || order.payment_method || "Paid"}
        customerName={order.customer_name || `Table ${order.table_number}`}
        orderId={order.short_code}
        restaurantName={restaurant?.name || "Pharmacy"}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-card border border-border rounded-2xl shadow-soft p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="font-display text-2xl font-bold">{order.short_code}</h1>
                <p className="text-sm text-muted-foreground">Dispensed <RealTimeAgo date={order.created_at} /> · <span className="font-bold text-primary">{order.customer_name || `Guest #${order.short_code.slice(-3)}`}</span></p>
                {processedByName && (
                  <p className="text-xs text-muted-foreground mt-0.5">Handled by <span className="font-semibold text-foreground">{processedByName}</span></p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={order.status} />
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(items.reduce((acc: any, it: any) => {
                const bid = it.bundle_id || 'none-' + it.id;
                if (!acc[bid]) acc[bid] = [];
                acc[bid].push(it);
                return acc;
              }, {})).map(([bid, bundleItems]: [string, any]) => {
                const bundleNote = bundleItems.find((it: any) => it.notes)?.notes;

                return (
                  <div key={bid} className={bid.startsWith('none-') ? 'divide-y divide-border' : 'bg-primary/5 p-4 rounded-[2rem] border border-primary/10'}>
                    {bundleItems.map((i: any) => (
                      <div key={i.id} className="flex items-center justify-between py-3 gap-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-medium text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <span className="leading-tight break-words">{i.name}</span>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap mt-0.5 sm:mt-0">
                              {order.intent === "mixed" && i.item_intent && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest ${i.item_intent === "eat-here" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                                  {i.item_intent === "eat-here" ? "🚚 Delivery" : "🛍️ Walk-in"}
                                </span>
                              )}
                              {i.selected_option && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  {i.selected_option}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">Qty: {i.qty} · {formatNaira(i.price)} each</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {order.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10"
                              onClick={() => { setShortageItem(i); setShortageQty(i.qty > 0 ? i.qty - 1 : 0); }}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Short
                            </Button>
                          )}
                          <div className="font-display font-semibold whitespace-nowrap text-xs">{formatNaira(i.price * i.qty)}</div>
                        </div>
                      </div>
                    ))}
                    {bundleNote && (
                      <div className="mt-3 text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20 flex items-start gap-2">
                        <span className="text-base">📝</span>
                        <span className="flex-1 leading-relaxed">{bundleNote}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border mt-3 pt-4 flex justify-between items-baseline">
              <span className="text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold">{formatNaira(total)}</span>
            </div>
          </div>

        </div>

        {/* Side actions */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <h3 className="font-display font-semibold mb-3">Processing workflow</h3>
            <div className="space-y-2">
              {order.status === "pending" && (
                <Button variant="hero" className="w-full h-auto py-3 text-base sm:text-lg whitespace-normal leading-tight" onClick={() => advance("preparing")}>Start Dispensing</Button>
              )}
              {order.status === "preparing" && (
                <Button variant="hero" className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700" onClick={() => advance("completed")}>Mark as Dispensed</Button>
              )}
              {(order.status === "completed" || (order.status === "served" && order.payment_status !== "unpaid")) && (
                <div className="bg-primary/10 text-primary rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1 text-primary">✅</div>
                  <div className="font-bold">Sale Completed</div>
                  <p className="text-xs opacity-80">
                    {order.payment_status === "cash_paid" ? "Paid by Cash" :
                     order.payment_status === "pos_paid" ? "Paid via POS Terminal" :
                     order.payment_status === "confirmed" ? "Paid via Bank Transfer" : "Payment recorded"}
                  </p>
                </div>
              )}
              {order.status === "served" && order.payment_status === "unpaid" && (
                <div className="space-y-2">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <div className="text-base mb-1">⏳</div>
                    <div className="font-bold text-amber-600 text-sm">Awaiting Transfer Confirmation</div>
                    <p className="text-xs text-amber-600/80 mt-0.5">Meds dispensed — confirm transfer receipt below</p>
                  </div>
                  {(role === "owner" || role === "manager") ? (
                    <Button className="w-full h-11 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCollectingPayment(true)}>Confirm Payment</Button>
                  ) : (
                    <div className="w-full h-11 flex items-center justify-center rounded-xl font-bold bg-amber-500/20 text-amber-600">Awaiting Cashier</div>
                  )}
                </div>
              )}
              {order.status !== "cancelled" && order.status !== "refunded" && order.status !== "served" && order.status !== "completed" && (
                <Button variant="ghost" className="w-full text-destructive mt-4" onClick={() => advance("cancelled")}><X className="h-4 w-4" /> Cancel Order</Button>
              )}
              {order.status === "served" && (
                <Button variant="ghost" className="w-full text-destructive mt-4" onClick={() => setRefundingOrder(true)}><AlertTriangle className="h-4 w-4 mr-2" /> Void / Refund Order</Button>
              )}
            </div>
          </div>

          {/* Secondary Info Collapsibles would go here, but for now we just make them smaller cards */}
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Payment Info</h4>
              {order.payment_status === "cash_pos" ? (
                <div className="bg-warning/10 border border-warning/20 p-3 rounded-xl">
                  <div className="text-sm font-bold text-warning flex items-center gap-2">💳 POS / CASH</div>
                  <p className="text-[10px] text-warning/80 mt-1 uppercase">Customer waiting with cash/card</p>
                </div>
              ) : order.payment_screenshot_url ? (
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl">
                  <div className="text-sm font-bold text-primary flex items-center gap-2 mb-3">🏦 TRANSFER PROOF</div>
                  <a href={order.payment_screenshot_url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-primary/20 bg-black/5 hover:border-primary transition-all relative group">
                    <img src={order.payment_screenshot_url} alt="Payment Proof" className="w-full h-40 object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center text-white text-xs font-bold uppercase tracking-widest">
                      Click to Enlarge
                    </div>
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic bg-secondary/50 p-3 rounded-xl">No payment info provided yet</div>
              )}
              {restaurant && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">{restaurant.bank_name}</div>
                  <div className="text-xs font-mono">{restaurant.bank_account_number}</div>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 shadow-soft">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Patient</h4>
              <div className="text-sm font-medium">{order.customer_name || `Walk-in Patient`}</div>
              {order.customer_phone && <div className="text-xs text-muted-foreground font-mono">{order.customer_phone}</div>}
            </div>
          </div>
        </div>
      </div>
      {/* Shortage Modal */}
      <Dialog open={!!shortageItem} onOpenChange={(o) => !o && setShortageItem(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Report Shortage</DialogTitle>
          </DialogHeader>
          {shortageItem && (
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="font-semibold text-sm">{shortageItem.name}</div>
                <div className="text-xs text-muted-foreground">Customer ordered: {shortageItem.qty}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">How many are available?</label>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setShortageQty(Math.max(0, shortageQty - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input
                    type="number" inputMode="numeric" min={0} max={shortageItem.qty}
                    value={shortageQty}
                    onChange={(e) => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) setShortageQty(Math.max(0, Math.min(shortageItem.qty, n))); }}
                    className="w-16 text-center font-bold text-lg bg-secondary/50 rounded-xl h-10 border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setShortageQty(Math.min(shortageItem.qty, shortageQty + 1))}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {shortageQty === 0 && (
                <div className="bg-destructive/10 text-destructive text-xs font-semibold p-3 rounded-xl text-center">
                  This will tell the customer it's out of stock
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={() => { setShortageQty(0); }}>
                  Out of Stock
                </Button>
                <Button variant="hero" className="flex-1 h-10 rounded-xl text-sm font-bold" onClick={() => sendQtyOffer(shortageItem.id, shortageQty)}>
                  {shortageQty === 0 ? 'Notify Customer' : 'Send Offer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Collection Modal */}
      <Dialog open={collectingPayment} onOpenChange={(o) => !o && setCollectingPayment(false)}>
        <DialogContent className="max-w-sm rounded-[2rem] p-6 sm:p-8">
          <DialogHeader className="text-center mb-2">
            <div className="text-4xl mb-3">🏦</div>
            <DialogTitle className="font-display text-xl sm:text-2xl font-black uppercase tracking-wider">Confirm Transfer</DialogTitle>
            <DialogDescription className="font-medium text-xs sm:text-sm">
              Confirm you have received the bank transfer for this order.
            </DialogDescription>
          </DialogHeader>

          {/* Order summary */}
          <div className="bg-secondary/50 rounded-2xl p-4 my-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-sm">{order?.customer_name || `Walk-in Patient`}</div>
                <div className="text-xs text-muted-foreground">{order?.short_code}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-xl text-primary">{formatNaira(total)}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
              {items.map((i, idx) => (
                <div key={idx} className="text-xs text-muted-foreground">
                  {i.qty}× {i.name}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 mt-2">
            <Button
              className="h-12 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
              onClick={() => collectPaymentAndServe("confirmed")}
            >
              ✅ Yes, Transfer Received
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={() => setCollectingPayment(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={refundingOrder} onOpenChange={setRefundingOrder}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 sm:p-8">
          <DialogHeader className="text-center mb-2">
            <DialogTitle className="font-display text-xl font-black uppercase text-destructive tracking-wider">Refund Order</DialogTitle>
            <DialogDescription className="font-medium text-xs sm:text-sm">
              Are you sure you want to refund or void this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 text-destructive text-sm font-semibold p-4 rounded-xl mt-4 border border-destructive/20 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>This will change the order status to "Refunded" and remove its total from your daily revenue.</p>
          </div>

          <div className="mt-6 p-4 border border-border rounded-xl flex items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm">Restock Inventory</h4>
              <p className="text-xs text-muted-foreground mt-1">Return these items to your available stock.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" checked={restockInventory} onChange={(e) => setRestockInventory(e.target.checked)} />
              <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setRefundingOrder(false)}>Cancel</Button>
            <Button variant="hero" className="flex-1 h-12 rounded-xl font-bold bg-destructive hover:bg-destructive/90 text-white shadow-soft" onClick={processRefund}>
              Confirm Refund
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>

  );
};

// End of file
