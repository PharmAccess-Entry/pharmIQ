import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { useAuth } from "@/lib/auth";
import { formatNaira, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

export default function Reconciliation() {
  const { restaurant, role } = useRestaurant();
  const { user } = useAuth();
  const rid = restaurant?.id;

  const [loading, setLoading] = useState(true);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  
  // Data for active session
  const [batches, setBatches] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rid) return;
    fetchReconciliations();
  }, [rid]);

  const fetchReconciliations = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("stock_reconciliations")
        .select("*, stock_reconciliation_items(*), user_roles!stock_reconciliations_created_by_fkey(role)")
        .eq("restaurant_id", rid)
        .order("created_at", { ascending: false });
      
      if (data) setReconciliations(data);
    } catch (e: any) {
      toast.error("Failed to load reconciliations");
    } finally {
      setLoading(false);
    }
  };

  const startNewCount = async () => {
    setLoading(true);
    try {
      const { data: batchData } = await supabase
        .from("product_batches")
        .select("id, batch_number, stock_quantity, cost_price, menu_item_id, menu_items(name, price)")
        .gt("stock_quantity", 0)
        .order("expiry_date", { ascending: true });

      setBatches(batchData || []);
      const initialCounts: Record<string, number> = {};
      batchData?.forEach(b => {
        initialCounts[b.id] = b.stock_quantity; // Default to expected
      });
      setCounts(initialCounts);
      setActiveSession({ isNew: true });
    } catch (e) {
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  };

  const handleCountChange = (batchId: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setCounts(prev => ({ ...prev, [batchId]: num }));
  };

  const submitReconciliation = async () => {
    if (!rid || !user?.id) return;
    setSaving(true);
    try {
      // Get role
      const { data: roleRow } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("restaurant_id", rid).single();

      // Create Reconciliation Session
      const { data: session, error: sessErr } = await supabase
        .from("stock_reconciliations")
        .insert({
          restaurant_id: rid,
          status: "approved",
          created_by: roleRow?.id,
          approved_by: roleRow?.id,
        })
        .select("id")
        .single();
      
      if (sessErr) throw sessErr;

      const itemsToInsert = [];
      const batchUpdates = [];
      const menuIdToVariance: Record<string, number> = {};

      for (const batch of batches) {
        const expected = batch.stock_quantity;
        const actual = counts[batch.id];
        const variance = actual - expected;

        if (variance !== 0) {
          const costLoss = (variance < 0 ? Math.abs(variance) : 0) * (batch.cost_price || 0);
          const revenueLoss = (variance < 0 ? Math.abs(variance) : 0) * (batch.menu_items?.price || 0);

          itemsToInsert.push({
            reconciliation_id: session.id,
            batch_id: batch.id,
            expected_qty: expected,
            actual_qty: actual,
            variance: variance,
            cost_loss: costLoss,
            revenue_loss: revenueLoss
          });

          batchUpdates.push({
            id: batch.id,
            stock_quantity: actual
          });

          const menuId = batch.menu_item_id;
          menuIdToVariance[menuId] = (menuIdToVariance[menuId] || 0) + variance;
        }
      }

      if (itemsToInsert.length > 0) {
        // Insert item logs
        await supabase.from("stock_reconciliation_items").insert(itemsToInsert);
        
        // Update batches
        for (const update of batchUpdates) {
          await supabase.from("product_batches").update({ stock_quantity: update.stock_quantity }).eq("id", update.id);
        }

        // Apply variances to menu_items atomically and write to inventory_logs
        for (const [menuId, variance] of Object.entries(menuIdToVariance)) {
          await supabase.rpc("update_stock_with_reason", {
            p_restaurant_id: rid,
            p_menu_item_id: menuId,
            p_change_qty: variance,
            p_reason: "count_correction",
            p_movement_type: "reconciliation",
            p_note: "Stock reconciliation audit",
            p_reference_id: session.id,
            p_reference_type: "reconciliation",
          });
        }
      }

      toast.success("Stock reconciliation completed");
      setActiveSession(null);
      fetchReconciliations();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit reconciliation");
    } finally {
      setSaving(false);
    }
  };

  if (role === "staff") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive grid place-items-center">
            <ListChecks className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl">Access Denied</h2>
            <p className="text-muted-foreground text-sm">You do not have permission to perform stock audits.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Stock Reconciliation — PharmIQ</title>
      </Helmet>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl lg:text-3xl flex items-center gap-2">
              <ListChecks className="h-7 w-7 text-primary" /> Stock Reconciliation
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Audit physical stock levels and track variance losses.</p>
          </div>
          {!activeSession && (
            <Button onClick={startNewCount} className="gap-2 font-bold whitespace-nowrap">
              Start Physical Count
            </Button>
          )}
        </div>

        {activeSession ? (
          <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">Active Count Session</h3>
                <p className="text-xs text-muted-foreground">Adjust the actual quantities below.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setActiveSession(null)}>Cancel</Button>
                <Button onClick={submitReconciliation} disabled={saving}>{saving ? "Saving..." : "Submit Variance"}</Button>
              </div>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Batch</th>
                    <th className="px-5 py-3">Expected Qty</th>
                    <th className="px-5 py-3">Actual Qty</th>
                    <th className="px-5 py-3">Variance</th>
                    <th className="px-5 py-3">Loss Estimate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map(b => {
                    const expected = b.stock_quantity;
                    const actual = counts[b.id];
                    const variance = actual - expected;
                    const isLoss = variance < 0;
                    const lossAmount = isLoss ? Math.abs(variance) * (b.cost_price || 0) : 0;
                    
                    return (
                      <tr key={b.id}>
                        <td className="px-5 py-3 font-semibold">{b.menu_items?.name}</td>
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{b.batch_number}</td>
                        <td className="px-5 py-3">{expected}</td>
                        <td className="px-5 py-3">
                          <Input 
                            type="number" 
                            className="w-24 text-center" 
                            value={actual} 
                            onChange={e => handleCountChange(b.id, e.target.value)} 
                          />
                        </td>
                        <td className="px-5 py-3">
                          {variance === 0 ? (
                            <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> 0</span>
                          ) : variance < 0 ? (
                            <span className="text-destructive font-bold">{variance}</span>
                          ) : (
                            <span className="text-emerald-500 font-bold">+{variance}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {isLoss ? (
                            <span className="text-destructive flex items-center gap-1"><TrendingDown className="h-4 w-4" /> {formatNaira(lossAmount)}</span>
                          ) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="text-muted-foreground p-4">Loading history...</p>
            ) : reconciliations.length === 0 ? (
              <div className="col-span-full p-12 text-center text-muted-foreground bg-card border border-border rounded-xl">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No past reconciliations found.</p>
              </div>
            ) : (
              reconciliations.map(rec => {
                const totalItems = rec.stock_reconciliation_items?.length || 0;
                const totalCostLoss = rec.stock_reconciliation_items?.reduce((sum: number, item: any) => sum + (item.cost_loss || 0), 0) || 0;

                return (
                  <div key={rec.id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-muted-foreground">{formatDate(rec.created_at)}</p>
                        <h4 className="font-semibold mt-1 flex items-center gap-1">
                          Audit Session
                        </h4>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-md text-xs font-bold uppercase">
                        {rec.status}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="flex justify-between"><span>Items Affected:</span> <span className="font-bold">{totalItems}</span></p>
                      <p className="flex justify-between"><span>Total Cost Loss:</span> <span className="text-destructive font-bold">{formatNaira(totalCostLoss)}</span></p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
