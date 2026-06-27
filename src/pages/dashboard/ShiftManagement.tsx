import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Clock, CheckCircle2, TrendingDown, BadgeCheck, ShoppingCart,
  RotateCcw, AlertTriangle, Banknote, CreditCard, ArrowRight, Users
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { CardGridSkeleton, ListRowSkeleton } from "@/components/LoadingState";

export default function ShiftManagement() {
  const { restaurant, role } = useRestaurant();
  const { user } = useAuth();
  const rid = restaurant?.id;
  const isAdmin = role === "owner" || role === "manager";

  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftStats, setShiftStats] = useState<Record<string, { sales: number; cashSales: number; posSales: number; transferSales: number; cashRefunds: number; orderCount: number }>>({});
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});

  // Settlement dialog state
  const [settlingShift, setSettlingShift] = useState<any | null>(null);
  const [selectedShiftDetails, setSelectedShiftDetails] = useState<any | null>(null);
  const [settleLoading, setSettleLoading] = useState(false);

  const [forceClosingShift, setForceClosingShift] = useState<any | null>(null);
  const [actualCash, setActualCash] = useState<string>("");
  const [actualPos, setActualPos] = useState<string>("");
  const [actualTransfers, setActualTransfers] = useState<string>("");
  const [forceCloseNotes, setForceCloseNotes] = useState<string>("");
  const [forceCloseLoading, setForceCloseLoading] = useState(false);
  const isOffline = useOfflineStatus();

  const fetchShifts = useCallback(async () => {
    if (!rid) return;
    setLoading(true);
    try {
      if (navigator.onLine) {
        const { data } = await supabase
          .from("shifts")
          .select("*")
          .eq("restaurant_id", rid)
          .order("start_time", { ascending: false })
          .limit(50);

        if (data) {
          setShifts(data);

          // Snapshot into Dexie for offline use
          const { db } = await import("@/lib/offline/db");
          await db.shifts.where("restaurant_id").equals(rid).delete();
          if (data.length > 0) await db.shifts.bulkPut(data as any[]);

          // Fetch order stats per shift
          const stats: Record<string, any> = {};
          await Promise.all(
            data.map(async (shift) => {
              const { data: orders } = await supabase
                .from("orders")
                .select("total, payment_status, status")
                .eq("shift_id", shift.id);

              if (orders) {
                const paid = orders.filter(o => o.status !== "refunded" && o.status !== "cancelled" && o.payment_status !== "unpaid");
                const refunded = orders.filter(o => o.status === "refunded" && o.payment_status === "cash_paid");
                stats[shift.id] = {
                  sales: paid.reduce((s, o) => s + (Number(o.total) || 0), 0),
                  cashSales: paid.filter(o => o.payment_status === "cash_paid").reduce((s, o) => s + (Number(o.total) || 0), 0),
                  posSales: paid.filter(o => ["pos_paid", "cash_pos"].includes(o.payment_status)).reduce((s, o) => s + (Number(o.total) || 0), 0),
                  transferSales: paid.filter(o => o.payment_status === "confirmed").reduce((s, o) => s + (Number(o.total) || 0), 0),
                  cashRefunds: refunded.reduce((s, o) => s + (Number(o.total) || 0), 0),
                  orderCount: orders.length,
                };
              }
            })
          );
          setShiftStats(stats);

          // Fetch staff profiles
          const userIds = [...new Set(data.map((s) => s.user_id))];
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.rpc("get_users_by_ids", { user_ids: userIds });
            if (profiles) {
              const nameMap: Record<string, string> = {};
              profiles.forEach((p: any) => {
                nameMap[p.id] = p.full_name || p.email || "Unknown";
              });
              setStaffNames(nameMap);
            }
          }
        }
      } else {
        // Offline: load from Dexie
        const { db } = await import("@/lib/offline/db");
        const rows = await db.shifts.where("restaurant_id").equals(rid).reverse().sortBy("start_time");
        setShifts(rows as any[]);

        // Compute shift stats from local sales (same structure as online)
        const allLocalSales = await db.sales.where("restaurant_id").equals(rid).toArray();
        const offlineStats: Record<string, any> = {};
        for (const shift of rows) {
          const shiftSales = allLocalSales.filter(s => s.shift_id === shift.id);
          const paid = shiftSales.filter(s => s.status !== "refunded" && s.status !== "cancelled" && s.payment_status !== "unpaid");
          const refunded = shiftSales.filter(s => s.status === "refunded" && s.payment_status === "cash_paid");
          offlineStats[shift.id] = {
            sales: paid.reduce((s, o) => s + (Number(o.total) || 0), 0),
            cashSales: paid.filter(o => o.payment_status === "cash_paid").reduce((s, o) => s + (Number(o.total) || 0), 0),
            posSales: paid.filter(o => ["pos_paid","cash_pos"].includes(o.payment_status)).reduce((s, o) => s + (Number(o.total) || 0), 0),
            transferSales: paid.filter(o => o.payment_status === "confirmed").reduce((s, o) => s + (Number(o.total) || 0), 0),
            cashRefunds: refunded.reduce((s, o) => s + (Number(o.total) || 0), 0),
            orderCount: shiftSales.length,
          };
        }
        setShiftStats(offlineStats);
      }
    } catch (e) {
      console.error("Failed to load shifts", e);
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    fetchShifts();
    const handler = () => fetchShifts();
    window.addEventListener("pharmiq_sync_complete", handler);
    return () => window.removeEventListener("pharmiq_sync_complete", handler);
  }, [fetchShifts]);

  const handleSettle = async () => {
    if (!settlingShift) return;
    setSettleLoading(true);
    try {
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "settled",
          settled_at: new Date().toISOString(),
          settled_by: user?.id,
        })
        .eq("id", settlingShift.id);
      if (error) throw error;
      toast.success(`Shift settled — cash received from ${staffNames[settlingShift.user_id] || "Staff"}.`);
      setSettlingShift(null);
      fetchShifts();
    } catch (e: any) {
      toast.error("Failed to settle shift: " + e.message);
    } finally {
      setSettleLoading(false);
    }
  };

  const openForceClose = (shift: any) => {
    const stats = shiftStats[shift.id];
    const expectedCash = (Number(shift.start_cash) || 0) + (stats?.cashSales || 0) - (stats?.cashRefunds || 0);
    const expectedPos = (Number(shift.start_pos) || 0) + (stats?.posSales || 0);
    const expectedTransfers = (Number(shift.start_transfers) || 0) + (stats?.transferSales || 0);
    
    setForceClosingShift({ ...shift, expectedCash, expectedPos, expectedTransfers });
    setActualCash(expectedCash.toString());
    setActualPos(expectedPos.toString());
    setActualTransfers(expectedTransfers.toString());
    setForceCloseNotes("Force closed by admin");
  };

  const handleForceClose = async () => {
    if (!forceClosingShift) return;
    setForceCloseLoading(true);
    try {
      const { error } = await supabase
        .from("shifts")
        .update({
          status: "completed",
          end_time: new Date().toISOString(),
          expected_cash: forceClosingShift.expectedCash,
          expected_pos: forceClosingShift.expectedPos,
          expected_transfers: forceClosingShift.expectedTransfers,
          actual_cash: Number(actualCash) || 0,
          actual_pos: Number(actualPos) || 0,
          actual_transfers: Number(actualTransfers) || 0,
          notes: forceCloseNotes,
        })
        .eq("id", forceClosingShift.id);
      
      if (error) throw error;
      toast.success("Shift force closed successfully.");
      setForceClosingShift(null);
      fetchShifts();
    } catch (e: any) {
      toast.error("Failed to force close shift: " + e.message);
    } finally {
      setForceCloseLoading(false);
    }
  };

  const activeShifts = shifts.filter(s => s.status === "active");
  const completedShifts = shifts.filter(s => s.status === "completed");
  const settledShifts = shifts.filter(s => s.status === "settled");

  const getVariantForVariance = (variance: number) => {
    if (variance === 0) return "text-emerald-500";
    if (variance < 0) return "text-destructive";
    return "text-amber-500";
  };

  const formatVariance = (variance: number) => {
    if (variance === 0) return <span className="flex items-center gap-1 text-emerald-500 font-bold"><CheckCircle2 className="h-4 w-4" /> Balanced</span>;
    if (variance < 0) return <span className="flex items-center gap-1 text-destructive font-bold"><TrendingDown className="h-4 w-4" /> {formatNaira(Math.abs(variance))} Short</span>;
    return <span className="text-amber-500 font-bold">+{formatNaira(variance)} Over</span>;
  };

  return (
    <DashboardLayout>
      <Helmet>
        <title>Shift Management — PharmIQ</title>
      </Helmet>

      <div className="max-w-6xl mx-auto space-y-8">
        {isOffline && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You're offline — showing cached shifts. New shifts will be synced when you reconnect.</span>
          </div>
        )}
        {/* Header */}
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl flex items-center gap-2">
            <Clock className="h-7 w-7 text-primary" /> Shift Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            All totals are derived from <code className="bg-secondary px-1 rounded text-xs">shift_id</code> linkage — fully isolated per cashier, no time-window assumptions.
          </p>
        </div>

        {/* Active Shifts */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Active Shifts ({activeShifts.length})
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <CardGridSkeleton count={3} />
            </div>
          ) : activeShifts.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
              No active shifts right now. Cashiers can open a shift from the POS screen.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeShifts.map((shift) => {
                const stats = shiftStats[shift.id];
                const staffName = staffNames[shift.user_id] || "Loading...";
                
                // Abandoned Shift Protection
                const hoursRunning = (new Date().getTime() - new Date(shift.start_time).getTime()) / (1000 * 60 * 60);
                const isLongRunning = hoursRunning > 16;

                return (
                  <div key={shift.id} className={`bg-card border ${isLongRunning ? 'border-destructive/50 bg-destructive/5' : 'border-primary/20 bg-primary/5'} rounded-2xl p-5 space-y-3`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-base flex items-center gap-2">
                          <span className="truncate" title={staffName}>{staffName}</span>
                          {isLongRunning && (
                            <Badge variant="destructive" className="text-[10px] uppercase h-5 shrink-0">Long Running</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Since {format(new Date(shift.start_time), "MMM d, h:mm a")} ({Math.floor(hoursRunning)}h)
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${isLongRunning ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-500/20 text-green-600 border-green-500/20'} gap-1`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isLongRunning ? 'bg-destructive' : 'bg-green-500 animate-pulse'}`} /> {isLongRunning ? 'Warning' : 'Active'}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5" /> Opening Float</span>
                        <span className="font-medium text-foreground">{formatNaira(shift.start_cash)}</span>
                      </div>
                      {stats && (
                        <>
                          <div className="flex justify-between text-muted-foreground">
                            <span className="flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" /> Sales ({stats.orderCount})</span>
                            <span className="font-medium text-emerald-600">{formatNaira(stats.sales)}</span>
                          </div>
                          {stats.cashRefunds > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span className="flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Cash Refunds</span>
                              <span className="font-medium text-destructive">-{formatNaira(stats.cashRefunds)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {isAdmin && (
                        <div className="pt-2 mt-2 border-t border-border/50">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-amber-600 border-amber-600/30 hover:bg-amber-600/10"
                            onClick={() => openForceClose(shift)}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Force Close Shift
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Shifts — Awaiting Admin Settlement */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Awaiting Settlement ({completedShifts.length})
          </h2>
          {loading ? (
            <ListRowSkeleton count={3} />
          ) : completedShifts.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              No shifts waiting for admin settlement.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Cashier</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3 text-right">Float</th>
                      <th className="px-5 py-3 text-right">Expected Cash</th>
                      <th className="px-5 py-3 text-right">Actual Cash</th>
                      <th className="px-5 py-3 text-right">Variance</th>
                      {isAdmin && <th className="px-5 py-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {completedShifts.map(shift => {
                      const variance = (Number(shift.actual_cash) || 0) - (Number(shift.expected_cash) || 0);
                      const stats = shiftStats[shift.id];
                      return (
                        <tr key={shift.id} className="hover:bg-muted/40 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-semibold">{staffNames[shift.user_id] || "—"}</p>
                            <p className="text-xs text-muted-foreground">{stats ? `${stats.orderCount} orders` : "—"}</p>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            <div>{format(new Date(shift.start_time), "MMM d, h:mm a")}</div>
                            {shift.end_time && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <ArrowRight className="h-3 w-3" />
                                {format(new Date(shift.end_time), "h:mm a")}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-muted-foreground">{formatNaira(shift.start_cash)}</td>
                          <td className="px-5 py-3 text-right font-mono">
                            <div>{formatNaira(shift.expected_cash)}</div>
                            {shift.expected_pos > 0 && <div className="text-xs text-muted-foreground">POS: {formatNaira(shift.expected_pos)}</div>}
                            {shift.expected_transfers > 0 && <div className="text-xs text-muted-foreground">Tfr: {formatNaira(shift.expected_transfers)}</div>}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-medium">
                            <div>{formatNaira(shift.actual_cash)}</div>
                            {shift.actual_pos > 0 && <div className="text-xs text-muted-foreground">POS: {formatNaira(shift.actual_pos)}</div>}
                            {shift.actual_transfers > 0 && <div className="text-xs text-muted-foreground">Tfr: {formatNaira(shift.actual_transfers)}</div>}
                          </td>
                          <td className="px-5 py-3 text-right">{formatVariance(variance)}</td>
                          {isAdmin && (
                            <td className="px-5 py-3 text-center">
                              <Button
                                size="sm"
                                className="gap-1.5 font-semibold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20 dark:text-amber-400"
                                variant="outline"
                                onClick={() => setSettlingShift(shift)}
                              >
                                <BadgeCheck className="h-4 w-4" /> Settle
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Settled Shift History */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Settled History ({settledShifts.length})
          </h2>
          {loading ? (
            <ListRowSkeleton count={5} />
          ) : settledShifts.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              No settled shifts yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                  <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Cashier</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3 text-right">Float</th>
                      <th className="px-5 py-3 text-right">Expected Cash</th>
                      <th className="px-5 py-3 text-right">Actual Cash</th>
                      <th className="px-5 py-3 text-right">Variance</th>
                      <th className="px-5 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {settledShifts.map(shift => {
                      const variance = (Number(shift.actual_cash) || 0) - (Number(shift.expected_cash) || 0);
                      const expectedCash = Number(shift.expected_cash) || 0;
                      const actualCash = Number(shift.actual_cash) || 0;
                      const expectedPos = Number(shift.expected_pos) || 0;
                      const actualPos = Number(shift.actual_pos) || 0;
                      const expectedTransfers = Number(shift.expected_transfers) || 0;
                      const actualTransfers = Number(shift.actual_transfers) || 0;
                      const totalVariance = variance + (actualPos - expectedPos) + (actualTransfers - expectedTransfers);
                      
                      return (
                        <tr 
                          key={shift.id} 
                          className="hover:bg-muted/30 transition-colors opacity-80 cursor-pointer"
                          onClick={() => setSelectedShiftDetails({ 
                            ...shift, 
                            staffName: staffNames[shift.user_id] || "—",
                            expectedCash, actualCash, expectedPos, actualPos, expectedTransfers, actualTransfers,
                            totalVariance, isShort: totalVariance < 0, isOver: totalVariance > 0
                          })}
                        >
                          <td className="px-5 py-3 font-medium">{staffNames[shift.user_id] || "—"}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(shift.start_time), "MMM d, h:mm a")}
                            {shift.end_time && <> → {format(new Date(shift.end_time), "h:mm a")}</>}
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-muted-foreground">{formatNaira(shift.start_cash)}</td>
                          <td className="px-5 py-3 text-right font-mono">{formatNaira(shift.expected_cash)}</td>
                          <td className="px-5 py-3 text-right font-mono font-medium">{formatNaira(shift.actual_cash)}</td>
                          <td className={`px-5 py-3 text-right font-bold ${getVariantForVariance(variance)}`}>
                            {variance > 0 ? "+" : ""}{formatNaira(variance)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                              <BadgeCheck className="h-3 w-3" /> Settled
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settle Shift Dialog */}
      <Dialog open={!!settlingShift} onOpenChange={(open) => !open && setSettlingShift(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <BadgeCheck className="h-5 w-5" /> Settle Shift
            </DialogTitle>
            <DialogDescription>
              Confirm you have physically received the cash from {staffNames[settlingShift?.user_id] || "this cashier"} and verified the POS slips.
            </DialogDescription>
          </DialogHeader>
          {settlingShift && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cashier:</span>
                  <span className="font-bold">{staffNames[settlingShift.user_id] || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shift Period:</span>
                  <span className="font-medium text-right text-xs">
                    {format(new Date(settlingShift.start_time), "MMM d, h:mm a")}
                    {settlingShift.end_time && <> → {format(new Date(settlingShift.end_time), "h:mm a")}</>}
                  </span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3.5 w-3.5" /> Cash to Receive:</span>
                  <span className="font-bold text-lg">{formatNaira(Number(settlingShift.actual_cash) || 0)}</span>
                </div>
                {(settlingShift.actual_pos || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> POS (auto-settled):</span>
                    <span className="font-medium">{formatNaira(Number(settlingShift.actual_pos) || 0)}</span>
                  </div>
                )}
                {(settlingShift.actual_transfers || 0) > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Bank Transfers:</span>
                    <span className="font-medium">{formatNaira(Number(settlingShift.actual_transfers) || 0)}</span>
                  </div>
                )}
                {settlingShift.notes && (
                  <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs rounded-lg p-2 mt-2">
                    📝 {settlingShift.notes}
                  </div>
                )}
              </div>
              {/* Variance warning */}
              {(() => {
                const variance = (Number(settlingShift.actual_cash) || 0) - (Number(settlingShift.expected_cash) || 0);
                if (variance !== 0) return (
                  <div className={`text-xs rounded-lg p-3 flex items-start gap-2 ${variance < 0 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>{variance < 0 ? "Cash shortage" : "Cash overage"}:</strong> {formatNaira(Math.abs(variance))}.
                      {variance < 0 ? " Investigate before settling." : " Confirm this is correct."}
                    </span>
                  </div>
                );
                return null;
              })()}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSettlingShift(null)}>Cancel</Button>
            <Button onClick={handleSettle} disabled={settleLoading} className="font-bold gap-1.5">
              {settleLoading ? "Settling..." : <><BadgeCheck className="h-4 w-4" /> Confirm & Settle</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-only Shift Details Dialog */}
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
      {/* Force Close Shift Dialog */}
      <Dialog open={!!forceClosingShift} onOpenChange={(open) => !open && setForceClosingShift(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Force Close Shift
            </DialogTitle>
            <DialogDescription>
              Close this shift on behalf of {staffNames[forceClosingShift?.user_id] || "the cashier"}. Please verify the cash drawer and POS slips before submitting.
            </DialogDescription>
          </DialogHeader>
          {forceClosingShift && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Cash:</span>
                  <span className="font-bold">{formatNaira(forceClosingShift.expectedCash)}</span>
                </div>
                {forceClosingShift.expectedPos > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected POS:</span>
                    <span className="font-bold">{formatNaira(forceClosingShift.expectedPos)}</span>
                  </div>
                )}
                {forceClosingShift.expectedTransfers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Transfers:</span>
                    <span className="font-bold">{formatNaira(forceClosingShift.expectedTransfers)}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Actual Cash Counted (₦)</Label>
                  <Input type="number" value={actualCash} onChange={(e) => setActualCash(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Actual POS (₦)</Label>
                    <Input type="number" value={actualPos} onChange={(e) => setActualPos(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Actual Transfers (₦)</Label>
                    <Input type="number" value={actualTransfers} onChange={(e) => setActualTransfers(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Input value={forceCloseNotes} onChange={(e) => setForceCloseNotes(e.target.value)} placeholder="Reason for force closing..." />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setForceClosingShift(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleForceClose} disabled={forceCloseLoading} className="font-bold gap-1.5">
              {forceCloseLoading ? "Closing..." : "Force Close Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
