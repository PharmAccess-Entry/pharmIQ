import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRestaurant } from "@/lib/restaurant";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/format";
import { downloadOrdersPDF } from "@/lib/exportOrders";
import { Calendar as CalendarIcon, Download, TrendingUp, ShoppingBag, DollarSign, MapPin, FileText, Banknote, ArrowLeft, Users } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { StatCardSkeleton, ChartSkeleton } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Analytics() {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const isOffline = useOfflineStatus();

  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [staffList, setStaffList] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);

  const [inputValue, setInputValue] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any | null>(null);
  const [visibleShiftsCount, setVisibleShiftsCount] = useState(10);

  useEffect(() => {
    if (date?.from) {
      if (date.to) {
        setInputValue(`${format(date.from, "MMM d, yyyy")} - ${format(date.to, "MMM d, yyyy")}`);
      } else {
        setInputValue(format(date.from, "MMM d, yyyy"));
      }
    } else {
      setInputValue("");
    }
  }, [date]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      setDate(undefined);
      return;
    }
    const parts = inputValue.split("-").map(p => p.trim());
    if (parts.length === 1) {
      const d = new Date(parts[0]);
      if (!isNaN(d.getTime())) setDate({ from: d, to: undefined });
    } else if (parts.length >= 2) {
      const d1 = new Date(parts[0]);
      const d2 = new Date(parts[1]);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        setDate({ from: d1, to: d2 });
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
      setIsPopoverOpen(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [costMap, setCostMap] = useState<Map<string, number>>(new Map());
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    if (!rid || !date?.from) return;

    const fetchAnalytics = async () => {
      if (!navigator.onLine) {
        // Offline: load from Dexie, filtered by the selected date range
        setLoading(true);
        try {
          const { db } = await import("@/lib/offline/db");
          const toDate = date.to || date.from;
          const fromISO = startOfDay(date.from).toISOString();
          const toISO = endOfDay(toDate).toISOString();
          const fromDateStr = startOfDay(date.from).toISOString().split('T')[0];
          const toDateStr = endOfDay(toDate).toISOString().split('T')[0];

          // Sales filtered by date range
          const localSales = await db.sales
            .where('restaurant_id').equals(rid)
            .filter(s => s.created_at >= fromISO && s.created_at <= toISO)
            .toArray();
          setOrders(localSales);

          // Cost map from Dexie products (cost_price not stored in OfflineProduct schema, use 0)
          setCostMap(new Map());

          // Expenses filtered by date range
          const localExpenses = await db.expenses
            .where('restaurant_id').equals(rid)
            .filter(e => e.date >= fromDateStr && e.date <= toDateStr)
            .toArray();
          const expTotal = localExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
          setTotalExpenses(expTotal);
        } catch (err) {
          console.error('[Analytics] Offline load error:', err);
        } finally {
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const toDate = date.to || date.from; // Default to 'from' date if 'to' is missing
        const { data, error } = await supabase
          .from("orders")
          .select("id, total, status, payment_status, created_at, table_number, user_id, order_items(name, qty, price, menu_item_id)")
          .eq("restaurant_id", rid)
          .gte("created_at", startOfDay(date.from).toISOString())
          .lte("created_at", endOfDay(toDate).toISOString());

        if (error) throw error;
        setOrders(data || []);

        // Fetch cost prices for COGS calculation
        const { data: menuData } = await supabase.from("menu_items").select("id, cost_price").eq("restaurant_id", rid);
        const cm = new Map<string, number>();
        (menuData || []).forEach((m: any) => cm.set(m.id, Number(m.cost_price) || 0));
        setCostMap(cm);

        // Fetch expenses for the selected date range
        const { data: expData } = await supabase
          .from("expenses")
          .select("amount")
          .eq("restaurant_id", rid)
          .gte("expense_date", startOfDay(date.from).toISOString().split('T')[0])
          .lte("expense_date", endOfDay(toDate).toISOString().split('T')[0]);
        const expTotal = (expData || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
        setTotalExpenses(expTotal);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };


    const fetchStaffAndShifts = async () => {
      if (!navigator.onLine) return;
      // Fetch Staff Profiles
      const { data: roles } = await supabase.from("user_roles").select("*").eq("restaurant_id", rid);
      let allStaff: any[] = [];
      if (roles && roles.length > 0) {
        const userIds = roles.map((r: any) => r.user_id);
        const { data: profiles } = await supabase.rpc("get_users_by_ids", { user_ids: userIds });
        if (profiles) {
          allStaff = roles.map((r: any) => {
            const p = profiles.find((p: any) => p.id === r.user_id);
            return { ...r, profile: p };
          });
        }
      }

      // Also fetch the owner profile so shifts by the owner show their name
      if (restaurant?.owner_id) {
        const { data: ownerProfiles } = await supabase.rpc("get_users_by_ids", { user_ids: [restaurant.owner_id] });
        const ownerProfile = ownerProfiles?.[0];
        if (ownerProfile && !allStaff.find(s => s.user_id === restaurant.owner_id)) {
          allStaff.push({ user_id: restaurant.owner_id, role: "owner", profile: ownerProfile });
        }
      }
      setStaffList(allStaff);

      // Fetch Shifts
      const toDate = date.to || date.from;
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("restaurant_id", rid)
        .gte("start_time", startOfDay(date.from).toISOString())
        .lte("start_time", endOfDay(toDate).toISOString())
        .order("start_time", { ascending: false });
      
      if (shiftsData) {
        setShifts(shiftsData);
      }
    };

    setVisibleShiftsCount(10); // Reset pagination on every new fetch
    fetchAnalytics();
    fetchStaffAndShifts();
  }, [rid, date, restaurant]);

  // Derived Metrics
  const successfulOrders = useMemo(() => {
    let filtered = orders;
    if (selectedStaff !== "all") {
      filtered = orders.filter(o => o.user_id === selectedStaff);
    }
    // Treat any completed payment as successful for revenue purposes, EXCEPT if it was refunded or cancelled
    return filtered.filter(o => {
      const isPaid = o.payment_status === "confirmed" || o.payment_status === "cash_pos" || o.payment_status === "cash_paid" || o.payment_status === "pos_paid";
      const isNotRefunded = o.status !== "refunded" && o.status !== "cancelled" && o.status !== "rejected";
      return isPaid && isNotRefunded;
    });
  }, [orders, selectedStaff]);

  const totalRevenue = useMemo(() => {
    return successfulOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [successfulOrders]);

  const cashFlow = useMemo(() => {
    let cash = 0;
    let pos = 0;
    let transfer = 0;
    successfulOrders.forEach(o => {
      const amt = Number(o.total) || 0;
      if (o.payment_status === "cash_paid") cash += amt;
      else if (o.payment_status === "pos_paid" || o.payment_status === "cash_pos") pos += amt;
      else if (o.payment_status === "confirmed") transfer += amt;
    });
    return { cash, pos, transfer };
  }, [successfulOrders]);

  const averageOrderValue = successfulOrders.length > 0 
    ? totalRevenue / successfulOrders.length 
    : 0;

  const totalCogs = useMemo(() => {
    let sum = 0;
    successfulOrders.forEach(o => {
      o.order_items?.forEach((item: any) => {
        // Prefer the snapshot cost_price stored on the order_item; fall back to current cost_price from costMap
        const cost = (item.cost_price != null && item.cost_price > 0) ? Number(item.cost_price) : (costMap.get(item.menu_item_id) || 0);
        sum += (item.qty || 0) * cost;
      });
    });
    return sum;
  }, [successfulOrders, costMap]);

  const grossProfit = totalRevenue - totalCogs;
  const netProfit = grossProfit - totalExpenses;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Chart Data
  const chartData = useMemo(() => {
    if (!date?.from || !date?.to) return [];
    
    // Create buckets for each day in range
    const buckets: { label: string; date: Date; revenue: number; orders: number }[] = [];
    let current = new Date(date.from);
    while (current <= date.to) {
      buckets.push({
        label: format(current, "MMM d"),
        date: new Date(current),
        revenue: 0,
        orders: 0
      });
      current.setDate(current.getDate() + 1);
    }

    // Fill buckets
    successfulOrders.forEach(o => {
      const orderDate = new Date(o.created_at);
      const bucket = buckets.find(b => isSameDay(b.date, orderDate));
      if (bucket) {
        bucket.revenue += Number(o.total) || 0;
        bucket.orders += 1;
      }
    });

    return buckets.map(b => ({
      name: b.label,
      Revenue: b.revenue,
      Orders: b.orders
    }));
  }, [successfulOrders, date]);

  // Top Items
  const topItems = useMemo(() => {
    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    
    successfulOrders.forEach(o => {
      o.order_items?.forEach((item: any) => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemCounts[item.name].qty += item.qty;
        itemCounts[item.name].revenue += (item.qty * (Number(item.price) || 0));
      });
    });

    return Object.values(itemCounts)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [successfulOrders]);

  // Sales Channels
  const topTables = useMemo(() => {
    const tableCounts: Record<string, { table: string; orders: number; revenue: number }> = {};
    successfulOrders.forEach(o => {
      const t = o.table_number || "?";
      if (!tableCounts[t]) tableCounts[t] = { table: t, orders: 0, revenue: 0 };
      tableCounts[t].orders += 1;
      tableCounts[t].revenue += Number(o.total) || 0;
    });
    return Object.values(tableCounts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);
  }, [successfulOrders]);

  // Staff Performance
  const staffPerformance = useMemo(() => {
    const perf: Record<string, { staffId: string; name: string; orders: number; revenue: number }> = {};
    
    // Group only when viewing 'all' staff or evaluating the selected staff
    const ordersToEval = selectedStaff === "all" ? orders : orders.filter(o => o.user_id === selectedStaff);
    
    const successfulEval = ordersToEval.filter(o => o.payment_status === "confirmed" || o.payment_status === "cash_pos" || o.payment_status === "cash_paid" || o.payment_status === "pos_paid");

    successfulEval.forEach(o => {
      const staffId = o.user_id || "unassigned";
      let name = "Unassigned / Admin";
      if (staffId !== "unassigned") {
        const staffMember = staffList.find(s => s.user_id === staffId);
        name = staffMember?.profile?.full_name || staffMember?.profile?.email || "Unknown Staff";
      }

      if (!perf[staffId]) perf[staffId] = { staffId, name, orders: 0, revenue: 0 };
      perf[staffId].orders += 1;
      perf[staffId].revenue += Number(o.total) || 0;
    });

    return Object.values(perf).sort((a, b) => b.revenue - a.revenue);
  }, [orders, staffList, selectedStaff]);

  // CSV Export
  const downloadCSV = () => {
    if (orders.length === 0) {
      toast.error("No data to export for this date range");
      return;
    }

    const headers = ["Date", "Order ID", "Status", "Payment", "Items", "Total (NGN)"];
    const rows = orders.map(o => [
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
      o.id,
      o.status,
      o.payment_status || 'unpaid',
      o.order_items?.map((i: any) => `${i.qty}x ${i.name}`).join("; ") || "",
      Number(o.total) || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smarttable-analytics-${format(date?.from || new Date(), "MMM-d")}-to-${format(date?.to || new Date(), "MMM-d")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Download started!");
  };

  const downloadPDF = () => {
    if (orders.length === 0) {
      toast.error("No data to export for this date range");
      return;
    }
    
    const exportData = orders.map(o => ({
      ...o,
      short_code: o.short_code || o.id.substring(0, 8).toUpperCase(),
      intent: o.intent || "dine_in",
      customer_name: o.customer_name || ""
    }));

    downloadOrdersPDF(
      exportData,
      {
        restaurantName: restaurant?.name || "PharmIQ",
        rangeLabel: date?.to ? "Custom Range" : "Single Day",
        from: date?.from || new Date(),
        to: date?.to || date?.from || new Date()
      },
      `smarttable-analytics-${format(date?.from || new Date(), "MMM-d")}-to-${format(date?.to || date?.from || new Date(), "MMM-d")}.pdf`
    );
    toast.success("PDF Download started!");
  };

  return (
    <DashboardLayout>
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — Analytics requires an active internet connection to load new data.</span>
        </div>
      )}
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Deep dive into your sales and top performing items.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {staffList.length > 0 && (
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="w-full sm:w-[180px] bg-card">
                <SelectValue placeholder="Filter by staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.profile?.full_name || s.profile?.email || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <div className="relative w-full sm:w-[260px]">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
                <Input
                  className={cn(
                    "pl-9 w-full font-normal bg-card border-border",
                    !date && "text-muted-foreground"
                  )}
                  placeholder="Pick a date range"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={downloadCSV} variant="outline" className="flex-1 sm:flex-none bg-card">
              <Download className="h-4 w-4 mr-2" />
              <span>CSV</span>
            </Button>
            <Button onClick={downloadPDF} variant="outline" className="flex-1 sm:flex-none bg-card">
              <FileText className="h-4 w-4 mr-2" />
              <span>PDF</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
          {/* Top Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
                  <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary grid place-items-center mb-3">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div className="font-display text-2xl font-bold">{formatNaira(totalRevenue)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Revenue</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center mb-3">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="font-display text-2xl font-bold">{successfulOrders.length}</div>
                  <div className="text-sm text-muted-foreground mt-1">Successful Orders</div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center mb-3">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="font-display text-2xl font-bold">{formatNaira(averageOrderValue)}</div>
                  <div className="text-sm text-muted-foreground mt-1">Average Order Value</div>
                </div>
              </>
            )}
          </div>

          {!loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Cost of Goods (COGS)</div>
                  <div className="font-display text-xl font-bold text-foreground">{formatNaira(totalCogs)}</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Gross Profit</div>
                  <div className="font-display text-xl font-bold text-foreground">{formatNaira(grossProfit)}</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Gross Margin</div>
                  <div className="font-display text-xl font-bold text-foreground">{grossMargin.toFixed(1)}%</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Operating Expenses</div>
                  <div className="font-display text-xl font-bold text-destructive">{formatNaira(totalExpenses)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Logged in the Expenses module</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className={`border rounded-xl p-4 shadow-sm flex items-center justify-between ${netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-destructive/5 border-destructive/20'}`}>
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Net Profit</div>
                  <div className={`font-display text-xl font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>{formatNaira(netProfit)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Gross Profit − Expenses</div>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </div>
            </div>
          )}

          {/* Cashflow Breakdown */}
          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Cash Collected</div>
                  <div className="font-display text-xl font-bold text-foreground">{formatNaira(cashFlow.cash)}</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">POS Terminal</div>
                  <div className="font-display text-xl font-bold text-foreground">{formatNaira(cashFlow.pos)}</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Banknote className="h-5 w-5" />
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Bank Transfers</div>
                  <div className="font-display text-xl font-bold text-foreground">{formatNaira(cashFlow.transfer)}</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                  <ArrowLeft className="h-5 w-5 rotate-[135deg]" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="top-tables-section">
            {/* Chart */}
            <div className="lg:col-span-2">
              {loading ? <ChartSkeleton /> : (
              <div className="bg-card border border-border rounded-2xl shadow-soft p-5 h-full">
                <div className="mb-4">
                  <h2 className="font-display text-lg font-semibold">Revenue Trend</h2>
                  <p className="text-xs text-muted-foreground">Daily revenue across selected dates</p>
                </div>
                <div className="h-[300px] -ml-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis 
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `₦${(v / 1000).toFixed(0)}k` : `₦${v}`} 
                      />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: number, name: string) => name === "Revenue" ? formatNaira(v) : v}
                      />
                      <Line type="monotone" dataKey="Revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>

            {/* Top Items */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5 flex flex-col">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold">Top Selling Items</h2>
                <p className="text-xs text-muted-foreground">Based on revenue generated</p>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {topItems.length > 0 ? (
                  <div className="space-y-4">
                    {topItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-secondary text-muted-foreground text-xs font-bold grid place-items-center shrink-0">
                            #{i + 1}
                          </div>
                          <div className="min-w-0 pr-4">
                            <p className="text-sm font-semibold truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.qty} units sold</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-primary">{formatNaira(item.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                    <ShoppingBag className="h-8 w-8 opacity-20 mb-2" />
                    <p className="text-sm">No sales data found for this period</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Sales Channels */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Sales Channels
                </h2>
                <p className="text-xs text-muted-foreground">Most active channels by order count</p>
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
              ) : topTables.length > 0 ? (
                <div className="space-y-3">
                  {topTables.map((t, i) => {
                    const pct = Math.round((t.orders / (topTables[0]?.orders || 1)) * 100);
                    return (
                      <div key={t.table}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary text-xs font-black grid place-items-center shrink-0">
                              #{i + 1}
                            </div>
                            <span className="text-sm font-semibold">{t.table}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-primary">{t.orders} orders</span>
                            <span className="text-xs text-muted-foreground ml-2">{formatNaira(t.revenue)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <MapPin className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">No channel data for this period</p>
                </div>
              )}
            </div>

            {/* Staff Performance */}
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Staff Performance
                </h2>
                <p className="text-xs text-muted-foreground">Revenue generated per staff member</p>
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
              ) : staffPerformance.length > 0 ? (
                <div className="space-y-3">
                  {staffPerformance.map((s, i) => {
                    const pct = Math.round((s.revenue / (staffPerformance[0]?.revenue || 1)) * 100);
                    return (
                      <div key={s.staffId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary text-xs font-black grid place-items-center shrink-0">
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold truncate max-w-[150px] sm:max-w-[200px]">{s.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-primary">{formatNaira(s.revenue)}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.orders} orders</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                  <Users className="h-8 w-8 opacity-20 mb-2" />
                  <p className="text-sm">No staff performance data</p>
                </div>
              )}
            </div>
          </div>

          {/* Shift Reports Table */}
          {selectedStaff === "all" && (
            <div className="bg-card border border-border rounded-2xl shadow-soft p-5 mt-6 overflow-hidden">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" /> Shift Reports
                </h2>
                <p className="text-xs text-muted-foreground">End of day handover reports and variance.</p>
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date / Staff</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Start Cash</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Expected</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Actual</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                          No shifts recorded for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      shifts.slice(0, visibleShiftsCount).map((shift) => {
                        const staffMember = staffList.find(s => s.user_id === shift.user_id);
                        const staffName = staffMember?.profile?.full_name || staffMember?.profile?.email || (shift.user_id === restaurant?.owner_id ? "Owner" : "Unknown Staff");
                        const expectedCash = Number(shift.expected_cash) || 0;
                        const actualCash = Number(shift.actual_cash) || 0;
                        const cashVariance = actualCash - expectedCash;
                        const expectedPos = Number(shift.expected_pos) || 0;
                        const actualPos = Number(shift.actual_pos) || 0;
                        const posVariance = actualPos - expectedPos;
                        const expectedTransfers = Number(shift.expected_transfers) || 0;
                        const actualTransfers = Number(shift.actual_transfers) || 0;
                        const transferVariance = actualTransfers - expectedTransfers;
                        const totalVariance = cashVariance + posVariance + transferVariance;
                        const isShort = totalVariance < 0;
                        const isOver = totalVariance > 0;

                        return (
                          <TableRow 
                            key={shift.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedShiftDetails({ ...shift, staffName, expectedCash, actualCash, cashVariance, expectedPos, actualPos, posVariance, expectedTransfers, actualTransfers, transferVariance, totalVariance, isShort, isOver })}
                          >
                            <TableCell>
                              <div className="font-medium whitespace-nowrap">{format(new Date(shift.start_time), "MMM d, h:mm a")}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]">{staffName}</div>
                              {shift.notes && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 italic truncate max-w-[120px] sm:max-w-[180px] mt-0.5" title={shift.notes}>
                                  📝 {shift.notes}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={shift.status === "completed" ? "outline" : "default"} className={shift.status === "completed" ? "bg-green-500/10 text-green-600 border-green-500/20" : ""}>
                                {shift.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatNaira(Number(shift.start_cash) || 0)}</TableCell>
                            <TableCell className="text-right">
                              {(shift.status === "completed" || shift.status === "settled") ? (
                                <div className="text-xs space-y-0.5">
                                  <div>Cash: {formatNaira(expectedCash)}</div>
                                  <div className="text-muted-foreground">POS: {formatNaira(expectedPos)}</div>
                                  <div className="text-muted-foreground">Transfers: {formatNaira(expectedTransfers)}</div>
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {(shift.status === "completed" || shift.status === "settled") ? (
                                <div className="text-xs space-y-0.5">
                                  <div>Cash: {formatNaira(actualCash)}</div>
                                  <div className="text-muted-foreground">POS: {formatNaira(actualPos)}</div>
                                  <div className="text-muted-foreground">Transfers: {formatNaira(actualTransfers)}</div>
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {(shift.status === "completed" || shift.status === "settled") ? (
                                <span className={`font-bold text-sm whitespace-nowrap ${isShort ? "text-destructive" : isOver ? "text-amber-500" : "text-green-600"}`}>
                                  {isShort ? `▼ ${formatNaira(Math.abs(totalVariance))} SHORT` : isOver ? `▲ ${formatNaira(Math.abs(totalVariance))} OVER` : "✓ BALANCED"}
                                </span>
                              ) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {shifts.length > visibleShiftsCount && (
                <div className="mt-4 flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setVisibleShiftsCount(prev => prev + 10)}
                    className="w-full sm:w-auto"
                  >
                    Load More Shifts
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Dialog open={!!selectedShiftDetails} onOpenChange={(open) => !open && setSelectedShiftDetails(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Shift Details</DialogTitle>
            </DialogHeader>
            {selectedShiftDetails && (
              <div className="space-y-4 py-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground font-medium">Staff Member</span>
                  <span className="font-bold">{selectedShiftDetails.staffName}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground font-medium">Time</span>
                  <span className="font-medium text-right">
                    {format(new Date(selectedShiftDetails.start_time), "MMM d, yyyy h:mm a")} <br/>
                    to {selectedShiftDetails.end_time ? format(new Date(selectedShiftDetails.end_time), "h:mm a") : "Active"}
                  </span>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cash (Started with {formatNaira(selectedShiftDetails.start_cash || 0)})</span>
                    <span className="text-sm text-right">
                      Exp: {formatNaira(selectedShiftDetails.expectedCash)} <br/>
                      Act: <span className="font-bold">{formatNaira(selectedShiftDetails.actualCash)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/50 pt-2">
                    <span className="text-sm font-medium">POS Terminal</span>
                    <span className="text-sm text-right">
                      Exp: {formatNaira(selectedShiftDetails.expectedPos)} <br/>
                      Act: <span className="font-bold">{formatNaira(selectedShiftDetails.actualPos)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-border/50 pt-2">
                    <span className="text-sm font-medium">Bank Transfers</span>
                    <span className="text-sm text-right">
                      Exp: {formatNaira(selectedShiftDetails.expectedTransfers)} <br/>
                      Act: <span className="font-bold">{formatNaira(selectedShiftDetails.actualTransfers)}</span>
                    </span>
                  </div>
                </div>

                <div className="bg-primary/5 p-4 rounded-xl border border-primary/20">
                  <p className="text-sm leading-relaxed">
                    <strong>{selectedShiftDetails.staffName}</strong> made total sales of <strong>{formatNaira(selectedShiftDetails.expectedCash + selectedShiftDetails.expectedPos + selectedShiftDetails.expectedTransfers)}</strong>. 
                    <br/><br/>
                    They reported a final variance of <strong className={selectedShiftDetails.isShort ? "text-destructive" : selectedShiftDetails.isOver ? "text-amber-500" : "text-green-600"}>
                      {selectedShiftDetails.isShort ? "a shortage" : selectedShiftDetails.isOver ? "an overage" : "a perfect balance"} of {formatNaira(Math.abs(selectedShiftDetails.totalVariance))}
                    </strong>.
                  </p>
                </div>

                {selectedShiftDetails.notes && (
                  <div className="mt-4 pt-2 border-t">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Shift Notes</span>
                    <p className="text-sm mt-1 italic">"{selectedShiftDetails.notes}"</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
    </DashboardLayout>
  );
}
