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
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";

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

const tabs = ["completed", "pending", "pending_transfer"] as const;
type Tab = (typeof tabs)[number];

// IntentBadge removed as per pharmacy workflow

const PAGE_SIZE = 30;

const Orders = () => {
  const [tab, setTab] = useState<Tab>("completed");
  const [orders, setOrders] = useState<Order[]>([]);
  const [exportRange, setExportRange] = useState<"today" | "7d" | "30d" | "all" | "custom">("today");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [confirmServed, setConfirmServed] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState<Order | null>(null);
  const { restaurant, role } = useRestaurant();

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, preparing: 0, served: 0 });
  const loaderRef = useRef<HTMLDivElement>(null);
  const isOffline = useOfflineStatus();

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
    if (!navigator.onLine) {
      // Offline: load from Dexie db.sales
      try {
        const { db } = await import("@/lib/offline/db");
        let rows = await db.sales
          .where('restaurant_id').equals(restaurant.id)
          .reverse()
          .sortBy('created_at');

        // Filter by tab
        if (tab === 'completed') {
          rows = rows.filter(o => ['completed', 'cancelled', 'refunded'].includes(o.status));
        } else if (tab === 'pending_transfer') {
          rows = rows.filter(o => o.status === 'served' && o.payment_status === 'unpaid');
        } else {
          rows = rows.filter(o => o.status === tab);
        }

        setOrders(rows as any[]);
      } catch (e) {
        console.error('Offline order load failed:', e);
      }
      setIsLoading(false);
      setInitialLoad(false);
      return;
    }

    if (!isRefresh) setIsLoading(true);
    
    let q = supabase
      .from("orders")
      .select("id, short_code, table_number, intent, status, total, created_at, payment_status, customer_name, order_items(name, qty, price, item_intent)", { count: "exact" })
      .eq("restaurant_id", restaurant.id);
      
    if (tab === "completed") {
      q = q.or('status.in.(cancelled,refunded,completed),and(status.eq.served,payment_status.neq.unpaid)');
    } else if (tab === "pending_transfer") {
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
    if (!restaurant?.id || !navigator.onLine) return;
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
    const pending_transfer = data.filter(o => o.status === "served" && o.payment_status === "unpaid").length;
    setCounts({ pending, pending_transfer });
  };

  useEffect(() => {
    setPage(0);
    fetchOrders(0, []);
    fetchCounts();
  }, [restaurant?.id, tab, exportRange, startDate, endDate]);

  useEffect(() => {
    const rid = restaurant?.id;
    if (!rid) return;
    
    const handleOnline = () => {
      fetchOrders(0, []);
      fetchCounts();
    };
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      return () => window.removeEventListener("online", handleOnline);
    }

    const ch = supabase
      .channel(`orders-list-${rid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, async (payload) => {
        if (!navigator.onLine) return;
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
        if (!navigator.onLine) return;
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
      
    return () => { 
      supabase.removeChannel(ch); 
      window.removeEventListener("online", handleOnline);
    };
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
    const originalOrder = orders.find(o => o.id === id);
    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status, acknowledged: true } : o)));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("orders").update({ 
        status, 
        acknowledged: true
      }).eq("id", id);
      
      if (error) throw error;
      
      toast.success(`Order moved to ${status.replace("_", " ")}`);
      fetchCounts();
    } catch (err: any) {
      console.error("Failed to advance order:", err);
      toast.error("Failed to update status: " + err.message);
      if (originalOrder) {
        setOrders((prev) => prev.map((o) => (o.id === id ? originalOrder : o)));
      }
    }
  };

  const collectPaymentAndServe = async (orderId: string, method: "cash_paid" | "pos_paid" | "confirmed") => {
    if (!navigator.onLine) {
      toast.error("Cannot confirm payments while offline. Please connect to the internet.");
      return;
    }
    // Save original state for rollback
    const originalOrder = orders.find(o => o.id === orderId);
    
    // Optimistic update
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "completed", payment_status: method, acknowledged: true } : o)));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("orders").update({
        status: "completed",
        payment_status: method,
        acknowledged: true
      }).eq("id", orderId);

      if (error) {
        throw error;
      }

      setCollectingPayment(null);
      toast.success("Transfer confirmed ✓ Order moved to Completed");
      fetchCounts();
    } catch (err: any) {
      console.error("Failed to update order:", err);
      toast.error("Failed to confirm transfer: " + err.message);
      // Rollback
      if (originalOrder) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? originalOrder : o)));
      }
    }
  };

  const labelFor = (t: Tab) => t === "completed" ? "Completed" : t === "pending_transfer" ? "Pending Transfer" : t.replace("_", " ");

  // Fetch EVERY matching served order from the DB (no pagination) for export
  const fetchAllForExport = async () => {
    if (!restaurant?.id) return [];
    let q = supabase
      .from("orders")
      .select("id, short_code, table_number, intent, status, total, created_at, payment_status, customer_name, order_items(name, qty, price, item_intent)")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["served", "completed", "refunded"])
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
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — showing orders placed on this device. Sync will resume when reconnected.</span>
        </div>
      )}
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
            <div key={o.id} className={`bg-card border rounded-2xl shadow-soft transition-smooth ${urgent ? "border-destructive/50 bg-destructive/5" : "border-border hover:border-primary/30"}`}>
              <Link to={`/dashboard/orders/${o.id}`} className="flex items-start gap-3 p-4">
                {urgent && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-soft mt-2" />}
                <div className="h-12 w-12 p-1 rounded-xl bg-primary-soft text-primary flex flex-col items-center justify-center font-display font-bold shrink-0 text-center overflow-hidden">
                  {o.table_number.toLowerCase() === "walk-in" ? (
                    <span className="text-[10px] leading-tight">Walk In</span>
                  ) : (
                    <span>{o.table_number}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">
                      {o.customer_name ? o.customer_name : `Guest #${o.short_code.slice(-3)}`}
                    </span>
                    <span className="font-medium text-xs text-muted-foreground">{o.short_code}</span>
                    <StatusPill status={o.status} />
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
              </Link>
              <div className="flex flex-wrap gap-2 pb-4 px-4 sm:pl-20">
                {o.status === "pending" && <Button size="sm" variant="hero" onClick={() => advance(o.id, "preparing")}>Start Preparing</Button>}
                {o.status === "preparing" && <Button size="sm" variant="hero" className="bg-blue-600 hover:bg-blue-700" onClick={() => advance(o.id, "served")}>Mark as Served</Button>}
                {o.status === "served" && o.payment_status !== "unpaid" && <span className="text-xs text-green-600 font-semibold flex items-center gap-1 px-3"><Check className="h-3 w-3" /> Completed</span>}
                {o.status === "served" && o.payment_status === "unpaid" && (
                   <span className="text-xs text-amber-500 font-semibold flex items-center gap-1 px-3">⏳ Awaiting Cashier</span>
                )}
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
        <DialogContent className="max-w-sm rounded-[2rem] p-6 sm:p-8">
          <DialogHeader className="text-center mb-2">
            <div className="text-4xl mb-3">🏦</div>
            <DialogTitle className="font-display text-xl sm:text-2xl font-black uppercase tracking-wider">Confirm Transfer</DialogTitle>
            <DialogDescription className="font-medium text-xs sm:text-sm">
              Confirm you have received the bank transfer for this order.
            </DialogDescription>
          </DialogHeader>

          {collectingPayment && (
            <div className="bg-secondary/50 rounded-2xl p-4 my-2">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm">{collectingPayment.customer_name || `Walk-in`}</div>
                  <div className="text-xs text-muted-foreground">{collectingPayment.short_code}</div>
                </div>
                <div className="font-display font-black text-xl text-primary">{formatNaira(Number(collectingPayment.total))}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                {(collectingPayment.order_items || []).map((i: any, idx: number) => (
                  <div key={idx} className="text-xs text-muted-foreground">{i.qty}× {i.name}</div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 mt-2">
            <Button
              className="h-12 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft"
              onClick={() => collectingPayment && collectPaymentAndServe(collectingPayment.id, "confirmed")}
            >
              ✅ Yes, Transfer Received
            </Button>
            <Button variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={() => setCollectingPayment(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
export default Orders;
