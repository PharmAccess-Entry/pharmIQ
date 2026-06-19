import { useState, useEffect } from "react";
import { Plus, Search, Receipt, Calendar, CreditCard, CheckCircle2, AlertCircle, FileText, Trash2 } from "lucide-react";
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
import { formatNaira } from "@/lib/format";

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
  }, [rid]);

  const loadExpenses = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("restaurant_id", rid)
      .order("expense_date", { ascending: false });
      
    if (error) {
      toast.error("Failed to load expenses");
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  const saveExpense = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      return toast.error("Enter a valid amount");
    }
    
    setSaving(true);
    const payload = {
      restaurant_id: rid,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      expense_date: form.expense_date
    };

    const { error } = await supabase.from("expenses").insert(payload);
    
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Expense recorded");
      setModalOpen(false);
      loadExpenses();
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
          }}>
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
            <table className="w-full text-sm text-left">
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
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Loading expenses...</td>
                  </tr>
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
                        <span className="bg-secondary px-2.5 py-1 rounded-md text-xs font-medium border border-border/50">
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
                <Input 
                  type="date" 
                  value={form.expense_date}
                  onChange={e => setForm({...form, expense_date: e.target.value})}
                  className="mt-1.5"
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
                <Label>Amount (₦)</Label>
                <Input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm({...form, amount: e.target.value})}
                  placeholder="e.g. 5000"
                  className="mt-1.5"
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
