import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FormEvent, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";

type InviteInfo = {
  email: string;
  role: string;
  restaurant_name: string;
  expires_at: string;
};

const StaffInvite = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteError("No invite token found in the link.");
      setLoadingInfo(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_info", { p_token: token });
      setLoadingInfo(false);
      if (error || !data || data.error) {
        setInviteError(data?.error || "This invite link is invalid or has already been used.");
        return;
      }
      setInfo(data as InviteInfo);
    })();
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (!fullName.trim()) return toast.error("Please enter your full name.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");

    setSubmitting(true);

    // Step 1: Create the Supabase Auth account (this ensures proper password hashing)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: info.email,
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (signUpError) {
      setSubmitting(false);
      // If user already exists, try signing in instead
      if (signUpError.message?.toLowerCase().includes("already registered")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: info.email,
          password,
        });
        if (signInError) {
          return toast.error("This email is already registered. Please log in first, then accept the invite.");
        }
      } else {
        return toast.error(signUpError.message || "Failed to create account. Please try again.");
      }
    }

    // Step 2: Now that user is authenticated, assign the role via RPC
    const { data, error } = await supabase.rpc("redeem_staff_invite", {
      p_token: token,
      p_email: info.email,
    });
    setSubmitting(false);

    if (error || data?.error) {
      return toast.error(data?.error || error?.message || "Something went wrong. Please try again.");
    }

    setDone(true);
  };


  if (loadingInfo) {
    return (
      <AuthShell title="Loading…" subtitle="Verifying your invite link.">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }

  if (inviteError) {
    return (
      <AuthShell title="Invite invalid" subtitle="This invite link could not be verified.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 grid place-items-center">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">{inviteError}</p>
          <Button variant="outline" className="mt-2" onClick={() => nav("/login")}>
            Go to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="You're in! 🎉" subtitle="Your staff account has been created.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="h-16 w-16 rounded-full bg-green-500/10 grid place-items-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-sm text-muted-foreground">
            You've been added to <span className="font-semibold text-foreground">{info?.restaurant_name}</span> as{" "}
            <span className="font-semibold text-foreground capitalize">{info?.role}</span>.
          </p>
          <p className="text-xs text-muted-foreground">Log in with your email and the password you just set.</p>
          <Button variant="hero" className="w-full mt-2" onClick={() => nav("/login")}>
            Go to Login
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept your invite"
      subtitle={`You've been invited to join ${info?.restaurant_name} as ${info?.role}.`}
    >
      <div className="mb-5 flex items-center gap-3 bg-secondary/60 rounded-xl p-3 border border-border">
        <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{info?.restaurant_name}</div>
          <div className="text-xs text-muted-foreground capitalize">{info?.role} · {info?.email}</div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Your email</Label>
          <Input value={info?.email} disabled className="mt-1.5 opacity-70" />
        </div>
        <div>
          <Label>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Amina Yusuf"
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Create a password</Label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Confirm password</Label>
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            required
            className="mt-1.5"
          />
        </div>
        <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : "Accept Invite & Create Account"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default StaffInvite;
