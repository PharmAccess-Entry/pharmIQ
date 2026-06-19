import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FormEvent, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const rawRedirect = params.get("redirect") || "/dashboard";
  // Only allow relative paths — prevent open redirect
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";

  useEffect(() => { if (user) nav(redirect, { replace: true }); }, [user, nav, redirect]);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const hasXSS = (str: string) => /<[^>]*>/i.test(str);
    if (hasXSS(email) || hasXSS(password)) {
      return toast.error("Invalid characters detected in credentials.");
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Welcome back 👋");
    nav(redirect, { replace: true });
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your PharmIQ dashboard." footer={<>Don't have an account? <Link to="/signup" className="text-primary font-medium">Sign up</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })); }}
            placeholder="you@pharmacy.ng"
            autoComplete="email"
            className={`mt-1.5 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between"><Label htmlFor="login-password">Password</Label><Link to="/forgot-password" className="text-xs text-primary">Forgot?</Link></div>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
            placeholder="••••••••"
            autoComplete="current-password"
            className={`mt-1.5 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Logging in…</> : "Log in"}
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full gap-2" 
          onClick={async () => {
            toast.loading("Waiting for fingerprint/Face ID...", { id: "passkey-login" });
            try {
              const { data, error } = await supabase.auth.signInWithPasskey();
              if (error) throw error;
              toast.success("Welcome back 👋", { id: "passkey-login" });
              nav(redirect, { replace: true });
            } catch (e: any) {
              console.error("Passkey login error:", e);
              toast.error(e.message || "Failed to sign in. Make sure you registered your fingerprint in Settings first.", { id: "passkey-login" });
            }
          }}
        >
          <Fingerprint className="h-4 w-4" />
          Sign in with Fingerprint / Face ID
        </Button>
      </form>
    </AuthShell>
  );
};
export default Login;

