import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import {
  Loader2, ShieldCheck, Users, Activity, ExternalLink, LogOut,
  DollarSign, Building, Calendar, Clock, Phone, ChevronLeft, ChevronRight,
  AlertTriangle, Star, Home, Search, Filter, Mail, UserX
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { monthlyPriceForTables, annualPriceFor } from "@/lib/restaurantData";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/lib/theme";

// ── Types ────────────────────────────────────────────────────────────────────
type AdminRow = {
  auth_user_id: string;
  owner_email: string;
  user_created_at: string;
  // nullable — null when the user signed up but never set up a business
  id: string | null;
  created_at: string | null;
  name: string | null;
  owner_id: string | null;
  business_type: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_period: string | null;
  table_count: number | null;
  trial_ends_at: string | null;
  subscription_expires_at: string | null;
  last_payment_at: string | null;
  phone: string | null;
  logo_url: string | null;
  // Event aggregates (only meaningful for business_type = 'event')
  total_events: number;
  total_event_revenue: number;
  has_future_paid_event: boolean;
  is_staff?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const decodeHtml = (str: string | null): string | null => {
  if (!str) return str;
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};

/** Returns the status string we display in the badge */
const getDisplayStatus = (r: AdminRow): string => {
  if (!r.id) {
    if (r.is_staff) return "staff";
    return "not_setup";
  }

  if (r.business_type === "event") {
    // Events: active only when there is at least one paid event with a future date.
    // There is NO "trial" concept for events.
    return r.has_future_paid_event ? "active" : "expired";
  }

  // Restaurant
  const raw = r.subscription_status || "trial";
  if (raw === "suspended") return "suspended";

  if (raw === "active") {
    const expiry = r.subscription_expires_at;
    if (expiry && new Date(expiry) < new Date()) return "expired";
    return "active";
  }

  // trial — show expired if the trial window has passed
  if (r.trial_ends_at && new Date(r.trial_ends_at) < new Date()) return "expired";
  return raw; // 'trial'
};

/** Subscription revenue PharmIQ earned from a single client */
const restaurantSubRevenue = (r: AdminRow): number => {
  if (r.subscription_status !== "active" || r.business_type === "event") return 0;
  
  let monthly = 0;
  if (r.business_type === "pharmacy") {
    monthly = 5000;
  } else {
    // Handle legacy fixed-price plans from before the 2k/table dynamic pricing
    const plan = r.subscription_plan?.toLowerCase() || "";
    if (plan.includes("pro")) monthly = 15000;
    else if (plan.includes("growth")) monthly = 10000;
    else if (plan.includes("starter")) monthly = 5000;
    else {
      // New dynamic pricing
      monthly = monthlyPriceForTables(r.table_count || 0);
    }
  }
  
  return r.subscription_period === "annual" ? annualPriceFor(monthly) : monthly;
};

/** Human-readable display name for a row */
const displayName = (r: AdminRow): string =>
  decodeHtml(r.name) || r.owner_email;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selected, setSelected] = useState<AdminRow | null>(null);

  const isAdmin =
    user?.email === "lightorbinnovations@gmail.com" ||
    user?.email === "olatunbosunfemi5@gmail.com";

  // ── Auth gate ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const hasTgData = tg && tg.initData;

    if (!hasTgData && !import.meta.env.DEV) {
      setError("Unauthorized. Please access this page via the PharmIQ Telegram Bot.");
      setLoading(false);
      return;
    }
    if (user && !isAdmin && !import.meta.env.DEV) {
      setError("Unauthorized. You are not a super admin.");
      setLoading(false);
      return;
    }
    if ((user && isAdmin) || import.meta.env.DEV) {
      fetchAdminData();
      return;
    }
    if (hasTgData) handleTelegramLogin(tg.initData);
  }, [user, isAdmin]);

  const handleTelegramLogin = async (initData: string) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ initData, redirectUrl: window.location.origin + "/super-admin" }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed to auth via Telegram");
      const { action_link } = await res.json();
      if (action_link) window.location.href = action_link;
      else throw new Error("No action link returned");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchAdminData = async () => {
    try {
      setLoading(true);

      let rows: AdminRow[] = [];

      // The RPC is SECURITY DEFINER, so we can always call it (even in DEV bypass without a user)
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_all_restaurants_admin");
      if (!rpcErr && rpcData) {
        rows = (rpcData as AdminRow[]).map(r => ({ ...r, name: decodeHtml(r.name) }));
      }

      if (!rows.length && rpcErr) {
        console.error("RPC failed, falling back to direct table query:", rpcErr);
        // Fallback only if RPC actually fails
        const { data: tableData, error: tableErr } = await supabase
          .from("restaurants")
          .select("*")
          .order("created_at", { ascending: false });
        if (tableErr) throw tableErr;
        rows = (tableData || []).map(r => ({
          auth_user_id: r.owner_id,
          owner_email: "",
          user_created_at: r.created_at,
          ...r,
          name: decodeHtml(r.name),
          total_events: 0,
          total_event_revenue: 0,
          has_future_paid_event: false,
          is_staff: false,
        }));
      }

      setData(rows);

      // ── Compute stats ──
      const totalUsers    = rows.length;
      const restaurantCnt = rows.filter(r => r.business_type === "restaurant").length;
      const pharmacyCnt   = rows.filter(r => r.business_type === "pharmacy").length;
      const eventCnt      = rows.filter(r => r.business_type === "event").length;
      const notSetupCnt   = rows.filter(r => !r.id && !r.is_staff).length;

      // Active = restaurant with non-expired active sub OR event with a future paid event
      const activeCnt = rows.filter(r => getDisplayStatus(r) === "active").length;

      // Tables only counted for restaurant-type owners (events use per-event tables)
      const totalTables = rows
        .filter(r => r.business_type === "restaurant")
        .reduce((s, r) => s + (r.table_count || 0), 0);

      // Revenue
      const restRevenue = rows
        .filter(r => r.business_type === "restaurant" || r.business_type === "pharmacy")
        .reduce((s, r) => s + restaurantSubRevenue(r), 0);

      const eventRevenue = rows
        .filter(r => r.business_type === "event")
        .reduce((s, r) => s + Number(r.total_event_revenue || 0), 0);

      setStats({
        totalUsers,
        restaurantCnt,
        pharmacyCnt,
        eventCnt,
        notSetupCnt,
        activeCnt,
        totalTables,
        totalPayments: restRevenue + eventRevenue,
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return data.filter(r => {
      const nameMatch = displayName(r).toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.owner_email.toLowerCase().includes(searchTerm.toLowerCase());

      const typeMatch =
        typeFilter === "all" ||
        (typeFilter === "not_setup" && !r.id) ||
        (r.business_type || "") === typeFilter;

      const actualStatus = getDisplayStatus(r);
      const statusMatch = statusFilter === "all" || actualStatus === statusFilter;

      return nameMatch && typeMatch && statusMatch;
    });
  }, [data, searchTerm, typeFilter, statusFilter]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  useEffect(() => setCurrentPage(1), [searchTerm, typeFilter, statusFilter]);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const openViewModal = (r: AdminRow) => {
    setSelected(r);
    setViewModalOpen(true);
  };

  /** Revenue PharmIQ earned FROM this specific client */
  const clientRevenue = (r: AdminRow): number => {
    if (!r.id) return 0;
    if (r.business_type === "event") return Number(r.total_event_revenue || 0);
    return restaurantSubRevenue(r);
  };

  const toggleStatus = async () => {
    if (!selected?.id) return;
    const isSuspended = selected.subscription_status === "suspended";
    let newStatus = "suspended";

    if (isSuspended) {
      // Restore to correct status
      if (selected.subscription_expires_at && new Date(selected.subscription_expires_at) > new Date()) {
        newStatus = "active";
      } else if (selected.trial_ends_at && new Date(selected.trial_ends_at) > new Date()) {
        newStatus = "trial";
      } else {
        newStatus = "trial"; // expired trial — at least they can log in
      }
    }

    const { error } = await supabase
      .from("restaurants")
      .update({ subscription_status: newStatus })
      .eq("id", selected.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(isSuspended ? "Business reactivated" : "Business suspended");
      fetchAdminData();
      setSuspendModalOpen(false);
      setSelected(null);
    }
  };

  // ── Status badge ───────────────────────────────────────────────────────────
  const StatusBadge = ({ r }: { r: AdminRow }) => {
    const status = getDisplayStatus(r);
    const cfg: Record<string, { cls: string; label: string }> = {
      active:    { cls: "bg-green-500/10 text-green-600 dark:text-green-400", label: "Active" },
      trial:     { cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Trial" },
      expired:   { cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",   label: "Expired" },
      suspended: { cls: "bg-destructive/10 text-destructive",                 label: "Suspended" },
      not_setup: { cls: "bg-secondary text-muted-foreground",                 label: "No Business" },
      staff:     { cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",    label: "Staff" },
    };
    const { cls, label } = cfg[status] ?? cfg.trial;
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${cls}`}>
        {label}
      </span>
    );
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-center flex flex-col items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-bold font-display">Loading Dashboard...</h2>
        <p className="text-sm text-muted-foreground mt-2">Fetching platform statistics</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md w-full bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-6 text-center shadow-lg">
        <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-80" />
        <h1 className="text-2xl font-black mb-2 uppercase tracking-tight">Access Denied</h1>
        <p className="font-medium text-sm mb-6">{error}</p>
        <Button variant="outline" className="w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-white" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );

  if (!import.meta.env.DEV && (!user || !isAdmin)) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet><title>Platform Management | PharmIQ</title></Helmet>

      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0">
              <img src="/logopng.png" alt="PharmIQ Logo" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
              <div className="hidden h-full w-full bg-primary text-primary-foreground grid place-items-center shadow-glow">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div>
              <h1 className="font-black text-lg leading-none tracking-tight capitalize">PharmIQ</h1>
              <p className="text-[10px] font-bold text-muted-foreground tracking-widest mt-0.5 capitalize">Platform Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/"} className="hover:text-primary hover:border-primary/30 md:hidden" aria-label="Go to App">
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-primary-soft text-primary grid place-items-center mb-2">
              <Users className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Total Users</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center mb-2">
              <Building className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.restaurantCnt ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Pharmacies</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center mb-2">
              <Activity className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.pharmacyCnt ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Pharmacies</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center mb-2">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.eventCnt ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Event Owners</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 text-green-600 grid place-items-center mb-2">
              <Activity className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.activeCnt ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Active Subs</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center mb-2">
              <Users className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold">{stats?.totalTables ?? 0}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Total Tables</div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft bg-primary-soft/30 border-primary/20">
            <div className="h-9 w-9 rounded-lg bg-primary/20 text-primary grid place-items-center mb-2">
              <DollarSign className="h-4 w-4" />
            </div>
            <div className="font-display text-xl sm:text-2xl font-bold truncate text-primary">{formatNaira(stats?.totalPayments || 0)}</div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">Sub Revenue</div>
          </div>
        </div>

        {/* Master List */}
        <div className="bg-card rounded-3xl border border-border shadow-soft overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black font-display">All Registered Users</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Every account on the platform — including incomplete signups.
                {stats?.notSetupCnt > 0 && (
                  <span className="ml-1 text-amber-600 font-medium">{stats.notSetupCnt} haven't set up a business yet.</span>
                )}
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Search name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-60 bg-secondary/50 border-border rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px] pl-9 bg-secondary/50 border-border rounded-xl font-medium">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="restaurant">Pharmacies</SelectItem>
                      <SelectItem value="pharmacy">Pharmacies</SelectItem>
                      <SelectItem value="event">Event Owners</SelectItem>
                      <SelectItem value="not_setup">Not Set Up</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] pl-9 bg-secondary/50 border-border rounded-xl font-medium">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="not_setup">No Business</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-bold tracking-widest">Name / Email</th>
                  <th className="px-6 py-4 font-bold tracking-widest">Type</th>
                  <th className="px-6 py-4 font-bold tracking-widest">Status</th>
                  <th className="px-6 py-4 font-bold tracking-widest">Tables</th>
                  <th className="px-6 py-4 font-bold tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map(r => (
                  <tr
                    key={r.auth_user_id}
                    className={`transition-colors ${!r.id ? "opacity-60 bg-secondary/10" : "hover:bg-secondary/30"}`}
                  >
                    {/* Name + email */}
                    <td className="px-6 py-4 font-bold">
                      <div className="flex items-center gap-3">
                        {r.logo_url ? (
                          <img src={r.logo_url} className="h-8 w-8 rounded-lg object-cover border border-border shrink-0" alt="" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-secondary grid place-items-center shrink-0">
                            {r.id ? <Building className="h-4 w-4 opacity-50" /> : (r.is_staff ? <Users className="h-4 w-4 opacity-50 text-blue-500" /> : <UserX className="h-4 w-4 opacity-40" />)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate max-w-[180px]" title={decodeHtml(r.name) || r.owner_email}>
                            {decodeHtml(r.name) || <span className="text-muted-foreground italic">No business name</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-normal truncate max-w-[180px]" title={r.owner_email}>
                            {r.owner_email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4 capitalize font-medium text-muted-foreground">
                      {r.business_type
                        ? (r.business_type === "event" ? "Event" : r.business_type === "pharmacy" ? "Pharmacy" : "Pharmacy")
                        : (r.is_staff ? "Staff" : <span className="italic text-xs">—</span>)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4"><StatusBadge r={r} /></td>

                    {/* Tables */}
                    <td className="px-6 py-4 font-bold text-muted-foreground">
                      {r.business_type === "event"
                        ? <span title="Per-event tables, not a subscription count">—</span>
                        : r.business_type === "pharmacy" ? <span title="Pharmacies don't use tables">—</span> : (r.table_count ?? "—")}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline" size="sm"
                          className="h-8 text-xs rounded-lg"
                          onClick={() => openViewModal(r)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View
                        </Button>
                        {r.id && (
                          <Button
                            variant={r.subscription_status === "suspended" ? "default" : "destructive"}
                            size="sm"
                            className="h-8 text-xs rounded-lg w-20"
                            onClick={() => { setSelected(r); setSuspendModalOpen(true); }}
                          >
                            {r.subscription_status === "suspended" ? "Unban" : "Suspend"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/20">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                <span className="font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of{" "}
                <span className="font-bold">{filtered.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs font-bold px-2">Page {currentPage} of {totalPages}</div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── View Details Modal ──────────────────────────────────────────────── */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="min-w-0 w-full overflow-hidden">
            <DialogTitle className="flex items-center gap-3 text-xl min-w-0 pr-6">
              {selected?.logo_url ? (
                <img src={selected.logo_url} className="h-10 w-10 rounded-xl object-cover border border-border shrink-0" alt="" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-secondary grid place-items-center shrink-0">
                  {selected?.id ? <Building className="h-5 w-5 opacity-50" /> : (selected?.is_staff ? <Users className="h-5 w-5 opacity-50 text-blue-500" /> : <UserX className="h-5 w-5 opacity-40" />)}
                </div>
              )}
              <span className="truncate flex-1 min-w-0 text-left">
                {decodeHtml(selected?.name) || selected?.owner_email || "User"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-left break-all">
              {selected?.owner_email}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-4">
              {/* Status + Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/50 p-3 rounded-lg">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Business Type</p>
                  <p className="font-medium capitalize">
                    {selected.business_type
                      ? (selected.business_type === "event" ? "Event Owner" : selected.business_type === "pharmacy" ? "Pharmacy" : "Pharmacy")
                      : (selected.is_staff ? "Staff Member" : "Not set up")}
                  </p>
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Status</p>
                  <StatusBadge r={selected} />
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-3 bg-secondary/30 p-4 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium break-all">{selected.owner_email}</span>
                </div>
                {selected.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{selected.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">
                    Registered: {format(new Date(selected.user_created_at), "PPP")}
                  </span>
                </div>
                {selected.id && selected.business_type !== "event" && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {selected.subscription_status === "active"
                        ? `Sub expires: ${selected.subscription_expires_at ? format(new Date(selected.subscription_expires_at), "PPP") : "N/A"}`
                        : `Trial ends: ${selected.trial_ends_at ? format(new Date(selected.trial_ends_at), "PPP") : "N/A"}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Plan / Event info */}
              {selected.id && (
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-3">
                  {selected.business_type === "event" ? (
                    <>
                      <p className="text-[10px] uppercase font-bold text-primary">Event Activity</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Events</span>
                        <span className="font-bold">{selected.total_events}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid Events</span>
                        <span className="font-bold">{selected.paid_events}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-primary/10">
                        <div className="flex items-center gap-2 text-primary shrink-0">
                          <Star className="h-4 w-4 shrink-0" />
                          <p className="text-xs font-bold uppercase">Total Revenue Paid</p>
                        </div>
                        <span className="font-display font-black text-lg text-right">
                          {formatNaira(Number(selected.total_event_revenue || 0))}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-primary">Subscription Info</p>
                          <div className="text-sm font-medium mt-0.5">
                            {selected.subscription_plan || (selected.subscription_status === "trial" ? "Free Trial" : "No Plan")}
                            {selected.subscription_period && (
                              <span className="ml-1 text-muted-foreground capitalize">· {selected.subscription_period}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-black shrink-0">{selected.table_count ?? 0} Tables</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-primary/10">
                        <div className="flex items-center gap-2 text-primary shrink-0">
                          <Star className="h-4 w-4 shrink-0" />
                          <p className="text-xs font-bold uppercase">Revenue Paid</p>
                        </div>
                        <span className="font-display font-black text-lg text-right">
                          {formatNaira(clientRevenue(selected))}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!selected.id && selected.is_staff && (
                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-700 dark:text-blue-400">
                  This user is registered as a staff member for an existing business.
                </div>
              )}
              
              {!selected.id && !selected.is_staff && (
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                  This user signed up but has not completed business setup yet. You can email them to encourage onboarding.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>Close</Button>
            <Button
              onClick={() => {
                const email = selected?.owner_email;
                if (email) {
                  navigator.clipboard.writeText(email).catch(() => {});
                  toast.success(`Copied ${email} to clipboard!`);
                  const a = document.createElement("a");
                  a.href = `mailto:${email}?subject=PharmIQ%20-%20Let%27s%20talk`;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } else {
                  toast.error("No email found for this user");
                }
              }}
            >
              <Mail className="h-4 w-4 mr-2" /> Send Mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend / Unban Modal ───────────────────────────────────────────── */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-[425px] overflow-hidden">
          <DialogHeader className="min-w-0 w-full overflow-hidden">
            <DialogTitle className="flex items-center gap-2 text-destructive min-w-0 pr-6">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="truncate flex-1 min-w-0 text-left">
                {selected?.subscription_status === "suspended" ? "Unban" : "Suspend"} {decodeHtml(selected?.name) || selected?.owner_email}?
              </span>
            </DialogTitle>
            <DialogDescription>
              {selected?.subscription_status === "suspended"
                ? `Reactivating will restore their full dashboard access and allow customers to place orders again.`
                : `Suspending will immediately revoke their dashboard access and block customer orders.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)}>Cancel</Button>
            <Button
              variant={selected?.subscription_status === "suspended" ? "default" : "destructive"}
              onClick={toggleStatus}
            >
              {selected?.subscription_status === "suspended" ? "Yes, Reactivate" : "Yes, Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
