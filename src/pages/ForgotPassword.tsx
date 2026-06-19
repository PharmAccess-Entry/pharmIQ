import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError("");
    setLoading(true);
    await resetPassword(email.trim());
    setLoading(false);
    setSent(true);
  };

  return (
    <AuthShell
      title="Forgot password?"
      subtitle="We'll email you a reset link."
      footer={<Link to="/login" className="text-primary font-medium">Back to login</Link>}
    >
      {sent ? (
        <div className="rounded-xl bg-primary-soft text-primary p-4 text-sm">
          Check your email for a reset link. It may take a moment to arrive.
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
              autoComplete="email"
              placeholder="you@pharmacy.ng"
              className={`mt-1.5 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            />
            {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPassword;
