import { useState, useEffect } from "react";
import { Plus, Search, Receipt, Calendar, CreditCard, CheckCircle2, AlertCircle, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { DashboardLayout } from "@/components/DashboardLayout";
import { formatNaira } from "@/lib/format";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTelegramAlerts } from "@/lib/useTelegramAlerts";
import { getCurrencySymbol } from "@/lib/format";

type Expense = {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  created_at: string;
};

const EXPENSE_CATEGORIES = [
  "Restocking (Drugs)",
  "Restocking (Consumables)",
  "Salary / Wages",
  "Utilities (Power/Water)",
  "Rent",
  "Maintenance & Repairs",
  "Marketing & Ads",
  "Logistics & Delivery",
  "Miscellaneous",
];

export default function Expenses() {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const isOffline = useOfflineStatus();
  const { sendAlert } = useTelegramAlerts();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!rid) return;
    loadExpenses();
    const handler = () => loadExpenses();
    window.addEventListener("pharmiq_sync_complete", handler);
    return () => window.removeEventListener("pharmiq_sync_complete", handler);
  }, [rid]);

  const loadExpenses = async () => {
    setLoading(true);
    if (navigator.onLine) {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("restaurant_id", rid)
        .order("expense_date", { ascending: false });
      if (error) {
        toast.error("Failed to load expenses");
      } else {
        const rows = (data || []) as Expense[];
        setExpenses(rows);
        // Snapshot into Dexie
        const { db } = await import("@/lib/offline/db");
        await db.expenses.where("restaurant_id").equals(rid!).delete();
        if (rows.length > 0) {
          await db.expenses.bulkPut(rows.map(e => ({ ...e, date: (e as any).expense_date || e.created_at?.split('T')[0] })) as any[]);
        }
      }
    } else {
      const { db } = await import("@/lib/offline/db");
      const rows = await db.expenses.where("restaurant_id").equals(rid!).reverse().sortBy("date");
      setExpenses(rows.map(r => ({ ...r, expense_date: r.date, description: r.description })) as unknown as Expense[]);
    }
    setLoading(false);
  };

  const saveExpense = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      return toast.error("Enter a valid amount");
    }
    
    setSaving(true);
    const { v4: uuidv4 } = await import("uuid");
    const now = new Date().toISOString();
    const supabasePayload = {
      id: uuidv4(),
      restaurant_id: rid,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      expense_date: form.expense_date,
      created_at: now,
    };

    if (navigator.onLine) {
      const { error } = await supabase.from("expenses").insert(supabasePayload);
      setSaving(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Expense recorded");
        
        sendAlert(
          "💸 New Expense Logged",
          `Category: ${form.category}\nAmount: ${formatNaira(Number(form.amount))}\nDescription: ${form.description || "N/A"}`,
          "major_events"
        );

        setModalOpen(false);
        loadExpenses();
      }
    } else {
      const { db } = await import("@/lib/offline/db");
      const { useOfflineQueue } = await import("@/lib/offline/useOfflineQueue");
      const { queueAction } = useOfflineQueue();
      const offlinePayload = { ...supabasePayload, date: form.expense_date };
      await db.expenses.put(offlinePayload as any);
      await queueAction(rid!, "EXPENSE_CREATE", supabasePayload);
      setExpenses(prev => [supabasePayload as unknown as Expense, ...prev]);
      toast.success("Expense saved offline — will sync when connected");

      sendAlert(
        "💸 New Expense Logged",
        `Category: ${form.category}\nAmount: ${formatNaira(Number(form.amount))}\nDescription: ${form.description || "N/A"}`,
        "major_events"
      );

      setModalOpen(false);
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Expense deleted");
      setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  const filtered = expenses.filter(e => 
    e.category.toLowerCase().includes(search.toLowerCase()) || 
    (e.description && e.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalExpenses = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <DashboardLayout>
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — showing cached expenses. Adding new expenses is disabled until you reconnect.</span>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">Expenses</h1>
            <p className="text-muted-foreground mt-1">Track and manage your pharmacy operating costs.</p>
          </div>
          <Button onClick={() => {
            setForm({
              category: EXPENSE_CATEGORIES[0],
              amount: "",
              description: "",
              expense_date: new Date().toISOString().split('T')[0]
            });
            setModalOpen(true);
          }} disabled={isOffline} title={isOffline ? "Online only" : undefined}>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </Button>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-secondary/30">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by category or description..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-card border-border/50" 
              />
            </div>
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl border border-primary/20 shrink-0 w-full sm:w-auto">
              <Receipt className="h-5 w-5" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Shown</div>
                <div className="font-display font-bold leading-none">{formatNaira(totalExpenses)}</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-secondary/50 text-muted-foreground font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-20 rounded-md" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-28 rounded-full" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-40 rounded-md" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16 rounded-md" /></td>
                      <td className="py-3 px-4 text-right"><Skeleton className="h-7 w-16 rounded-lg ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto opacity-20 mb-3" />
                      <p>No expenses found.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(expense => (
                    <tr key={expense.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        {new Date(expense.expense_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block whitespace-nowrap bg-secondary px-2.5 py-1 rounded-md text-xs font-medium border border-border/50">
                          {expense.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={expense.description || ""}>
                        {expense.description || <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4 font-bold text-destructive whitespace-nowrap">
                        {formatNaira(expense.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record New Expense</DialogTitle>
              <DialogDescription>Log an operating cost for your pharmacy.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Date</Label>
                <CustomDatePicker 
                  value={form.expense_date}
                  onChange={(val) => setForm({...form, expense_date: val})}
                  className="mt-1.5 w-full"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount ({getCurrencySymbol()})</Label>
                <CurrencyInput 
                  value={form.amount} 
                  onChange={(val) => setForm({...form, amount: val})}
                  placeholder="0" 
                  className="mt-1.5 w-full"
                />
              </div>
              <div>
                <Label>Description / Note (Optional)</Label>
                <Textarea 
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="What was this for?"
                  className="mt-1.5 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={saveExpense} disabled={saving}>{saving ? "Saving..." : "Record Expense"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
