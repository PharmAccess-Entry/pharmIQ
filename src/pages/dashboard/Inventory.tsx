import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Package, Search, Plus, AlertCircle, ArrowUp, ArrowDown, ArrowRight, Download, History, Filter, PackagePlus, ChevronDown, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { Badge } from "@/components/ui/badge";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { useTelegramAlerts } from "@/lib/useTelegramAlerts";
import { WifiOff } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
  available: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  auto_hide_out_of_stock: boolean;
  expiry_date?: string | null;
};

const Inventory = () => {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const isEvent = restaurant?.business_type === "event";
  const eventPaid = isEvent ? restaurant?.active_event?.payment_status === "paid" : true;
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const isOffline = useOfflineStatus();
  const { sendAlert } = useTelegramAlerts();

  // Restock modal state
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [newThreshold, setNewThreshold] = useState("");
  const [isRestocking, setIsRestocking] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState("manual_correction");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  // Filter + log state (ported from PharmIQ)
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  // Stock Receiving (GRN) state
  const [grnOpen, setGrnOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<{id: string; name: string}[]>([]);
  const [grnSupplierId, setGrnSupplierId] = useState("");
  const [grnReference, setGrnReference] = useState("");
  const [grnNotes, setGrnNotes] = useState("");
  type GrnLine = { menu_item_id: string; name: string; quantity: string; cost_price_per_unit: string; batch_number: string; expiry_date: string; };
  const [grnLines, setGrnLines] = useState<GrnLine[]>([{ menu_item_id: "", name: "", quantity: "1", cost_price_per_unit: "", batch_number: "", expiry_date: "" }]);
  const [isSavingGrn, setIsSavingGrn] = useState(false);

  const loadItems = async () => {
    if (!rid) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, category, price, image, available, track_inventory, stock_quantity, low_stock_threshold, auto_hide_out_of_stock, expiry_date")
        .eq("restaurant_id", rid)
        .order("category")
        .order("name");
      if (error) {
        toast.error("Failed to load inventory");
      } else {
        const rows = (data as MenuItem[]) || [];
        setItems(rows);
        // Snapshot into Dexie (shared with POS)
        const { db } = await import("@/lib/offline/db");
        await db.products.bulkPut(rows.map(r => ({ ...r, restaurant_id: rid, last_synced_at: Date.now(), description: null, barcode: null })) as any[]);
      }
    } else {
      // Offline: read from Dexie products table (shared with POS)
      const { db } = await import("@/lib/offline/db");
      const rows = await db.products.where("restaurant_id").equals(rid).sortBy("name");
      setItems(rows as unknown as MenuItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (rid) {
      loadItems();
      // Load suppliers for GRN dropdown
      if (navigator.onLine) {
        supabase.from("suppliers").select("id, name").eq("restaurant_id", rid).eq("status", "active").order("name")
          .then(({ data }) => setSuppliers(data || []));
      } else {
        import("@/lib/offline/db").then(({ db }) =>
          db.suppliers.where("restaurant_id").equals(rid).filter(s => s.status === "active").sortBy("name").then(rows => setSuppliers(rows as any[]))
        );
      }
    }
    const handler = () => loadItems();
    window.addEventListener("pharmiq_sync_complete", handler);
    return () => window.removeEventListener("pharmiq_sync_complete", handler);
  }, [rid]);

  const toggleTracking = async (item: MenuItem, checked: boolean) => {
    const { error } = await supabase
      .from("menu_items")
      .update({ track_inventory: checked })
      .eq("id", item.id);

    if (error) {
      toast.error("Failed to update tracking");
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, track_inventory: checked } : i));
      toast.success(checked ? "Inventory tracking enabled" : "Inventory tracking disabled");
    }
  };

  const handleRestock = async () => {
    if (!selectedItem || !rid) return;
    const qty = parseInt(adjustQty);
    const actualQty = isNaN(qty) ? 0 : qty;

    const parsedThreshold = parseInt(newThreshold);
    const finalThreshold = isNaN(parsedThreshold) || parsedThreshold < 0 ? selectedItem.low_stock_threshold : parsedThreshold;

    // Allow threshold-only saves (no stock change required)
    const thresholdChanged = finalThreshold !== selectedItem.low_stock_threshold;
    if (actualQty === 0 && !thresholdChanged) {
      toast.info("No changes to save.");
      return;
    }

    setIsRestocking(true);

    // Only call the stock RPC if there is actually a quantity change
    if (actualQty !== 0) {
      const { error: rpcError } = await supabase.rpc("update_stock_with_reason", {
        p_restaurant_id: rid,
        p_menu_item_id: selectedItem.id,
        p_change_qty: actualQty,
        p_reason: adjustmentReason,
        p_movement_type: "adjustment",
        p_note: adjustmentNote || null,
        p_reference_id: null,
        p_reference_type: null,
      });

      if (rpcError) {
        toast.error("Failed to update stock: " + rpcError.message);
        setIsRestocking(false);
        return;
      }
    }

    // Update the threshold separately if changed
    if (thresholdChanged) {
      const { error: tErr } = await supabase.from("menu_items")
        .update({ low_stock_threshold: finalThreshold })
        .eq("id", selectedItem.id);
      if (tErr) {
        toast.error("Failed to update threshold: " + tErr.message);
        setIsRestocking(false);
        return;
      }
    }

    const newStock = actualQty !== 0 ? Math.max(0, selectedItem.stock_quantity + actualQty) : selectedItem.stock_quantity;
    toast.success(actualQty !== 0 ? "Stock updated successfully" : "Alert threshold updated");
    setItems(prev => prev.map(i => i.id === selectedItem.id ? {
      ...i,
      stock_quantity: newStock,
      low_stock_threshold: finalThreshold,
    } : i));

    if (actualQty !== 0) {
      sendAlert(
        "📦 Stock Adjusted",
        `Product: ${selectedItem.name}\nQuantity Changed: ${actualQty > 0 ? "+" + actualQty : actualQty}\nNew Total: ${newStock}\nReason: ${adjustmentReason}`,
        "major_events"
      );
    }

    setRestockModalOpen(false);
    setSelectedItem(null);
    setAdjustQty("");
    setAdjustmentReason("manual_correction");
    setIsRestocking(false);
  };

  const handleReceiveStock = async () => {
    if (!rid) return;
    const validLines = grnLines.filter(l => l.menu_item_id && parseInt(l.quantity) > 0);
    if (validLines.length === 0) { toast.error("Add at least one product with a valid quantity"); return; }

    setIsSavingGrn(true);
    const totalCost = validLines.reduce((sum, l) => sum + (parseFloat(l.cost_price_per_unit || "0") * parseInt(l.quantity || "0")), 0);

    // 1. Create purchase order
    const { data: po, error: poError } = await supabase.from("purchase_orders").insert({
      restaurant_id: rid,
      supplier_id: grnSupplierId || null,
      reference_number: grnReference.trim() || null,
      notes: grnNotes.trim() || null,
      total_cost: totalCost,
      status: "received"
    }).select("id").single();

    if (poError || !po) {
      toast.error("Failed to create purchase order: " + poError?.message);
      setIsSavingGrn(false);
      return;
    }

    // 2. Insert line items
    const linePayload = validLines.map(l => ({
      purchase_order_id: po.id,
      menu_item_id: l.menu_item_id,
      quantity: parseInt(l.quantity),
      cost_price_per_unit: parseFloat(l.cost_price_per_unit || "0"),
      batch_number: l.batch_number.trim() || null,
      expiry_date: l.expiry_date || null,
    }));
    await supabase.from("purchase_order_items").insert(linePayload);

    // 3. Update stock quantities & cost prices for each product atomically
    for (const line of validLines) {
      const item = items.find(i => i.id === line.menu_item_id);
      if (!item) continue;

      // Update non-stock fields (cost, batch, expiry) separately first
      const metaPayload: any = {};
      if (line.cost_price_per_unit) metaPayload.cost_price = parseFloat(line.cost_price_per_unit);
      if (line.batch_number.trim()) metaPayload.batch_number = line.batch_number.trim();
      if (line.expiry_date) metaPayload.expiry_date = line.expiry_date;
      if (!item.track_inventory) metaPayload.track_inventory = true;
      if (Object.keys(metaPayload).length > 0) {
        await supabase.from("menu_items").update(metaPayload).eq("id", line.menu_item_id);
      }

      // 4. Atomic stock update + inventory log via RPC
      await supabase.rpc("update_stock_with_reason", {
        p_restaurant_id: rid,
        p_menu_item_id: line.menu_item_id,
        p_change_qty: parseInt(line.quantity),
        p_reason: "purchase_order",
        p_movement_type: "purchase",
        p_note: grnReference.trim() || null,
        p_reference_id: po.id,
        p_reference_type: "purchase_order",
      });
    }

    toast.success(`Stock received! ${validLines.length} product(s) updated.`);
    setGrnOpen(false);
    setGrnSupplierId(""); setGrnReference(""); setGrnNotes("");
    setGrnLines([{ menu_item_id: "", name: "", quantity: "1", cost_price_per_unit: "", batch_number: "", expiry_date: "" }]);
    loadItems();
    setIsSavingGrn(false);
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (search) {
      result = result.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.category.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (categoryFilter !== "all") {
      result = result.filter(i => i.category === categoryFilter);
    }
    if (stockFilter !== "all") {
      result = result.filter(i => {
        const isTracked = i.track_inventory;
        if (stockFilter === "in_stock") return isTracked && i.stock_quantity > 0;
        if (stockFilter === "low_stock") return isTracked && i.stock_quantity > 0 && i.stock_quantity <= i.low_stock_threshold;
        if (stockFilter === "out_of_stock") return isTracked && i.stock_quantity <= 0;
        if (stockFilter === "untracked") return !isTracked;
        return true;
      });
    }

    return [...result].sort((a, b) => {
      const aRank = a.track_inventory ? (a.stock_quantity > 0 ? 1 : 2) : 3;
      const bRank = b.track_inventory ? (b.stock_quantity > 0 ? 1 : 2) : 3;

      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    });
  }, [items, search, categoryFilter, stockFilter]);

  // CSV export (ported from PharmIQ, with extra expiry_date column for PharmIQ)
  const exportCsv = () => {
    if (filteredItems.length === 0) {
      toast.info("No items to export.");
      return;
    }

    const stockLabel = stockFilter !== "all" ? `_${stockFilter}` : "";
    const catLabel = categoryFilter !== "all" ? `_${categoryFilter.toLowerCase().replace(/\s+/g, "-")}` : "";
    const filename = `inventory${stockLabel}${catLabel}_${new Date().toISOString().split('T')[0]}.csv`;

    const headers = ["Name", "Category", "Price (₦)", "Tracked", "Stock Qty", "Low Stock Threshold", "Status", "Expiry Date"];
    const rows = filteredItems.map(i => {
      const isTracked = i.track_inventory;
      const isOut = isTracked && i.stock_quantity <= 0;
      const isLow = isTracked && !isOut && i.stock_quantity <= i.low_stock_threshold;
      const status = !isTracked ? "Untracked" : isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock";

      return [
        `"${i.name.replace(/"/g, '""')}"`,
        `"${i.category.replace(/"/g, '""')}"`,
        i.price,
        isTracked ? "Yes" : "No",
        isTracked ? i.stock_quantity : "N/A",
        isTracked ? i.low_stock_threshold : "N/A",
        `"${status}"`,
        i.expiry_date ? new Date(i.expiry_date).toLocaleDateString() : "N/A"
      ].join(",");
    });

    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""} to CSV!`);
  };

  const loadLogs = async () => {
    if (!rid) return;
    setIsLogsLoading(true);
    const { data, error } = await supabase
      .from("inventory_logs")
      .select(`
        id, change_qty, reason, created_at,
        menu_items (name)
      `)
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Failed to load activity log");
    } else {
      setLogs(data || []);
    }
    setIsLogsLoading(false);
  };

  const isFiltered = stockFilter !== "all" || categoryFilter !== "all" || search.trim() !== "";

  // Metric counts react to active filters (ported from PharmIQ)
  const trackedCount = filteredItems.filter(i => i.track_inventory).length;
  const outOfStockCount = filteredItems.filter(i => i.track_inventory && i.stock_quantity <= 0).length;
  const lowStockCount = filteredItems.filter(i => i.track_inventory && i.stock_quantity > 0 && i.stock_quantity <= i.low_stock_threshold).length;

  // Expiry tracking (PharmIQ-specific — always computed from ALL items, not filtered)
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringCount = items.filter(i => {
    if (!i.expiry_date) return false;
    const exp = new Date(i.expiry_date);
    return exp > now && exp <= thirtyDaysFromNow;
  }).length;
  const expiredCount = items.filter(i => {
    if (!i.expiry_date) return false;
    const exp = new Date(i.expiry_date);
    return exp <= now;
  }).length;

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" /> Inventory
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage stock levels and track item availability.</p>
        </div>
        {(!isEvent || eventPaid) ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setGrnOpen(true)} className="gap-2" disabled={isOffline} title={isOffline ? "Online only" : undefined}>
              <PackagePlus className="h-4 w-4" /> <span className="hidden sm:inline">Receive Stock</span>
            </Button>
            <Button variant="outline" onClick={() => { setLogsOpen(true); loadLogs(); }} className="gap-2" disabled={isOffline} title={isOffline ? "Online only" : undefined}>
              <History className="h-4 w-4" /> <span className="hidden sm:inline">Activity Log</span>
            </Button>
            <Button variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        ) : null}
      </div>

      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — showing cached inventory data. Actions may be limited.</span>
        </div>
      )}

      {isEvent && eventPaid === false ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 sm:p-14 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-warning/10 text-warning grid place-items-center mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Payment Required</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Your event is currently unpaid. Please complete payment to unlock and manage your inventory.
          </p>
          <Button asChild variant="hero">
            <Link to="/dashboard/events">Go to Events <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
              <div className="text-muted-foreground text-sm font-medium mb-1">
                Items Tracked
                {isFiltered && <span className="ml-1.5 text-[10px] font-normal bg-secondary px-1.5 py-0.5 rounded-full">filtered</span>}
              </div>
              {loading ? <div className="h-8 w-16 bg-secondary animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold font-display">{trackedCount}</div>}
            </div>
            <div className="bg-card border border-warning/30 rounded-2xl p-5 shadow-soft">
              <div className="text-warning text-sm font-medium mb-1 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Low Stock
                {isFiltered && <span className="ml-0.5 text-[10px] font-normal bg-warning/10 px-1.5 py-0.5 rounded-full">filtered</span>}
              </div>
              {loading ? <div className="h-8 w-16 bg-warning/20 animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold font-display text-warning">{lowStockCount}</div>}
            </div>
            <div className="bg-card border border-destructive/30 rounded-2xl p-5 shadow-soft">
              <div className="text-destructive text-sm font-medium mb-1 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Out of Stock
                {isFiltered && <span className="ml-0.5 text-[10px] font-normal bg-destructive/10 px-1.5 py-0.5 rounded-full">filtered</span>}
              </div>
              {loading ? <div className="h-8 w-16 bg-destructive/20 animate-pulse rounded mt-1" /> : <div className="text-2xl font-bold font-display text-destructive">{outOfStockCount}</div>}
            </div>
            {(expiringCount > 0 || expiredCount > 0) && (
              <div className="bg-card border border-destructive/30 rounded-2xl p-5 shadow-soft relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <AlertCircle className="w-16 h-16 text-destructive" />
                </div>
                <div className="text-destructive text-sm font-medium mb-1 flex items-center gap-1.5 relative z-10">
                  <AlertCircle className="h-4 w-4" /> Expiry Alerts
                </div>
                {loading ? <div className="h-8 w-16 bg-destructive/20 animate-pulse rounded mt-1" /> : (
                  <div className="flex flex-col gap-1 relative z-10 mt-1">
                    {expiredCount > 0 && <span className="text-sm font-bold text-destructive">{expiredCount} Expired</span>}
                    {expiringCount > 0 && <span className="text-sm font-bold text-warning">{expiringCount} Expiring (30d)</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col gap-3">
              {/* Row 1: Search */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search items or categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-secondary border-none"
                />
              </div>

              {/* Row 2: Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="h-9 min-w-[155px] flex-1 sm:flex-none bg-secondary/70 border-none text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground shrink-0">Stock:</span>
                      <span className="font-medium truncate"><SelectValue /></span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="in_stock">✅ In Stock</SelectItem>
                    <SelectItem value="low_stock">⚠️ Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">🔴 Out of Stock</SelectItem>
                    <SelectItem value="untracked">— Untracked</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 min-w-[155px] flex-1 sm:flex-none bg-secondary/70 border-none text-sm">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-muted-foreground shrink-0">Category:</span>
                      <span className="font-medium truncate"><SelectValue /></span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(stockFilter !== "all" || categoryFilter !== "all" || search) && (
                  <button
                    onClick={() => { setStockFilter("all"); setCategoryFilter("all"); setSearch(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors ml-1"
                  >
                    Clear filters
                  </button>
                )}

                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead className="bg-secondary/50 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="py-3 px-4 rounded-tl-xl">Item</th>
                    <th className="py-3 px-4">Track Inventory</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Stock</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Expiry</th>
                    <th className="py-3 px-4 rounded-tr-xl">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-secondary animate-pulse shrink-0" />
                            <div>
                              <div className="h-4 w-32 bg-secondary animate-pulse rounded mb-1.5" />
                              <div className="h-3 w-16 bg-secondary animate-pulse rounded" />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4"><div className="h-5 w-10 bg-secondary animate-pulse rounded-full" /></td>
                        <td className="py-3 px-4"><div className="h-5 w-20 bg-secondary animate-pulse rounded" /></td>
                        <td className="py-3 px-4"><div className="h-4 w-12 bg-secondary animate-pulse rounded" /></td>
                        <td className="py-3 px-4"><div className="h-4 w-16 bg-secondary animate-pulse rounded" /></td>
                        <td className="py-3 px-4"><div className="h-4 w-16 bg-secondary animate-pulse rounded" /></td>
                        <td className="py-3 px-4 text-right"><div className="h-8 w-20 bg-secondary animate-pulse rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">No items found.</td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const isTracked = item.track_inventory;
                      const isOut = isTracked && item.stock_quantity <= 0;
                      const isLow = isTracked && !isOut && item.stock_quantity <= item.low_stock_threshold;

                      let expiryStatus = "valid";
                      if (item.expiry_date) {
                        const expDate = new Date(item.expiry_date);
                        if (expDate <= now) expiryStatus = "expired";
                        else if (expDate <= thirtyDaysFromNow) expiryStatus = "expiring";
                      }

                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover bg-secondary shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-muted-foreground">
                                  <Package className="h-5 w-5 opacity-50" />
                                </div>
                              )}
                              <div>
                                <div className="font-semibold">{item.name}</div>
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{item.category}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Switch
                              checked={item.track_inventory}
                              onCheckedChange={(v) => toggleTracking(item, v)}
                            />
                          </td>
                          <td className="py-3 px-4">
                            {!isTracked ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : isOut ? (
                              <div className="flex items-center" title="Out of Stock">
                                <Badge variant="destructive" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider py-0.5 font-bold">Out of Stock</Badge>
                                <AlertCircle className="h-4 w-4 text-destructive sm:hidden" />
                              </div>
                            ) : isLow ? (
                              <div className="flex items-center" title="Low Stock">
                                <Badge className="hidden sm:inline-flex bg-warning hover:bg-warning text-warning-foreground text-[10px] uppercase tracking-wider py-0.5 font-bold">Low Stock</Badge>
                                <AlertCircle className="h-4 w-4 text-warning sm:hidden" />
                              </div>
                            ) : (
                              <div className="flex items-center" title="In Stock">
                                <Badge className="hidden sm:inline-flex bg-green-500 hover:bg-green-600 text-white text-[10px] uppercase tracking-wider py-0.5 font-bold">In Stock</Badge>
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500 sm:hidden mx-1" />
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-base">
                            {!isTracked ? "—" : item.stock_quantity}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">
                            {!item.batch_number ? <span className="text-muted-foreground">—</span> : item.batch_number}
                          </td>
                          <td className="py-3 px-4">
                            {!item.expiry_date ? <span className="text-muted-foreground text-xs">—</span> : (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium">{new Date(item.expiry_date).toLocaleDateString()}</span>
                                {expiryStatus === "expired" && <span className="text-[10px] font-bold text-destructive">EXPIRED</span>}
                                {expiryStatus === "expiring" && <span className="text-[10px] font-bold text-warning">EXPIRING SOON</span>}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant={isTracked ? "outline" : "ghost"}
                              disabled={!isTracked}
                              onClick={() => {
                                setSelectedItem(item);
                                setAdjustQty("");
                                setNewThreshold(String(item.low_stock_threshold));
                                setRestockModalOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Adjust
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Dialog open={restockModalOpen} onOpenChange={(open) => {
            if (!open) { setAdjustQty(""); setNewThreshold(""); setSelectedItem(null); setAdjustmentReason("manual_correction"); setAdjustmentNote(""); }
            setRestockModalOpen(open);
          }}>
            <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adjust Stock</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-3 mb-6 p-3 bg-secondary/50 rounded-xl">
                  {selectedItem?.image && (
                    <img src={selectedItem.image} alt={selectedItem.name} className="w-12 h-12 rounded-lg object-cover bg-secondary" />
                  )}
                  <div>
                    <div className="font-semibold">{selectedItem?.name}</div>
                    <div className="text-sm text-muted-foreground">Current Stock: <span className="font-bold text-foreground">{selectedItem?.stock_quantity}</span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Adjustment Amount</label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setAdjustQty(prev => String((parseInt(prev) || 0) - 1))}><ArrowDown className="h-4 w-4" /></Button>
                    <Input
                      type="number"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      placeholder="+/- amount"
                      className="text-center font-mono text-lg"
                      autoFocus
                    />
                    <Button variant="outline" size="icon" onClick={() => setAdjustQty(prev => String((parseInt(prev) || 0) + 1))}><ArrowUp className="h-4 w-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Use positive numbers to add stock, negative to reduce. Leave empty to just update threshold.</p>
                </div>

                <div className="space-y-3 mt-4">
                  <label className="text-sm font-medium">Adjustment Reason</label>
                  <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Damaged / Broken</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="count_correction">Count Correction</SelectItem>
                      <SelectItem value="supplier_return">Supplier Return</SelectItem>
                      <SelectItem value="manual_correction">Manual Correction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 mt-4">
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Input 
                    placeholder="Provide additional details..." 
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                  />
                </div>

                <div className="space-y-3 mt-6 pt-6 border-t border-border/50">
                  <label className="text-sm font-medium">Low Stock Alert Threshold</label>
                  <Input
                    type="number"
                    min="0"
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(e.target.value)}
                    className="mt-1.5 h-9 bg-card"
                  />
                  <p className="text-xs text-muted-foreground">You will be alerted when stock falls to this amount.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRestockModalOpen(false)}>Cancel</Button>
                <Button variant="hero" onClick={handleRestock} disabled={isRestocking}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Activity Log Sheet (ported from PharmIQ) */}
          <Sheet open={logsOpen} onOpenChange={setLogsOpen}>
            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
                <SheetTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" /> Inventory Activity Log
                </SheetTitle>
                <p className="text-xs text-muted-foreground">Last 50 stock changes across all items.</p>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {isLogsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3 border rounded-xl animate-pulse bg-secondary/30">
                      <div className="h-10 w-10 bg-secondary rounded-full shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-secondary rounded w-3/4" />
                        <div className="h-3 bg-secondary rounded w-1/2" />
                      </div>
                    </div>
                  ))
                ) : logs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <History className="h-12 w-12 opacity-20 mx-auto mb-3" />
                    <p className="font-medium">No activity recorded yet.</p>
                    <p className="text-xs mt-1">Restocks and order deductions will appear here.</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const isPositive = log.change_qty > 0;
                    const reasonLabel =
                      log.reason === "restock" ? "Manual Restock" :
                      log.reason === "order" ? "Order Deduction" :
                      log.reason || "Unknown";
                    return (
                      <div key={log.id} className="flex gap-3 p-3 border border-border rounded-xl bg-card hover:bg-secondary/30 transition-colors">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                          isPositive ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"
                        }`}>
                          {isPositive ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {log.menu_items?.name || "Unknown Item"}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-bold ${
                              isPositive ? "text-green-600 dark:text-green-400" : "text-destructive"
                            }`}>
                              {isPositive ? "+" : ""}{log.change_qty}
                            </span>
                            <span className="text-xs text-muted-foreground">• {reasonLabel}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(log.created_at).toLocaleString([], {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="h-4" />
              </div>
            </SheetContent>
          </Sheet>
          {/* Stock Receiving (GRN) Modal */}
          <Dialog open={grnOpen} onOpenChange={setGrnOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-primary" /> Receive Stock</DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 py-4 space-y-5 pr-1">
                {/* Header fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Supplier</Label>
                    <Select value={grnSupplierId} onValueChange={setGrnSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reference / Invoice #</Label>
                    <Input value={grnReference} onChange={e => setGrnReference(e.target.value)} placeholder="e.g. INV-0042" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Input value={grnNotes} onChange={e => setGrnNotes(e.target.value)} placeholder="Optional notes" />
                  </div>
                </div>

                {/* Line items */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-foreground">Products Received</div>
                  {grnLines.map((line, idx) => (
                    <div key={idx} className="border border-border rounded-xl p-3 space-y-3 bg-secondary/20">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs">Product *</Label>
                          <Select value={line.menu_item_id} onValueChange={v => {
                            const found = items.find(i => i.id === v);
                            setGrnLines(prev => prev.map((l, i) => i === idx ? { ...l, menu_item_id: v, name: found?.name || "" } : l));
                          }}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <button onClick={() => setGrnLines(prev => prev.filter((_, i) => i !== idx))} className="mt-6 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" disabled={grnLines.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Qty *</Label>
                          <CurrencyInput value={line.quantity} onChange={(val) => setGrnLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: val } : l))} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cost/Unit (₦)</Label>
                          <CurrencyInput value={line.cost_price_per_unit} onChange={(val) => setGrnLines(prev => prev.map((l, i) => i === idx ? { ...l, cost_price_per_unit: val } : l))} placeholder="0" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Batch #</Label>
                          <Input value={line.batch_number} onChange={e => setGrnLines(prev => prev.map((l, i) => i === idx ? { ...l, batch_number: e.target.value } : l))} placeholder="Optional" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <CustomDatePicker value={line.expiry_date} onChange={(val) => setGrnLines(prev => prev.map((l, i) => i === idx ? { ...l, expiry_date: val } : l))} className="h-9 w-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setGrnLines(prev => [...prev, { menu_item_id: "", name: "", quantity: "1", cost_price_per_unit: "", batch_number: "", expiry_date: "" }])}>
                    <Plus className="h-4 w-4 mr-1" /> Add Another Product
                  </Button>
                </div>

                {/* Summary */}
                {grnLines.some(l => l.menu_item_id && parseInt(l.quantity) > 0) && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                    <div className="font-semibold text-primary mb-1">Summary</div>
                    <div className="text-muted-foreground">Total lines: <span className="font-bold text-foreground">{grnLines.filter(l => l.menu_item_id).length}</span></div>
                    <div className="text-muted-foreground">Est. total cost: <span className="font-bold text-foreground">₦{grnLines.reduce((sum, l) => sum + (parseFloat(l.cost_price_per_unit || "0") * parseInt(l.quantity || "0")), 0).toLocaleString("en-NG")}</span></div>
                  </div>
                )}
              </div>
              <DialogFooter className="border-t pt-4 mt-auto">
                <Button variant="outline" onClick={() => setGrnOpen(false)} disabled={isSavingGrn}>Cancel</Button>
                <Button variant="hero" onClick={handleReceiveStock} disabled={isSavingGrn}>
                  {isSavingGrn ? "Saving..." : "Confirm Receipt"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

    </DashboardLayout>
  );
};

export default Inventory;
