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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurant?.id) return;
    const fetchPatients = async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("name");
      if (error) {
        toast.error("Failed to load patients");
      } else {
        setPatients(data as Patient[]);
      }
      setLoading(false);
    };
    fetchPatients();
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

    if (selectedPatient) {
      const { error } = await supabase
        .from("patients")
        .update({ name, phone, allergies, chronic_conditions })
        .eq("id", selectedPatient.id);
        
      if (error) {
        toast.error("Failed to update patient");
      } else {
        setPatients(patients.map(p => p.id === selectedPatient.id ? { ...p, name, phone, allergies, chronic_conditions } : p));
        toast.success("Patient updated successfully");
        setOpenModal(false);
      }
    } else {
      const { data, error } = await supabase
        .from("patients")
        .insert({
          restaurant_id: restaurant.id,
          name,
          phone,
          allergies,
          chronic_conditions
        })
        .select()
        .single();
        
      if (error) {
        toast.error("Failed to add patient");
      } else {
        setPatients([data as Patient, ...patients]);
        toast.success("Patient added successfully");
        setOpenModal(false);
      }
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage patient profiles, allergies, and history.</p>
        </div>
        <Button onClick={openNew} className="rounded-full shrink-0 shadow-glow">
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
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-all cursor-pointer group" onClick={() => openEdit(p)}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" /> {p.phone}
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
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <div className="animate-spin w-8 h-8 mx-auto mb-3 border-4 border-primary border-t-transparent rounded-full" />
            <p>Loading patients...</p>
          </div>
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
