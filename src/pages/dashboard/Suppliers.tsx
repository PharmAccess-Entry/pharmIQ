import { useState, useEffect } from "react";
import { Plus, Search, Truck, Phone, Mail, MapPin, Building2, CheckCircle2, XCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { CardGridSkeleton } from "@/components/LoadingState";

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "inactive";
  notes: string | null;
};

export default function Suppliers() {
  const { restaurant } = useRestaurant();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isOffline = useOfflineStatus();

  useEffect(() => {
    if (!restaurant?.id) return;
    const fetchSuppliers = async () => {
      setLoading(true);
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("suppliers")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("name");
        if (error) {
          toast.error("Failed to load suppliers");
        } else {
          const rows = data as Supplier[];
          setSuppliers(rows);
          const { db } = await import("@/lib/offline/db");
          await db.suppliers.where("restaurant_id").equals(restaurant.id).delete();
          if (rows.length > 0) await db.suppliers.bulkPut(rows as any[]);
        }
      } else {
        const { db } = await import("@/lib/offline/db");
        const rows = await db.suppliers.where("restaurant_id").equals(restaurant.id).sortBy("name");
        setSuppliers(rows as any[]);
        toast.info("Offline mode — showing cached suppliers");
      }
      setLoading(false);
    };
    fetchSuppliers();
    const handler = () => fetchSuppliers();
    window.addEventListener("pharmiq_sync_complete", handler);
    return () => window.removeEventListener("pharmiq_sync_complete", handler);
  }, [restaurant?.id]);

  const filteredSuppliers = suppliers.filter(
    s => s.name.toLowerCase().includes(search.toLowerCase()) || 
         (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase())) ||
         (s.phone && s.phone.includes(search))
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restaurant?.id) return;
    
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const contact_name = formData.get("contact_name") as string || null;
    const phone = formData.get("phone") as string || null;
    const email = formData.get("email") as string || null;
    const address = formData.get("address") as string || null;
    const notes = formData.get("notes") as string || null;
    const status = formData.get("status") as "active" | "inactive" || "active";

    const payload = {
      name, contact_name, phone, email, address, notes, status
    };

    const { db } = await import("@/lib/offline/db");
    const { useOfflineQueue } = await import("@/lib/offline/useOfflineQueue");
    const { queueAction } = useOfflineQueue();

    if (selectedSupplier) {
      if (navigator.onLine) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", selectedSupplier.id);
        if (error) {
          toast.error("Failed to update supplier: " + error.message);
          setSaving(false);
          return;
        }
      } else {
        await queueAction(restaurant.id, "SUPPLIER_UPDATE", { id: selectedSupplier.id, data: payload });
      }
      await db.suppliers.update(selectedSupplier.id, payload as any);
      setSuppliers(suppliers.map(s => s.id === selectedSupplier.id ? { ...s, ...payload } : s));
      toast.success(navigator.onLine ? "Supplier updated successfully" : "Saved offline — will sync when connected");
      setOpenModal(false);
    } else {
      const { v4: uuidv4 } = await import("uuid");
      const newId = uuidv4();
      const now = new Date().toISOString();
      const fullPayload = { ...payload, id: newId, restaurant_id: restaurant.id, created_at: now, updated_at: now };
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("suppliers")
          .insert(fullPayload)
          .select()
          .single();
        if (error) {
          toast.error("Failed to add supplier: " + error.message);
          setSaving(false);
          return;
        }
        await db.suppliers.put(data as any);
        setSuppliers([data as Supplier, ...suppliers]);
        toast.success("Supplier added successfully");
      } else {
        await db.suppliers.put(fullPayload as any);
        await queueAction(restaurant.id, "SUPPLIER_CREATE", fullPayload);
        setSuppliers([fullPayload as unknown as Supplier, ...suppliers]);
        toast.success("Supplier saved offline — will sync when connected");
      }
      setOpenModal(false);
    }
    setSaving(false);
  };


  const openNew = () => {
    setSelectedSupplier(null);
    setOpenModal(true);
  };

  const openEdit = (s: Supplier) => {
    setSelectedSupplier(s);
    setOpenModal(true);
  };

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {isOffline && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — showing cached suppliers. Changes will be synced when you reconnect.</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage distributors, wholesalers, and manufacturers.</p>
        </div>
        <Button onClick={openNew} className="rounded-full shrink-0 shadow-glow">
          <Plus className="w-4 h-4 mr-2" /> Add Supplier
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search suppliers by name, contact, or phone..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-9 h-11 bg-card rounded-xl border-border focus:border-primary transition-all"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSuppliers.map((s) => (
          <div key={s.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all cursor-pointer group" onClick={() => openEdit(s)}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{s.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    {s.status === 'active' ? (
                      <span className="flex items-center text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Active</span>
                    ) : (
                      <span className="flex items-center text-destructive"><XCircle className="w-3 h-3 mr-1" /> Inactive</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4 text-sm text-muted-foreground">
              {s.contact_name && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{s.contact_name}</span>
                </div>
              )}
              {s.phone && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{s.phone}</span>
                </div>
              )}
              {s.email && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{s.email}</span>
                </div>
              )}
              {s.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 break-words leading-relaxed">{s.address}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : filteredSuppliers.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium text-foreground">No suppliers found</p>
            <p className="text-sm">Try adjusting your search or add a new supplier.</p>
          </div>
        )}
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
            <DialogDescription>Enter the distributor or manufacturer details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input id="name" name="name" defaultValue={selectedSupplier?.name} required placeholder="e.g. Emzor Pharmaceuticals" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Person</Label>
                <Input id="contact_name" name="contact_name" defaultValue={selectedSupplier?.contact_name || ""} placeholder="e.g. Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" defaultValue={selectedSupplier?.phone || ""} placeholder="080..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" defaultValue={selectedSupplier?.email || ""} placeholder="contact@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" defaultValue={selectedSupplier?.status || "active"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" name="address" defaultValue={selectedSupplier?.address || ""} placeholder="123 Distributor Way..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={selectedSupplier?.notes || ""} placeholder="Additional info, terms of credit, etc." rows={2} />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenModal(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" className="shadow-glow" disabled={saving}>
                {saving ? "Saving..." : selectedSupplier ? "Save Changes" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
