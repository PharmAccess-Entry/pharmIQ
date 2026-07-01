import { useState, useEffect } from "react";
import { Plus, Search, User, Phone, Activity, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { CardGridSkeleton } from "@/components/LoadingState";
import { useTelegramAlerts } from "@/lib/useTelegramAlerts";

type Patient = {
  id: string;
  name: string;
  phone: string;
  allergies: string[];
  chronic_conditions: string[];
  last_visit?: string;
};

export default function Patients() {
  const { restaurant } = useRestaurant();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const isOffline = useOfflineStatus();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sendAlert } = useTelegramAlerts();

  useEffect(() => {
    if (!restaurant?.id) return;
    const fetchPatients = async () => {
      setLoading(true);
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("patients")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("name");
        if (error) {
          toast.error("Failed to load patients");
        } else {
          const rows = data as Patient[];
          setPatients(rows);
          // Snapshot into Dexie for offline use
          const { db } = await import("@/lib/offline/db");
          await db.patients.where("restaurant_id").equals(restaurant.id).delete();
          if (rows.length > 0) await db.patients.bulkPut(rows as any[]);
        }
      } else {
        // Load from Dexie
        const { db } = await import("@/lib/offline/db");
        const rows = await db.patients.where("restaurant_id").equals(restaurant.id).sortBy("name");
        setPatients(rows as any[]);
        toast.info("Offline mode — showing cached patients");
      }
      setLoading(false);
    };
    fetchPatients();
    // Reload when sync completes
    const handler = () => fetchPatients();
    window.addEventListener("pharmiq_sync_complete", handler);
    return () => window.removeEventListener("pharmiq_sync_complete", handler);
  }, [restaurant?.id]);

  const filteredPatients = patients.filter(
    p => p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!restaurant?.id) return;
    
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const allergiesStr = formData.get("allergies") as string;
    const conditionsStr = formData.get("conditions") as string;

    const allergies = allergiesStr.split(",").map(s => s.trim()).filter(Boolean);
    const chronic_conditions = conditionsStr.split(",").map(s => s.trim()).filter(Boolean);

    const { db } = await import("@/lib/offline/db");
    const { useOfflineQueue } = await import("@/lib/offline/useOfflineQueue");
    const { queueAction } = useOfflineQueue();

    if (selectedPatient) {
      const updatedData = { name, phone, allergies, chronic_conditions };
      if (navigator.onLine) {
        const { error } = await supabase
          .from("patients")
          .update(updatedData)
          .eq("id", selectedPatient.id);
        if (error) {
          toast.error("Failed to update patient");
          setSaving(false);
          return;
        }
      } else {
        await queueAction(restaurant.id, "PATIENT_UPDATE", { id: selectedPatient.id, data: updatedData });
      }
      // Update Dexie and local state
      await db.patients.update(selectedPatient.id, updatedData as any);
      setPatients(patients.map(p => p.id === selectedPatient.id ? { ...p, ...updatedData } : p));
      
      sendAlert(
        "🏥 Patient Profile Updated",
        `Name: ${name}\nPhone: ${phone}`,
        "major_events"
      );

      toast.success(navigator.onLine ? "Patient updated successfully" : "Saved offline — will sync when connected");
      setOpenModal(false);
    } else {
      const { v4: uuidv4 } = await import("uuid");
      const newId = uuidv4();
      const now = new Date().toISOString();
      const payload = {
        id: newId,
        restaurant_id: restaurant.id,
        name,
        phone,
        allergies,
        chronic_conditions,
        created_at: now,
        updated_at: now,
      };
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from("patients")
          .insert(payload)
          .select()
          .single();
        if (error) {
          toast.error("Failed to add patient");
          setSaving(false);
          return;
        }
        await db.patients.put(data as any);
        setPatients([data as Patient, ...patients]);
        toast.success("Patient added successfully");
      } else {
        await db.patients.put(payload as any);
        await queueAction(restaurant.id, "PATIENT_CREATE", payload);
        setPatients([payload as unknown as Patient, ...patients]);
        toast.success("Patient saved offline — will sync when connected");
      }

      sendAlert(
        "🏥 New Patient Added",
        `Name: ${name}\nPhone: ${phone}`,
        "major_events"
      );

      setOpenModal(false);
    }
    setSaving(false);
  };

  const openNew = () => {
    setSelectedPatient(null);
    setOpenModal(true);
  };

  const openEdit = (p: Patient) => {
    setSelectedPatient(p);
    setOpenModal(true);
  };

  return (
    <DashboardLayout>
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — showing cached patients. Adding or editing patients is disabled until you reconnect.</span>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage patient profiles, allergies, and history.</p>
        </div>
        <Button onClick={openNew} className="rounded-full shrink-0 shadow-glow" disabled={isOffline} title={isOffline ? "Online only" : undefined}>
          <Plus className="w-4 h-4 mr-2" /> Add Patient
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name or phone number..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="pl-9 h-11 bg-card rounded-xl border-border focus:border-primary transition-all"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all cursor-pointer group overflow-hidden relative" onClick={() => openEdit(p)}>
            <div className="flex items-start justify-between mb-4 w-full">
              <div className="flex items-center gap-3 min-w-0 w-full">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                  {p.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate" title={p.name}>{p.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                    <Phone className="w-3 h-3 shrink-0" /> <span className="truncate">{p.phone}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {p.allergies.length > 0 ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mb-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Allergies
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.allergies.map(a => <span key={a} className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">{a}</span>)}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 opacity-50" /> No known allergies</div>
              )}

              {p.chronic_conditions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 mb-1">
                    <Activity className="w-3.5 h-3.5" /> Chronic Conditions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.chronic_conditions.map(c => <span key={c} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">{c}</span>)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Last Visit:</span>
              <span className="font-medium text-foreground">
                {p.last_visit ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(p.last_visit)) : "New Patient"}
              </span>
            </div>
          </div>
        ))}

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : filteredPatients.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium text-foreground">No patients found</p>
            <p className="text-sm">Try adjusting your search or add a new patient.</p>
          </div>
        )}
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedPatient ? "Edit Patient Profile" : "Add New Patient"}</DialogTitle>
            <DialogDescription>Store medical history to ensure safe prescriptions.</DialogDescription>
          </DialogHeader>
          {selectedPatient?.last_visit && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Last Pharmacy Visit:</span>
              <span className="font-semibold text-primary">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(selectedPatient.last_visit))}</span>
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" defaultValue={selectedPatient?.name} required placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" defaultValue={selectedPatient?.phone} required placeholder="080..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies" className="text-destructive">Known Allergies (Comma separated)</Label>
              <Input id="allergies" name="allergies" defaultValue={selectedPatient?.allergies.join(", ")} placeholder="e.g. Penicillin, Sulfa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conditions" className="text-amber-500">Chronic Conditions (Comma separated)</Label>
              <Input id="conditions" name="conditions" defaultValue={selectedPatient?.chronic_conditions.join(", ")} placeholder="e.g. Hypertension, Diabetes" />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setOpenModal(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" className="shadow-glow" disabled={saving}>
                {saving ? "Saving..." : selectedPatient ? "Save Changes" : "Add Patient"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}
