import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const ResetPassword = () => {
  const nav = useNavigate();
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await updatePassword(pw);
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Password updated — please log in.");
    nav("/login");
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember.">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>New password</Label><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required className="mt-1.5" /></div>
        <div><Label>Confirm password</Label><PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className="mt-1.5" /></div>
        <Button type="submit" variant="hero" className="w-full" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthShell>
  );
};
export default ResetPassword;
