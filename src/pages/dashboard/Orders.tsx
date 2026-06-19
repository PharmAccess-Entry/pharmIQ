import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./Dashboard";
import { UtensilsCrossed, ShoppingBasket, Shuffle, MessageCircle, FileDown, FileText, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { formatNaira } from "@/lib/format";
import { RealTimeAgo } from "@/components/RealTimeAgo";
import { toast } from "sonner";
import { downloadOrdersCSV, downloadOrdersPDF } from "@/lib/exportOrders";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { OrderRowSkeleton } from "@/components/LoadingState";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";

type Order = {
  id: string;
  short_code: string;
  table_number: string;
  intent: string;
  status: string;
  total: number;
  created_at: string;
  payment_status: string;
  order_items?: { name: string; qty: number; item_intent: string | null }[];
};

const tabs = ["Active", "pending", "preparing", "awaiting_payment", "history"] as const;
type Tab = (typeof tabs)[number];

export const IntentBadge = ({ intent }: { intent: string }) => {
  const map: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
    "dine-in": { label: "Dine-in", icon: UtensilsCrossed, cls: "bg-primary-soft text-primary" },
    takeaway: { label: "Takeaway", icon: ShoppingBasket, cls: "bg-accent-soft text-accent" },
    mixed: { label: "Mixed", icon: Shuffle, cls: "bg-secondary text-foreground" },
  };
  const m = map[intent] || map["dine-in"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${m.cls}`}>
      <m.icon className="h-3 w-3" /> {m.label}
    </span>
  );
};

const PAGE_SIZE = 30;

const Orders = () => {
  const [tab, setTab] = useState<Tab>("Active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [exportRange, setExportRange] = useState<"today" | "7d" | "30d" | "all" | "custom">("today");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [confirmServed, setConfirmServed] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState<Order | null>(null);
  const { restaurant } = useRestaurant();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, preparing: 0, served: 0 });
  const loaderRef = useRef<HTMLDivElement>(null);

  const dateFilterRange = useMemo(() => {
    const now = new Date();
    let from = new Date(0);
    let to = new Date();

    if (exportRange === "today") {
      from = new Date(); from.setHours(0, 0, 0, 0);
    } else if (exportRange === "7d") {
      from = new Date(now.getTime() - 7 * 86400_000);
    } else if (exportRange === "30d") {
      from = new Date(now.getTime() - 30 * 86400_000);
    } else if (exportRange === "custom") {
      from = new Date(startDate); from.setHours(0, 0, 0, 0);
      to = new Date(endDate); to.setHours(23, 59, 59, 999);
    }

    return { from, to };
  }, [exportRange, startDate, endDate]);

  const fetchOrders = async (pageNum: number, currentOrders: Order[], isRefresh = false) => {
    if (!restaurant?.id) return;
    if (!isRefresh) setIsLoading(true);
    
    let q = supabase
      .from("orders")
      .select("id, short_code, table_number, intent, status, total, created_at, payment_status, customer_name, order_items(name, qty, price, item_intent)", { count: "exact" })
      .eq("restaurant_id", restaurant.id);
      
    if (tab === "Active") {
      q = q.or('status.in.(pending,preparing),and(status.eq.served,payment_status.eq.unpaid)');
    } else if (tab === "history") {
      q = q.or('status.in.(cancelled,refunded),and(status.eq.served,payment_status.neq.unpaid)');
    } else if (tab === "awaiting_payment") {
      q = q.eq("status", "served").eq("payment_status", "unpaid");
    } else {
      q = q.eq("status", tab);
    }
    if (exportRange !== "all") {
      q = q.gte("created_at", dateFilterRange.from.toISOString());
      q = q.lte("created_at", dateFilterRange.to.toISOString());
    }
    
    q = q.order("created_at", { ascending: false }).range(isRefresh ? 0 : pageNum * PAGE_SIZE, isRefresh ? Math.max((page + 1) * PAGE_SIZE, PAGE_SIZE) - 1 : (pageNum + 1) * PAGE_SIZE - 1);
    
    const { data, count } = await q;
    
    if (data) {
      if (isRefresh) {
        setOrders(data as any);
      } else {
        if (pageNum === 0) setOrders(data as any);
        else setOrders([...currentOrders, ...(data as any)]);
        setHasMore((pageNum + 1) * PAGE_SIZE < (count || 0));
      }
    }
    if (!isRefresh) {
      setIsLoading(false);
      setInitialLoad(false);
    }
  };

  const fetchCounts = async () => {
    if (!restaurant?.id) return;
    // Single query: fetch all non-terminal orders and count them client-side.
    // This replaces 3 separate HEAD requests with 1, which matters when
    // the real-time listener fires fetchCounts() on every order change.
    let q = supabase
      .from("orders")
      .select("status, payment_status")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["pending", "preparing", "served"]);

    if (exportRange !== "all") {
      q = q.gte("created_at", dateFilterRange.from.toISOString());
      q = q.lte("created_at", dateFilterRange.to.toISOString());
    }

    const { data } = await q;
    if (!data) return;

    const pending = data.filter(o => o.status === "pending").length;
    const preparing = data.filter(o => o.status === "preparing").length;
    const awaiting_payment = data.filter(o => o.status === "served" && o.payment_status === "unpaid").length;
    setCounts({ pending, preparing, awaiting_payment });
  };

  useEffect(() => {
    setPage(0);
    fetchOrders(0, []);
    fetchCounts();
  }, [restaurant?.id, tab, exportRange, startDate, endDate]);

  useEffect(() => {
    const rid = restaurant?.id;
    if (!rid) return;
    const ch = supabase
      .channel(`orders-list-${rid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, async (payload) => {
        const newId = payload.new.id;
        const { data } = await supabase.from("orders").select("id, short_code, table_number, intent, status, total, created_at, payment_status, customer_name, order_items(name, qty, price, item_intent)").eq("id", newId).single();
        if (data) {
          setOrders((prev) => {
            if (prev.some(o => o.id === newId)) return prev;
            return [data as any, ...prev];
          });
          setCounts((prev) => ({ ...prev, [data.status]: (prev[data.status] || 0) + 1 }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, (payload) => {
        const updated = payload.new as any;
        const old = payload.old as any;
        setOrders((prev) => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
        
        if (old.status && updated.status && old.status !== updated.status) {
          fetchCounts(); // Just refetch to ensure accuracy with awaiting_payment logic
        } else if (old.payment_status !== updated.payment_status) {
          fetchCounts();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant?.id]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        setPage((p) => {
          const next = p + 1;
          fetchOrders(next, orders);
          return next;
        });
      }
    }, { threshold: 0.1 });
    
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, orders]);

  const advance = async (id: string, status: string) => {
    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status, acknowledged: true } : o)));
    
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("orders").update({ 
      status, 
      acknowledged: true,
      processed_by: user?.id,
      processed_at: new Date().toISOString()
    }).eq("id", id);
    
    toast.success(`Order moved to ${status.replace("_", " ")}`);
    fetchCounts();
  };

  const collectPaymentAndServe = async (orderId: string, method: "cash_paid" | "pos_paid" | "confirmed") => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "served", payment_status: method, acknowledged: true } : o)));
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("orders").update({
      status: "served",
      payment_status: method,
      acknowledged: true,
      processed_by: user?.id,
      processed_at: new Date().toISOString(),
    }).eq("id", orderId);
    setCollectingPayment(null);
    toast.success("Payment recorded ✓");
    fetchCounts();
  };

  const labelFor = (t: Tab) => t === "Active" ? "Active" : t === "history" ? "History" : t.replace("_", " ");

  // Fetch EVERY matching served order from the DB (no pagination) for export
  const fetchAllForExport = async () => {
    if (!restaurant?.id) return [];
    let q = supabase
      .from("orders")
      .select("id, short_code, table_number, intent, status, total, created_at, payment_status, customer_name, order_items(name, qty, price, item_intent)")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "served")
      .order("created_at", { ascending: false });

    if (exportRange !== "all") {
      q = q.gte("created_at", dateFilterRange.from.toISOString());
      q = q.lte("created_at", dateFilterRange.to.toISOString());
    }

    const { data } = await q;
    return (data || []) as any[];
  };

  const rangeLabel = exportRange === "today" ? "Today" : exportRange === "7d" ? "Last 7 days" : exportRange === "30d" ? "Last 30 days" : exportRange === "custom" ? "Custom range" : "All time";

  const onExportCSV = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllForExport();
      if (!rows.length) return toast.error("No served orders in selected range");
      downloadOrdersCSV(rows, `orders-${exportRange}-${Date.now()}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  const onExportPDF = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllForExport();
      if (!rows.length) return toast.error("No served orders in selected range");
      downloadOrdersPDF(rows, { restaurantName: restaurant?.name || "PharmIQ", rangeLabel, from: dateFilterRange.from, to: dateFilterRange.to }, `orders-${exportRange}-${Date.now()}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground mt-1">Tap an order to chat with the customer or confirm payment.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <Select value={exportRange} onValueChange={(v: any) => setExportRange(v)}>
            <SelectTrigger className="h-9 w-32 focus:ring-primary rounded-xl font-bold text-xs uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {exportRange === "custom" && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
              <CustomDatePicker 
                value={startDate} 
                onChange={setStartDate} 
                className="h-9 w-[130px] px-2 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-muted-foreground text-[10px] font-bold">to</span>
              <CustomDatePicker 
                value={endDate} 
                onChange={setEndDate} 
                className="h-9 w-[130px] px-2 py-1.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            <Button size="sm" variant="outline" onClick={onExportCSV} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}CSV
            </Button>
            <Button size="sm" variant="outline" onClick={onExportPDF} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap capitalize transition-smooth ${tab === t ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {labelFor(t)} {t !== "Active" && t !== "history" && <span className="ml-1 opacity-70">{counts[t] || 0}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {initialLoad
          ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <OrderRowSkeleton />
            </div>
          ))
          : orders.map((o) => {
          const urgent = o.status === "pending" && (Date.now() - new Date(o.created_at).getTime()) > 2 * 60 * 1000;
          return (
            <div key={o.id} className={`bg-card border rounded-2xl p-4 shadow-soft transition-smooth ${urgent ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
              <div className="flex items-start gap-3">
                {urgent && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-soft mt-2" />}
                <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary grid place-items-center font-display font-bold shrink-0">T{o.table_number}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">
                      {o.customer_name ? o.customer_name : `Guest #${o.short_code.slice(-3)}`}
                    </span>
                    <Link to={`/dashboard/orders/${o.id}`} className="font-medium text-xs text-muted-foreground hover:text-primary">{o.short_code}</Link>
                    <StatusPill status={o.status} />
                    <IntentBadge intent={o.intent} />
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${urgent ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-muted-foreground"}`}>
                      <RealTimeAgo date={o.created_at} />
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(o.order_items || []).map((i, idx) => (
                      <span key={idx}>{idx > 0 && ", "}{i.qty}× {i.name}</span>
                    ))}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display font-bold">{formatNaira(Number(o.total))}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 sm:pl-16">
                {o.status === "pending" && <Button size="sm" variant="hero" onClick={() => advance(o.id, "preparing")}>Start Preparing</Button>}
                {o.status === "preparing" && <Button size="sm" variant="hero" className="bg-blue-600 hover:bg-blue-700" onClick={() => advance(o.id, "served")}>Mark as Served</Button>}
                {o.status === "served" && o.payment_status !== "unpaid" && <span className="text-xs text-green-600 font-semibold flex items-center gap-1 px-3"><Check className="h-3 w-3" /> Completed</span>}
                {o.status === "served" && o.payment_status === "unpaid" && (
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-9" onClick={() => setCollectingPayment(o)}>
                    ⏳ Collect Payment
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild><Link to={`/dashboard/orders/${o.id}`}><MessageCircle className="h-3.5 w-3.5" />Open Chat</Link></Button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && !isLoading && <div className="text-center py-16 text-muted-foreground">No orders in this view.</div>}
        {hasMore && (
          <div ref={loaderRef} className="py-6 flex justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>

      <Dialog open={!!confirmServed} onOpenChange={(o) => !o && setConfirmServed(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-8">
          <DialogHeader className="text-center mb-6">
            <DialogTitle className="font-display text-2xl font-black uppercase tracking-wider">Confirm Service</DialogTitle>
            <DialogDescription className="font-medium">
              Confirm this order has been delivered?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 mt-4">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setConfirmServed(null)}>Cancel</Button>
            <Button variant="hero" className="flex-1 h-12 rounded-xl font-bold bg-green-600 hover:bg-green-700" onClick={() => { if (confirmServed) { advance(confirmServed, "served"); setConfirmServed(null); } }}>
              Confirm Served
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!collectingPayment} onOpenChange={(o) => !o && setCollectingPayment(null)}>
        <DialogContent className="max-w-md rounded-[2rem] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center mb-2">
            <DialogTitle className="font-display text-xl sm:text-2xl font-black uppercase tracking-wider">Collect Payment</DialogTitle>
            <DialogDescription className="font-medium text-xs sm:text-sm">
              Confirm payment to close this order and add to revenue.
            </DialogDescription>
          </DialogHeader>

          {collectingPayment && (
            <div className="bg-secondary/50 rounded-2xl p-4 my-2 sm:my-4">
              <div className="flex justify-between items-center mb-3 pb-3 border-b border-border/50">
                <div>
                  <div className="font-bold">{collectingPayment.customer_name || `Table ${collectingPayment.table_number}`}</div>
                  <div className="text-xs text-muted-foreground">{collectingPayment.short_code}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-black text-xl text-primary">{formatNaira(Number(collectingPayment.total))}</div>
                </div>
              </div>
              <div className="space-y-1 max-h-[120px] sm:max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                {(collectingPayment.order_items || []).map((i, idx) => (
                  <div key={idx} className="text-xs flex justify-between">
                    <span className="text-muted-foreground">{i.qty}× {i.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:gap-3 mt-2">
            <Button
              className="h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
              onClick={() => collectingPayment && collectPaymentAndServe(collectingPayment.id, "cash_paid")}
            >
              💵 Cash
            </Button>
            <Button
              className="h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-soft"
              onClick={() => collectingPayment && collectPaymentAndServe(collectingPayment.id, "pos_paid")}
            >
              💳 POS Terminal
            </Button>
            <Button
              className="h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-soft"
              onClick={() => collectingPayment && collectPaymentAndServe(collectingPayment.id, "confirmed")}
            >
              🏦 Bank Transfer
            </Button>
            <Button variant="ghost" className="h-10 sm:h-12 mt-1 rounded-xl text-muted-foreground" onClick={() => setCollectingPayment(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
export default Orders;
