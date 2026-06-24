import { DashboardLayout } from "@/components/DashboardLayout";
import { TrendingUp, ShoppingBag, Users, Clock, Radio, Crown, ArrowUpRight, MessageCircle, Zap, Star, BellRing, ArrowRight, AlertTriangle, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant, trialDaysLeft } from "@/lib/restaurant";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { RealTimeAgo } from "@/components/RealTimeAgo";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCardSkeleton, ChartSkeleton, OrderRowSkeleton } from "@/components/LoadingState";

type Order = {
  id: string;
  short_code: string;
  table_number: string;
  status: string;
  total: number;
  created_at: string;
  acknowledged: boolean;
  order_items?: { name: string; qty: number }[];
};

type Range = "today" | "7d" | "30d" | "1y";
const RANGE_DAYS: Record<Range, number> = { today: 1, "7d": 7, "30d": 30, "1y": 365 };

const Dashboard = () => {
  const { restaurant, role } = useRestaurant();
  const rid = restaurant?.id;
  const canToggleLive = role === "owner" || role === "manager";
  const isEvent = restaurant?.business_type === "event";
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<{ total: number; status: string; created_at: string }[]>([]);
  const [requests, setRequests] = useState<{ id: string; type: string; message: string | null; table_number: string | null; resolved: boolean; created_at: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string | null; created_at: string }[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [live, setLive] = useState(restaurant?.is_accepting_orders ?? true);
  const [isTogglingLive, setIsTogglingLive] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<{ name: string; stock_quantity: number; low_stock_threshold: number }[]>([]);
  const [expiringItems, setExpiringItems] = useState<{ name: string; expiry_date: string; cost_price: number; stock_quantity: number }[]>([]);
  const [inventoryValue, setInventoryValue] = useState<number>(0);
  const [todayCogs, setTodayCogs] = useState<number>(0);

  useEffect(() => {
    if (restaurant && restaurant.is_accepting_orders !== undefined) {
      setLive(restaurant.is_accepting_orders ?? true);
    }
  }, [restaurant?.is_accepting_orders]);

  const toggleLiveStatus = async () => {
    if (!rid || isTogglingLive) return;
    setIsTogglingLive(true);
    const newValue = !live;
    setLive(newValue);
    
    const { error } = await supabase.from('restaurants').update({ is_accepting_orders: newValue }).eq('id', rid);
    
    if (error) {
      setLive(!newValue);
      toast.error("Failed to update status");
    } else {
      toast.success(newValue ? "You are now Live and accepting orders!" : "Orders are Paused. Customers cannot order.");
    }
    setIsTogglingLive(false);
  };

  const { user } = useAuth();


  const [range, setRange] = useState<Range>("7d");
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [activeNudge, setActiveNudge] = useState<{ table: string; id: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const sendBroadcast = async () => {
    if (!broadcastMessage.trim() || !rid) return;
    setIsBroadcasting(true);
    const { error } = await supabase.from("customer_requests").insert({
      restaurant_id: rid,
      type: "announcement",
      message: broadcastMessage.trim(),
      resolved: false
    });
    if (error) {
      toast.error("Failed to send broadcast");
    } else {
      toast.success("Broadcast sent to all active guests!");
      setBroadcastMessage("");
    }
    setIsBroadcasting(false);
  };

  useEffect(() => {
    // If rid is not yet available (restaurant context still loading), wait for it.
    if (!rid) {
      return;
    }
    const loadRecent = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, short_code, table_number, status, total, created_at, acknowledged, order_items(name, qty)")
        .eq("restaurant_id", rid)
        .order("created_at", { ascending: false })
        .limit(8);
      setOrders((data as any) || []);
    };
    const loadMessages = async () => {
      const { data } = await supabase
        .from("order_messages")
        .select("id, body, created_at, sender, order_id, orders!inner(short_code, table_number, restaurant_id)")
        .eq("sender", "customer")
        .eq("orders.restaurant_id", rid)
        .order("created_at", { ascending: false })
        .limit(10);
      setMessages((data as any) || []);
    };
    const loadHistory = async () => {
      const since = new Date(Date.now() - 365 * 86400_000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("total, status, created_at, table_number, payment_status")
        .eq("restaurant_id", rid)
        .gte("created_at", since);
      setAllOrders(data || []);
    };
    if (isEvent) {
      supabase.from("customer_requests").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(500).then(({ data }) => { setRequests((data as any) || []); });
      supabase.from("events").select("id, name, event_date, created_at").eq("restaurant_id", rid).order("created_at", { ascending: false }).then(({ data }) => setEvents((data as any) || []));
    }


    const ch = supabase
      .channel(`dashboard-orders-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rid}` }, () => {
        if (live) { loadRecent(); loadHistory(); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, () => {
        if (live) loadMessages();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_requests", filter: `restaurant_id=eq.${rid}` }, (payload) => {
        const req = payload.new as any;
        if (req.type === "nudge" && !req.resolved) {
          setActiveNudge({ table: req.table_number, id: req.id });
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
          }
        }
        if (live) loadAllRequests();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_requests", filter: `restaurant_id=eq.${rid}` }, () => {
        if (live) loadAllRequests();
      })
      .subscribe();

    const loadAllRequests = async () => {
      const { data } = await supabase.from("customer_requests").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }).limit(500);
      const list = (data as any[]) || [];
      setRequests(list);

      // Calculate average rating
      const ratings = list.filter(r => r.type === "rating");
      if (ratings.length > 0) {
        const total = ratings.reduce((sum, r) => {
          const val = parseInt(r.message?.split("|")[0] || "0");
          return sum + val;
        }, 0);
        setAverageRating(total / ratings.length);
      } else {
        setAverageRating(null);
      }
    };

    const loadData = async () => {
      try {
        await Promise.all([
          loadRecent(),
          loadMessages(),
          loadHistory(),
          loadAllRequests()
        ]);
        
        // Fetch inventory value
        const { data: invData } = await supabase.from("menu_items").select("stock_quantity, cost_price").eq("restaurant_id", rid).eq("track_inventory", true);
        const invValue = (invData || []).reduce((sum, item) => sum + ((item.stock_quantity || 0) * (item.cost_price || 0)), 0);
        setInventoryValue(invValue);

        // Fetch COGS for today
        const startOfTodayISO = new Date(); startOfTodayISO.setHours(0,0,0,0);
        const { data: cogsData } = await supabase.from("orders").select("id, status, order_items(qty, cost_price)").eq("restaurant_id", rid).gte("created_at", startOfTodayISO.toISOString()).in("status", ["completed", "pending", "preparing", "served"]);
        const cogsTotal = (cogsData || []).reduce((sum, order) => {
          const itemsCost = (order.order_items || []).reduce((s, i: any) => s + ((i.qty || 0) * (i.cost_price || 0)), 0);
          return sum + itemsCost;
        }, 0);
        setTodayCogs(cogsTotal);
        // Low stock widget
        // Simple approach: fetch and filter client side
        const { data: allItems } = await supabase
          .from("menu_items")
          .select("name, stock_quantity, low_stock_threshold")
          .eq("restaurant_id", rid)
          .eq("track_inventory", true);
        const alerts = (allItems || []).filter(
          (i: any) => i.stock_quantity <= i.low_stock_threshold
        );
        setLowStockItems(alerts as any);

        // Expiry alerts: expired or expiring in next 30 days
        const today = new Date().toISOString().split('T')[0];
        const in30Days = new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0];
        const { data: expiryItems } = await supabase
          .from('menu_items')
          .select('name, expiry_date, cost_price, stock_quantity')
          .eq('restaurant_id', rid)
          .not('expiry_date', 'is', null)
          .lte('expiry_date', in30Days)
          .order('expiry_date');
        setExpiringItems((expiryItems || []) as any);
      } catch (err) {
        console.error("[Dashboard] Data load error:", err);
      } finally {
        setDataLoaded(true);
      }
    };

    // Safety valve: force skeletons off after 10s regardless
    const safetyTimer = setTimeout(() => setDataLoaded(true), 10_000);

    loadData();

    return () => { supabase.removeChannel(ch); clearTimeout(safetyTimer); };
  }, [live, rid, isEvent]);

  const acknowledgeNudge = async () => {
    if (!activeNudge) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    await supabase.from("customer_requests").update({ resolved: true }).eq("id", activeNudge.id);
    setActiveNudge(null);
    toast.success("Nudge acknowledged");
  };

   // Stats
  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayOrders = useMemo(() => allOrders.filter((o) => new Date(o.created_at) >= startOfToday), [allOrders, startOfToday]);
  const successful = (o: { status: string; table_number: string; payment_status?: string | null }) => {
    return o.payment_status === "confirmed" || o.payment_status === "cash_pos" || o.payment_status === "cash_paid" || o.payment_status === "pos_paid";
  };
  const todayRevenue = todayOrders.filter(successful).reduce((s, o) => s + Number(o.total), 0);
  const activeTablesCount = new Set(orders.filter((o) => ["pending", "preparing"].includes(o.status)).map((o) => o.table_number)).size;

  const tableStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    allOrders.filter(o => ["pending", "preparing"].includes(o.status)).forEach(o => {
       // if both exist, pending takes priority as 'urgent'
       if (!map[o.table_number] || o.status === 'pending') {
          map[o.table_number] = o.status;
       }
    });
    return map;
  }, [allOrders]);

  const tableCount = restaurant?.table_count || 10;
  const tableNumbers = Array.from({ length: tableCount }, (_, i) => String(i + 1));

  // Chart data
  const chartData = useMemo(() => {
    if (isEvent) {
      // Orders per day for events
      const days = range === "today" ? 1 : RANGE_DAYS[range];
      const buckets: { label: string; date: Date; orders: number }[] = [];
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        buckets.push({ label: d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }), date: d, orders: 0 });
      }
      allOrders.filter(successful).forEach((o) => {
        const d = new Date(o.created_at); d.setHours(0, 0, 0, 0);
        const idx = buckets.findIndex((b) => b.date.getTime() === d.getTime());
        if (idx >= 0) buckets[idx].orders += 1;
      });
      return buckets.map((b) => ({ name: b.label, Orders: b.orders }));
    }
    const days = RANGE_DAYS[range];
    const buckets: { label: string; date: Date; revenue: number; orders: number }[] = [];
     if (range === "today") {
      // hourly buckets
      for (let h = 0; h < 24; h++) {
        const d = new Date(startOfToday); d.setHours(h);
        buckets.push({ label: `${h}:00`, date: d, revenue: 0, orders: 0 });
      }
      todayOrders.filter(successful).forEach((o) => {
        const h = new Date(o.created_at).getHours();
        buckets[h].revenue += Number(o.total);
        buckets[h].orders += 1;
      });
    } else if (range === "1y") {
      // monthly buckets
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ label: d.toLocaleDateString("en-NG", { month: "short" }), date: d, revenue: 0, orders: 0 });
      }
      allOrders.filter(successful).forEach((o) => {
        const d = new Date(o.created_at);
        const idx = buckets.findIndex((b) => b.date.getFullYear() === d.getFullYear() && b.date.getMonth() === d.getMonth());
        if (idx >= 0) { buckets[idx].revenue += Number(o.total); buckets[idx].orders += 1; }
      });
    } else {
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        buckets.push({ label: d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }), date: d, revenue: 0, orders: 0 });
      }
      allOrders.filter(successful).forEach((o) => {
        const d = new Date(o.created_at); d.setHours(0, 0, 0, 0);
        const idx = buckets.findIndex((b) => b.date.getTime() === d.getTime());
        if (idx >= 0) { buckets[idx].revenue += Number(o.total); buckets[idx].orders += 1; }
      });
    }
    return buckets.map((b) => ({ name: b.label, Revenue: b.revenue, Orders: b.orders }));
   }, [allOrders, range, todayOrders, startOfToday, isEvent, requests]);

  const todayRequests = requests.filter((r) => new Date(r.created_at) >= startOfToday);
  const stats = isEvent ? [
    { label: "Orders today", value: String(todayOrders.length), icon: ShoppingBag },
    { label: "Active queues", value: `${activeTablesCount}`, icon: Users },
    { label: "Pending orders", value: String(orders.filter((o) => o.status === "pending").length), icon: Clock },
    { label: "Events", value: String(events.length), icon: TrendingUp },
  ] : [
    { label: "Today's revenue", value: formatNaira(todayRevenue), icon: TrendingUp },
    { label: "Profit Today", value: formatNaira(todayRevenue - todayCogs), icon: TrendingUp },
    { label: "Inventory Value", value: formatNaira(inventoryValue), icon: Package },
    { label: "Pending", value: String(orders.filter((o) => o.status === "pending").length), icon: Clock },
  ];

  const isSuspended = restaurant?.subscription_status === "suspended";

  return (
    <DashboardLayout>
      {isSuspended && (
        <div className="mb-6 bg-destructive/10 border border-destructive/30 text-destructive px-5 py-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="mt-0.5 shrink-0"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase">Account Suspended</h3>
            <p className="text-sm mt-1 opacity-90 leading-relaxed">
              Your business account is currently suspended. Customers cannot access your menu or place orders at this time. Please contact support to resolve this issue.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Good day 👋</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening at {restaurant?.name || "your business"}.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isEvent && averageRating !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span className="text-xs font-bold">{averageRating.toFixed(1)}</span>
            </div>
          )}
          {canToggleLive ? (
            <button
              onClick={toggleLiveStatus}
              disabled={isTogglingLive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-smooth disabled:opacity-60 disabled:cursor-not-allowed ${
                live ? "bg-primary-soft text-primary border-primary/30" : "bg-orange-500/10 text-orange-600 border-orange-500/30"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {live && <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />}
                <span className={`relative h-2 w-2 rounded-full ${live ? "bg-primary" : "bg-orange-500"}`} />
              </span>
              {isTogglingLive ? "Updating..." : live ? "Live" : "Paused"}
            </button>
          ) : (
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              live ? "bg-primary-soft text-primary border-primary/30" : "bg-orange-500/10 text-orange-600 border-orange-500/30"
            }`}>
              <span className="relative flex h-2 w-2">
                {live && <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />}
                <span className={`relative h-2 w-2 rounded-full ${live ? "bg-primary" : "bg-orange-500"}`} />
              </span>
              {live ? "Live" : "Paused"}
            </span>
          )}
        </div>
      </div>

      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" loop />

      {activeNudge && (
        <div className="mb-10 bg-warning border-2 border-warning/50 p-4 sm:p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse shadow-glow shadow-warning/20">
          <div className="flex items-center gap-4 text-black">
            <div className="h-14 w-14 rounded-full bg-black/10 grid place-items-center">
              <BellRing className="h-7 w-7" />
            </div>
            <div>
              <div className="font-black uppercase tracking-tighter text-xl sm:text-2xl leading-none">Table {activeNudge.table} Needs Attention!</div>
              <div className="text-sm font-bold opacity-70 mt-1">Customer has been waiting over 8 minutes</div>
            </div>
          </div>
          <Button onClick={acknowledgeNudge} className="w-full sm:w-auto bg-black text-white hover:bg-black/80 font-black uppercase tracking-widest px-8 h-14 rounded-2xl">
            Acknowledge
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {!dataLoaded
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary grid place-items-center mb-2"><s.icon className="h-4 w-4" /></div>
            <div className="font-display text-xl sm:text-2xl font-bold truncate">{s.value}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {!isEvent && <SubscriptionCard />}

      {/* Low / out-of-stock alert widget */}
      {lowStockItems.length > 0 && (
        <div className="mb-8 bg-warning/10 border border-warning/40 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-warning/20 text-warning grid place-items-center shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {lowStockItems.filter(i => i.stock_quantity <= 0).length > 0
                    ? `${lowStockItems.filter(i => i.stock_quantity <= 0).length} item(s) out of stock`
                    : `${lowStockItems.length} item(s) running low`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lowStockItems.slice(0, 3).map(i => i.name).join(", ")}{lowStockItems.length > 3 ? ` +${lowStockItems.length - 3} more` : ""}
                </p>
              </div>
            </div>
            <Link to="/dashboard/inventory" className="shrink-0 text-xs font-semibold text-primary flex items-center gap-1 hover:underline mt-1">
              View Inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
      {/* Expiry Alert Widget */}
      {expiringItems.length > 0 && (
        <div className="mb-8 bg-destructive/10 border border-destructive/40 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-destructive/20 text-destructive grid place-items-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {expiringItems.length} item(s) expiring soon
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {expiringItems.slice(0, 3).map(i => i.name).join(", ")}{expiringItems.length > 3 ? ` +${expiringItems.length - 3} more` : ""}
                </p>
                <p className="text-xs font-bold text-destructive mt-1">
                  Value at Risk: {formatNaira(expiringItems.reduce((s, i) => s + ((i.stock_quantity || 0) * (i.cost_price || 0)), 0))}
                </p>
              </div>
            </div>
            <Link to="/dashboard/inventory" className="shrink-0 text-xs font-semibold text-destructive flex items-center gap-1 hover:underline mt-1">
              Review Inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Sales chart */}
      {!dataLoaded ? <ChartSkeleton /> : (
      <div className="bg-card border border-border rounded-2xl shadow-soft p-4 sm:p-5 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{isEvent ? "Orders over time" : "Sales over time"}</h2>
            <p className="text-xs text-muted-foreground">{isEvent ? "Successful orders only" : "Successful orders only"}</p>
          </div>
          <div className="flex gap-1 bg-secondary rounded-full p-1">
            {(["today", "7d", "30d", "1y"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-smooth ${range === r ? "bg-card text-primary shadow-soft" : "text-muted-foreground"}`}
              >
                {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : "1 year"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56 sm:h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => isEvent ? String(v) : (v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`)} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, name: string) => name === "Revenue" ? formatNaira(v) : v}
              />
              <Line type="monotone" dataKey={isEvent ? "Orders" : "Revenue"} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {isEvent && (
        <div className="bg-card border border-border rounded-2xl shadow-soft p-4 sm:p-5 mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary animate-pulse" /> Live Broadcast
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Send a real-time announcement to all guests' phones</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="text" 
              placeholder="e.g. The cake cutting will begin in 5 minutes at the main stage!" 
              className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendBroadcast()}
            />
            <Button onClick={sendBroadcast} disabled={isBroadcasting || !broadcastMessage.trim()} className="rounded-xl font-bold px-8 h-auto py-2.5 text-sm uppercase tracking-wider">
              {isBroadcasting ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </div>
      )}

      {/* Live Feed (Orders & Requests) */}
      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden mb-10">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> {isEvent ? "Live Event Pulse" : "Live Activity"}
            </h2>
            <p className="text-sm text-muted-foreground">{isEvent ? "Live feed of guest requests, orders, and feedback" : "Orders, requests, and help alerts"}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/orders" className="text-sm text-primary font-medium">Orders →</Link>
          </div>
        </div>

        <div className="divide-y divide-border">
          {!dataLoaded
            ? Array.from({ length: 5 }).map((_, i) => <OrderRowSkeleton key={i} />)
            : orders.length === 0 && requests.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">No activity yet.</div>
          )}
          
          {/* Combine and sort by date */}
          {(() => {
            const combined = [
              ...orders.map(o => ({ ...o, feedType: 'order' as const })),
              ...requests.map(r => ({ ...r, feedType: 'request' as const })),
              ...messages.map(m => ({ ...m, feedType: 'message' as const }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 10);

            return combined.map((item) => {
              if (item.feedType === 'order') {
                const o = item as any;
                const urgent = o.status === "pending" && (Date.now() - new Date(o.created_at).getTime()) > 2 * 60 * 1000;
                return (
                  <Link to={`/dashboard/orders/${o.id}`} key={o.id} className={`flex items-center gap-4 p-4 hover:bg-secondary/50 transition-smooth ${urgent ? "bg-destructive/5" : ""}`}>
                    <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary grid place-items-center font-display font-bold text-xs sm:text-sm shrink-0">
                      {o.table_number === "Walk-in" ? "OTC" : o.table_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">Order {o.short_code}</span>
                        <StatusPill status={o.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {(o.order_items || []).map((i: any) => `${i.qty}× ${i.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-semibold text-sm">{formatNaira(Number(o.total))}</div>
                      <div className="text-xs text-muted-foreground"><RealTimeAgo date={o.created_at} /></div>
                    </div>
                  </Link>
                );
              } else if (item.feedType === "request") {
                const r = item as any;
                const isUrgent = !r.resolved && (r.type === 'waiter' || r.type === 'help' || r.type === 'complaint');
                return (
                  <div key={r.id} className={`flex items-center gap-4 p-4 ${isUrgent ? "bg-warning/5" : ""}`}>
                    <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning grid place-items-center font-display font-bold text-xs shrink-0">
                      {r.table_number || "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate capitalize">{r.type} Request</span>
                        {!r.resolved && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning">OPEN</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{r.message || "No message provided"}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground"><RealTimeAgo date={r.created_at} /></div>
                  </div>
                );
              } else {
                const m = item as any;
                return (
                  <Link to={`/dashboard/orders/${m.order_id}`} key={m.id} className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-smooth">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center font-display font-bold text-sm shrink-0">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">New Message · {m.orders?.short_code}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">CHAT</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{m.orders?.table_number}: {m.body}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground"><RealTimeAgo date={m.created_at} /></div>
                  </Link>
                );
              }
            });
          })()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: "bg-destructive/10 text-destructive animate-pulse-soft",
    preparing: "bg-blue-500/10 text-blue-600",
    served: "bg-primary-soft text-primary",
    cancelled: "bg-muted text-muted-foreground",
    refunded: "bg-orange-500/10 text-orange-600",
  };
  const labelMap: Record<string, string> = {
    pending: "RECEIVED",
    preparing: "PREPARING",
    served: "SERVED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
  };
  const label = labelMap[status] || status.replace("_", " ").toUpperCase();
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider ${map[status] || "bg-muted text-muted-foreground"}`}>{label}</span>;
};

const SubscriptionCard = () => {
  const { restaurant } = useRestaurant();
  if (!restaurant) return null;
  const status = restaurant.subscription_status ?? "trial";
  const tableCount = restaurant.table_count || 0;
  const currentPlanName = restaurant.subscription_plan || "PharmIQ License";
  const limitLabel = `${tableCount} registers capacity`;
  const trialLeft = trialDaysLeft(restaurant.trial_ends_at);
  const isActive = status === "active";
  const isTrial = status === "trial";

  return (
    <div className="bg-card border border-border rounded-2xl shadow-soft p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 mb-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${isActive ? "bg-primary-soft text-primary" : isTrial ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-semibold text-sm sm:text-base">
              {isActive ? currentPlanName : isTrial ? "Free Trial" : "No active plan"}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-primary-soft text-primary" : isTrial ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
              {isActive ? "ACTIVE" : isTrial ? `${trialLeft}D LEFT` : status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {restaurant.subscription_period === "annual" ? "Yearly" : "Monthly"} billing
          </p>
        </div>
      </div>
      <Button asChild variant={isActive ? "outline" : "hero"} size="sm" className="whitespace-nowrap">
        <Link to="/dashboard/settings#plan">
          {isActive ? "Manage plan" : "Upgrade now"} <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
};

export default Dashboard;
