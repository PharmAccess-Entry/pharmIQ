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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PackageOpen, Plus, Search, ArrowRight, Truck } from "lucide-react";

export default function PurchaseHistory() {
  const { restaurant, role } = useRestaurant();
  const { user } = useAuth();
  const rid = restaurant?.id;

  const [receivings, setReceivings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [menuItemId, setMenuItemId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [costPrice, setCostPrice] = useState("");

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  useEffect(() => {
    if (!rid) return;
    fetchData();
  }, [rid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRec, resSup, resItems] = await Promise.all([
        supabase.from("stock_receivings").select("*, stock_receiving_items(*, menu_items(name)), suppliers(name), user_roles(role)").eq("restaurant_id", rid).order("created_at", { ascending: false }),
        supabase.from("suppliers").select("id, name").eq("restaurant_id", rid).order("name"),
        supabase.from("menu_items").select("id, name, track_inventory").eq("restaurant_id", rid).eq("track_inventory", true).order("name"),
      ]);

      if (resRec.data) setReceivings(resRec.data);
      if (resSup.data) setSuppliers(resSup.data);
      if (resItems.data) setMenuItems(resItems.data);
    } catch (e: any) {
      toast.error("Failed to load purchase history");
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rid || !user?.id) return;
    if (!supplierId || !menuItemId || !qty || !costPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const q = parseInt(qty);
      const cost = parseInt(costPrice);

      // 1. Create a new product batch
      const { data: batch, error: batchErr } = await supabase
        .from("product_batches")
        .insert({
          menu_item_id: menuItemId,
          batch_number: batchNumber || `BATCH-${Date.now().toString().slice(-5)}`,
          expiry_date: expiryDate || null,
          cost_price: cost,
          stock_quantity: q,
          supplier_id: supplierId,
        })
        .select("id")
        .single();
      
      if (batchErr) throw batchErr;

      // 2. Fetch user role ID
      const { data: roleRow } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("restaurant_id", rid).single();

      // 3. Create stock_receivings ledger entry
      const { data: receiving, error: recErr } = await supabase
        .from("stock_receivings")
        .insert({
          restaurant_id: rid,
          supplier_id: supplierId,
          invoice_number: invoiceNumber || null,
          received_by: roleRow?.id || null,
          total_cost: q * cost,
        })
        .select("id")
        .single();

      if (recErr) throw recErr;

      // 4. Create stock_receiving_items entry
      const { error: itemErr } = await supabase
        .from("stock_receiving_items")
        .insert({
          receiving_id: receiving.id,
          batch_id: batch.id,
          menu_item_id: menuItemId,
          qty_received: q,
          cost_price: cost,
        });

      if (itemErr) throw itemErr;

      // 5. Add received quantity to menu_items using the RPC so that:
      //    a) the change is atomic and logged correctly in inventory_logs
      //    b) any pre-existing stock set manually (without a batch record) is NOT destroyed
      await supabase.rpc("update_stock_with_reason", {
        p_restaurant_id: rid,
        p_menu_item_id: menuItemId,
        p_change_qty: q,
        p_reason: "purchase",
        p_movement_type: "receiving",
        p_note: `Received batch ${batchNumber || batch.id} from supplier`,
        p_reference_id: receiving.id,
        p_reference_type: "stock_receiving",
      });

      toast.success("Stock received successfully!");
      setReceiveModalOpen(false);
      
      // Reset form
      setSupplierId(""); setInvoiceNumber(""); setMenuItemId(""); setBatchNumber(""); setExpiryDate(""); setQty(""); setCostPrice("");
      
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  };

  const filtered = receivings.filter(r => 
    r.invoice_number?.toLowerCase().includes(search.toLowerCase()) || 
    r.suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (role === "staff") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive grid place-items-center">
            <PackageOpen className="h-8 w-8" />
          </div>
          <div>
            <h2 className="font-display font-bold text-2xl">Access Denied</h2>
            <p className="text-muted-foreground text-sm">You do not have permission to view purchase history.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Purchase History & Receiving — PharmIQ</title>
      </Helmet>
      
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl lg:text-3xl flex items-center gap-2">
              <Truck className="h-7 w-7 text-primary" /> Purchase History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Track incoming stock batches and supplier invoices.</p>
          </div>
          <Button onClick={() => setReceiveModalOpen(true)} className="gap-2 font-bold whitespace-nowrap">
            <Plus className="h-4 w-4" /> Receive Stock
          </Button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by invoice or supplier..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border shadow-sm rounded-xl"
          />
        </div>

        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Supplier</th>
                  <th className="px-5 py-3 font-semibold">Invoice #</th>
                  <th className="px-5 py-3 font-semibold">Items Received</th>
                  <th className="px-5 py-3 font-semibold">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <PackageOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p>No purchase history found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3 font-medium whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-5 py-3 font-semibold">{r.suppliers?.name || "Unknown"}</td>
                      <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{r.invoice_number || "N/A"}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          {r.stock_receiving_items?.map((item: any) => (
                            <div key={item.id} className="text-xs flex items-center gap-1.5">
                              <span className="font-semibold">{item.menu_items?.name}</span>
                              <span className="text-muted-foreground">× {item.qty_received}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-bold text-primary">{formatNaira(r.total_cost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={receiveModalOpen} onOpenChange={setReceiveModalOpen}>
        <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-primary" /> Receive Stock
            </DialogTitle>
            <DialogDescription>
              Record incoming inventory from a supplier. This creates a new batch for FEFO routing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReceiveStock} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Supplier *</label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-xs font-bold uppercase text-muted-foreground">Invoice Number</label>
                <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-1234" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-muted-foreground">Product (Drug) *</label>
              <Select value={menuItemId} onValueChange={setMenuItemId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select product to receive..." />
                </SelectTrigger>
                <SelectContent>
                  {menuItems.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Batch Number</label>
                <Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="Auto-generated if empty" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Expiry Date</label>
                <CustomDatePicker value={expiryDate} onChange={setExpiryDate} placeholder="mm/dd/yyyy" className="w-full h-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Quantity Received *</label>
                <CurrencyInput required value={qty} onChange={setQty} placeholder="0" className="w-full h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Unit Cost (₦) *</label>
                <CurrencyInput required value={costPrice} onChange={setCostPrice} placeholder="0" className="w-full h-10" />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setReceiveModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? "Processing..." : "Receive Stock"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
