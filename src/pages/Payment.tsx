import { Button } from "@/components/ui/button";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRestaurant, EVENT_TIERS, monthlyPriceForTables } from "@/lib/restaurant";
import { formatNaira } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { BrandedLoader } from "@/components/LoadingState";

const Payment = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { restaurant, refresh } = useRestaurant();

  const kind = (params.get("kind") || "restaurant") as "restaurant" | "event" | "pharmacy";
  const tableCount = parseInt(params.get("tables") || "10", 10);
  const period = (params.get("period") || "monthly") as "monthly" | "annual";
  const eventId = params.get("eventId");
  const reference = params.get("reference") || params.get("trxref"); // returned from Paystack callback

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [eventData, setEventData] = useState<{ id: string; name: string; tier: string; amount: number } | null>(null);

  useEffect(() => {
    if (eventId) {
      supabase.from("events").select("*").eq("id", eventId).maybeSingle().then(({ data }) => setEventData(data));
    }
  }, [eventId]);

  // Handle Paystack callback
  useEffect(() => {
    if (!reference) return;
    setVerifying(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-verify?reference=${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json();
        setVerifying(false);
        if (j.ok) {
          toast.success("Payment successful 🎉");
          await refresh();
          // Best-effort receipt email
          try {
            await supabase.functions.invoke("send-email", {
              body: {
                template: "payment_receipt",
                to: user?.email,
                data: {
                  description: j.kind === "event" ? `Event activation` : `Subscription`,
                  amount: formatNaira(amount),
                  reference,
                },
              },
            });
          } catch { /* noop */ }
          nav("/dashboard");
        } else {
          toast.error("Payment was not completed");
        }
      } catch {
        setVerifying(false);
        toast.error("Could not verify payment");
      }
    })();
  }, [reference, nav, refresh]);

  const eventTier = kind === "event" && eventData
    ? EVENT_TIERS.find((t) => t.id === eventData.tier) || EVENT_TIERS[0]
    : null;

  const PHARMACY_MONTHLY = 5000;
  
  const amount = kind === "restaurant"
    ? (period === "annual" ? monthlyPriceForTables(tableCount) * 10 : monthlyPriceForTables(tableCount))
    : kind === "pharmacy"
    ? (period === "annual" ? PHARMACY_MONTHLY * 10 : PHARMACY_MONTHLY)
    : eventData ? Number(eventData.amount) : 0;

  const labelName = kind === "restaurant" 
    ? `${tableCount} Table${tableCount === 1 ? "" : "s"} Capacity` 
    : kind === "pharmacy"
    ? "PharmIQ Subscription"
    : eventData ? `Event: ${eventData.name}` : "—";
    
  const labelPeriod = (kind === "restaurant" || kind === "pharmacy") 
    ? (period === "annual" ? "Yearly" : "Monthly") 
    : "One-time (per event)";

  const pay = async () => {
    if (!user) { toast.error("Please log in first"); nav("/login?redirect=/payment"); return; }
    setLoading(true);
    try {
      const callbackUrl = `${window.location.origin}/payment`;
      const restaurantId = restaurant?.id;
      const { data, error } = await supabase.functions.invoke("paystack-init", {
        body: kind === "restaurant"
          ? { kind: "restaurant", tables: tableCount, period, callbackUrl, restaurantId }
          : kind === "pharmacy"
          ? { kind: "restaurant", tables: 2.5, period, callbackUrl, restaurantId }
          : { kind: "event", eventId, callbackUrl, restaurantId },
      });
      if (error) throw error;
      if (!data?.authorization_url) throw new Error("No checkout URL returned");
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setLoading(false);
      let msg = e.message || "Could not start payment";
      try {
        if (e.context && typeof e.context.json === 'function') {
          const body = await e.context.clone().json();
          if (body?.error) msg = body.error;
        } else if (e.context && e.context.error) {
          msg = e.context.error;
        } else if (e.name === 'FunctionsHttpError' && e.message) {
          // Keep generic message if parsing fails
        }
      } catch (err) { /* ignore parse errors */ }
      toast.error(msg);
    }
  };

  const backTarget = kind === "event" ? "/dashboard/events" : "/dashboard/settings#plan";
  const PaymentHeader = () => (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="container h-16 flex items-center justify-between gap-3">
        <Logo size="md" to="/dashboard" className="min-w-0" />
        <Button variant="outline" size="sm" onClick={() => nav("/dashboard")} className="whitespace-nowrap">Dashboard</Button>
      </div>
    </header>
  );

  if (verifying) {
    return <BrandedLoader fullscreen message="Verifying your payment…" />;
  }

  if (loading) {
    return <BrandedLoader fullscreen message="Redirecting to secure checkout..." />;
  }

  const features = kind === "restaurant"
    ? ["Custom QR menu", "Order & Kitchen management", "Staff accounts", "Detailed analytics", "Priority support"]
    : kind === "pharmacy"
    ? ["Unlimited products & categories", "POS, inventory & shift management", "Staff accounts & roles", "Analytics & daily reports", "Priority support"]
    : eventTier
      ? ["QR codes per table", "Live request feed", "Pay only for this event"]
      : [];

  return (
    <div className="min-h-screen flex flex-col">
      <PaymentHeader />
      <main className="flex-1 container py-12 max-w-4xl">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Activate your {kind === "event" ? "event" : "plan"}</h1>
        <p className="text-muted-foreground mt-2">Secure payment powered by Paystack.</p>

        <div className="grid lg:grid-cols-5 gap-6 mt-8">
          <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-soft">
            <h3 className="font-display font-semibold mb-4">What you're paying for</h3>
            <div className="rounded-xl bg-primary-soft/50 p-4 mb-4">
              <div className="font-display font-bold text-lg">{labelName}</div>
              <div className="text-sm text-muted-foreground mt-1">{labelPeriod}</div>
            </div>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-soft h-fit">
            <h3 className="font-display font-semibold mb-4">Order summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Account</span><span className="font-medium truncate min-w-0">{user?.email || restaurant?.name || "—"}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Item</span><span className="font-medium truncate min-w-0">{labelName}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Billing</span><span className="font-medium">{labelPeriod}</span></div>
              <div className="border-t border-border pt-3 flex justify-between items-baseline gap-2">
                <span className="font-semibold">Total</span>
                <span className="font-display font-bold text-lg break-all text-right">{formatNaira(amount)}</span>
              </div>
            </div>
            <Button variant="hero" className="w-full mt-5 whitespace-nowrap" onClick={pay} disabled={loading || amount <= 0}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Redirecting…</> : <>Pay {formatNaira(amount)}</>}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-3">
              <ShieldCheck className="h-3.5 w-3.5" /> Encrypted by Paystack
            </div>
          </div>
        </div>
      </main>
      
    </div>
  );
};
export default Payment;