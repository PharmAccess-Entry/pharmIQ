import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FormEvent, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { sanitizeInput } from "@/lib/sanitize";
import { detectCountryInfo } from "@/lib/countryDetect";

const schema = z.object({
  restaurantName: z.string().trim().min(2, "Business name is too short").max(80).transform(val => sanitizeInput(val)),
  businessType: z.enum(["restaurant", "event", "pharmacy"]),
  email: z.string().trim().email("Invalid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

const Signup = () => {
  const nav = useNavigate();
  const { signUp } = useAuth();
  const [params] = useSearchParams();
  const [restaurantName, setRestaurantName] = useState("");
  const [businessType, setBusinessType] = useState<"restaurant" | "event" | "pharmacy">("pharmacy");
  useEffect(() => {
    const t = params.get("type");
    if (t === "event" || t === "restaurant" || t === "pharmacy") setBusinessType(t);
  }, [params]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Validate empty states strictly for the security audit
    if (!restaurantName.trim() || !email.trim() || !password.trim()) {
      return toast.error("Please fill out all required fields.");
    }
    const parsed = schema.safeParse({ restaurantName, businessType, email, password, confirm });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await signUp(parsed.data.email, parsed.data.password, parsed.data.restaurantName, parsed.data.businessType);
    if (error) { setLoading(false); return toast.error(error); }

    // Background: detect country & save to restaurant (non-blocking)
    detectCountryInfo().then(async (info) => {
      if (!info) return;
      try {
        // Wait briefly for the DB trigger to create the restaurant row
        await new Promise(r => setTimeout(r, 2000));
        const { data: { user: newUser } } = await supabase.auth.getUser();
        if (!newUser) return;
        const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", newUser.id).maybeSingle();
        if (!rest?.id) return;
        await supabase.from("restaurants").update({
          country: info.country,
          currency_code: info.currency_code,
          currency_symbol: info.currency_symbol,
          timezone: info.timezone,
          language: info.language,
        }).eq("id", rest.id);
      } catch {}
    });

    setLoading(false);
    toast.success("Account created! Check your email to confirm, then log in.");
    nav("/login");
  };

  return (
    <AuthShell title="Create your account" subtitle="Start managing your pharmacy sales & inventory today." footer={<>Already have an account? <Link to="/login" className="text-primary font-medium">Log in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Business name</Label><Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="MedPlus Pharmacy" required className="mt-1.5" /></div>
        <div className="hidden">
          <Label>Business type</Label>
          <Input value={businessType} readOnly />
        </div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@pharmacy.ng" required className="mt-1.5" /></div>
        <div><Label>Password</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" required className="mt-1.5" /></div>
        <div><Label>Confirm password</Label><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password" required className="mt-1.5" /></div>
        <Button type="submit" variant="hero" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : "Create account"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> & <Link to="/privacy" className="underline">Privacy</Link>.</p>
      </form>
    </AuthShell>
  );
};
export default Signup;
