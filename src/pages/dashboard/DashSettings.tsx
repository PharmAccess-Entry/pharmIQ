import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useEffect, useRef, useState } from "react";
import { useRestaurant, initialsFromName, trialDaysLeft } from "@/lib/restaurant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Lock, Users, Trash2, Plus, X, Copy, Link2, Share2, MessageCircle, CreditCard, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNaira } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePushPermission } from "@/lib/usePushPermission";
import imageCompression from "browser-image-compression";
import { useAuth } from "@/lib/auth";

// Pharmacy flat pricing
const MONTHLY_PRICE = 5000;
const ANNUAL_PRICE = MONTHLY_PRICE * 10; // 2 months free

const DashSettings = () => {
  const { theme, toggle } = useTheme();
  const { restaurant, refresh, role } = useRestaurant();
  const { user } = useAuth();
  const { permission, requestPermission, supported } = usePushPermission();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Staff management
  const [staff, setStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">("staff");
  const [addingStaff, setAddingStaff] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removeStaffTarget, setRemoveStaffTarget] = useState<{ id: string; name: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    business_type: "pharmacy" as string,
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
    logo_url: "",
  });

  useEffect(() => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name || "",
      phone: restaurant.phone || "",
      business_type: restaurant.business_type || "pharmacy",
      bank_name: restaurant.bank_name || "",
      bank_account_number: restaurant.bank_account_number || "",
      bank_account_name: restaurant.bank_account_name || "",
      logo_url: restaurant.logo_url || "",
    });
  }, [restaurant]);

  const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const loadStaff = async () => {
    if (!restaurant?.id) return;
    setLoadingStaff(true);
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("restaurant_id", restaurant.id);

    const { data: invites } = await supabase
      .from("staff_invites")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .is("accepted_at", null);

    if (rolesError || !roles) {
      setLoadingStaff(false);
      return;
    }

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.rpc("get_users_by_ids", { user_ids: userIds });

    const combinedRoles = roles.map((role) => {
      const profile = profiles?.find((p: any) => p.id === role.user_id);
      return { ...role, isInvite: false, profile: profile || null };
    });

    const combinedInvites = (invites || []).map((invite) => ({
      id: `invite_${invite.id}`,
      role: invite.role,
      isInvite: true,
      profile: { email: invite.email, full_name: "Pending Invite" },
    }));

    setStaff([...combinedRoles, ...combinedInvites]);
    setLoadingStaff(false);
  };

  useEffect(() => {
    if (restaurant?.id) loadStaff();
  }, [restaurant?.id]);

  const addStaff = async () => {
    if (!newStaffEmail.trim()) return toast.error("Email is required");
    if (newStaffEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      return toast.error("You cannot invite yourself as staff.");
    }
    setAddingStaff(true);

    const { data: existingInvite } = await supabase
      .from("staff_invites")
      .select("id, token")
      .eq("email", newStaffEmail.trim().toLowerCase())
      .eq("restaurant_id", restaurant?.id)
      .is("accepted_at", null)
      .maybeSingle();

    if (existingInvite) {
      setAddingStaff(false);
      const link = `${window.location.origin}/invite?token=${existingInvite.token}`;
      setInviteLink(link);
      setAddStaffOpen(false);
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: inviteError } = await supabase.from("staff_invites").insert({
      restaurant_id: restaurant?.id,
      email: newStaffEmail.trim().toLowerCase(),
      role: newStaffRole,
      token,
      expires_at: expiresAt,
    });

    setAddingStaff(false);
    if (inviteError) return toast.error(inviteError.message);

    const link = `${window.location.origin}/invite?token=${token}`;
    setInviteLink(link);
    setAddStaffOpen(false);
    setNewStaffEmail("");
    loadStaff();
  };

  const removeStaff = async (id: string) => {
    if (id.startsWith("invite_")) {
      const realId = id.replace("invite_", "");
      const { error } = await supabase.from("staff_invites").delete().eq("id", realId);
      if (error) return toast.error(error.message);
      toast.success("Invite revoked");
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Staff removed");
    }
    loadStaff();
  };

  const onLogo = async (file: File | undefined) => {
    if (!file || !restaurant?.id) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    if (file.size > 10 * 1024 * 1024) return toast.error("Image too large (max 10MB).");
    setUploading(true);
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 512,
        useWebWorker: true,
        fileType: "image/webp" as string,
      });
      const newFile = new File([compressedFile], `logo-${Date.now()}.webp`, { type: "image/webp" });
      const path = `${restaurant.id}/${newFile.name}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, newFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      set("logo_url", urlData.publicUrl);
      const { error: saveErr } = await supabase.from("restaurants").update({ logo_url: urlData.publicUrl }).eq("id", restaurant.id);
      if (saveErr) throw saveErr;
      await refresh();
      toast.success("Logo updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!restaurant?.id) return toast.error("Account not ready");
    if (!form.name.trim()) return toast.error("Business name is required");
    if (/<[^>]*>/i.test(form.name)) return toast.error("HTML tags are not allowed");
    if (form.phone && !/^[+\d][\d\s().-]{6,19}$/.test(form.phone)) return toast.error("Enter a valid phone number");

    setSaving(true);
    const { error } = await supabase
      .from("restaurants")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        bank_name: form.bank_name || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_name: form.bank_account_name || null,
        logo_url: form.logo_url || null,
      })
      .eq("id", restaurant.id)
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Settings saved");
  };

  const trialLeft = trialDaysLeft(restaurant?.trial_ends_at ?? null);
  const status = restaurant?.subscription_status ?? "trial";

  const isExpired =
    status === "active" &&
    restaurant?.subscription_expires_at &&
    new Date(restaurant.subscription_expires_at).getTime() < Date.now();

  const statusLabel = isExpired
    ? "Subscription expired"
    : status === "trial"
    ? `Free trial · ${trialLeft} day${trialLeft === 1 ? "" : "s"} left`
    : status === "active" && restaurant?.subscription_expires_at
    ? `Active · Renews ${new Date(restaurant.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : status === "active"
    ? "Active"
    : "No active plan";

  const statusVariant: "default" | "secondary" | "destructive" =
    isExpired ? "destructive" : status === "active" ? "default" : "secondary";

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your pharmacy profile and preferences.</p>
      </div>

      <div className="space-y-5 max-w-2xl pb-32 lg:pb-12">

        {/* ── Logo ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <h2 className="font-display font-semibold text-lg mb-4">Pharmacy logo</h2>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary grid place-items-center overflow-hidden border border-border shrink-0">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display font-bold text-2xl">{initialsFromName(form.name || "P")}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {form.logo_url ? "Replace logo" : "Upload logo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Square PNG/JPG/WebP, max 10MB. Auto-compressed.</p>
            </div>
          </div>
        </div>

        {/* ── Business Profile ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <h2 className="font-display font-semibold text-lg mb-4">Business profile</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Pharmacy / Business name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5" placeholder="e.g. MedPlus Pharmacy" />
            </div>
            <div className="sm:col-span-2">
              <Label>Business type</Label>
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Pharmacy — locked to protect your data and settings.</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Phone / WhatsApp</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1.5" placeholder="+234 801 234 5678" />
            </div>
          </div>
        </div>

        {/* ── Subscription ── */}
        <div id="plan" className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft scroll-mt-20">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-display font-semibold text-lg">Subscription</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-5">
            PharmIQ uses a simple flat-rate plan — one price, all features unlocked.
          </p>

          {/* Pricing cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-border p-5 space-y-1">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly</div>
              <div className="font-display text-3xl font-bold">{formatNaira(MONTHLY_PRICE)}</div>
              <div className="text-xs text-muted-foreground">Billed every 30 days</div>
              <ul className="text-xs text-muted-foreground space-y-1 pt-2">
                <li>✓ Unlimited products & categories</li>
                <li>✓ POS, inventory & shift management</li>
                <li>✓ Staff accounts & roles</li>
                <li>✓ Analytics & daily reports</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 space-y-1 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">BEST VALUE</div>
              <div className="text-xs text-primary font-medium uppercase tracking-wider">Annual</div>
              <div className="font-display text-3xl font-bold text-primary">{formatNaira(ANNUAL_PRICE)}</div>
              <div className="text-xs text-primary/70">Billed once — saves 2 months free</div>
              <ul className="text-xs text-muted-foreground space-y-1 pt-2">
                <li>✓ Everything in Monthly</li>
                <li>✓ Priority support</li>
                <li>✓ Early access to new features</li>
                <li>✓ 2 months completely free</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="hero">
              <Link to="/payment?kind=pharmacy&period=monthly">
                {status === "active" && !isExpired ? "Renew / Extend" : "Subscribe Monthly"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-primary/20 hover:bg-primary/5 text-primary">
              <Link to="/payment?kind=pharmacy&period=annual">Pay Yearly — Save 2 Months</Link>
            </Button>
          </div>
        </div>

        {/* ── Bank Account ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Bank account</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Used to display your account details to customers who choose bank transfer as payment method.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Bank name</Label>
              <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} className="mt-1.5" placeholder="e.g. Zenith Bank" />
            </div>
            <div>
              <Label>Account number</Label>
              <Input value={form.bank_account_number} onChange={(e) => set("bank_account_number", e.target.value)} className="mt-1.5" placeholder="e.g. 1012345678" maxLength={10} />
            </div>
            <div className="sm:col-span-2">
              <Label>Account name</Label>
              <Input value={form.bank_account_name} onChange={(e) => set("bank_account_name", e.target.value)} className="mt-1.5" placeholder="e.g. PharmAccess Pharmacy Ltd" />
            </div>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <h2 className="font-display font-semibold text-lg mb-4">Security</h2>
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              <div className="font-medium text-sm flex items-center gap-1.5">
                <Lock className="h-4 w-4" /> Fingerprint / Face ID
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Register biometric login so you can access your dashboard without typing your password.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                toast.loading("Waiting for biometric...", { id: "passkey-toast" });
                try {
                  const { error } = await supabase.auth.registerPasskey();
                  if (error) throw error;
                  toast.success("Biometric registered!", { id: "passkey-toast" });
                } catch (e: any) {
                  toast.error(e.message || "Failed to register. Use a supported browser/device.", { id: "passkey-toast" });
                }
              }}
            >
              Register
            </Button>
          </div>
        </div>

        {/* ── Notifications ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <h2 className="font-display font-semibold text-lg mb-4">Notifications</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="min-w-0">
                <div className="font-medium text-sm">Browser push notifications</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Get instant alerts for new orders and low stock warnings.
                </div>
              </div>
              {!supported ? (
                <Badge variant="secondary">Unsupported</Badge>
              ) : permission === "granted" ? (
                <Badge className="bg-green-600/10 text-green-600 hover:bg-green-600/20 border-green-600/20">Enabled</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={requestPermission} disabled={permission === "denied"}>
                  {permission === "denied" ? "Blocked in Browser" : "Enable"}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-t border-border/50 pt-4">
              <div className="min-w-0">
                <div className="font-medium text-sm">Sound alerts</div>
                <div className="text-xs text-muted-foreground mt-0.5">Distinct chime plays when a new order arrives.</div>
              </div>
              <Switch defaultChecked={true} disabled={true} />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-t border-border/50 pt-4">
              <div className="min-w-0">
                <div className="font-medium text-sm">WhatsApp alerts <span className="text-muted-foreground text-xs font-normal">(coming soon)</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">Receive WhatsApp messages for new sales and low stock.</div>
              </div>
              <Switch defaultChecked={false} disabled={true} />
            </div>
          </div>
        </div>

        {/* ── Staff Management ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Staff management</h2>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 w-fit" onClick={() => setAddStaffOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Staff
            </Button>
          </div>

          <div className="space-y-2">
            {loadingStaff && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loadingStaff && staff.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 bg-secondary/30 rounded-xl border border-dashed border-border">
                No staff added yet. Click "Add Staff" to invite a team member.
              </p>
            )}
            {!loadingStaff &&
              staff.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 bg-secondary/40 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-sm shrink-0">
                      {(s.profile?.full_name || s.profile?.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{s.profile?.full_name || "Pending signup"}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.profile?.email || "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px] capitalize">{s.role}</Badge>
                    {s.isInvite && (
                      <>
                        <button
                          title="Share invite link"
                          onClick={async () => {
                            const realId = s.id.replace("invite_", "");
                            const { data } = await supabase.from("staff_invites").select("token").eq("id", realId).maybeSingle();
                            const link = data?.token ? `${window.location.origin}/invite?token=${data.token}` : null;
                            if (!link) return toast.error("Could not find invite link");
                            if (navigator.share) {
                              navigator.share({ title: "PharmIQ Staff Invite", text: `You've been invited to join ${restaurant?.name} on PharmIQ.`, url: link });
                            } else {
                              navigator.clipboard.writeText(link);
                              toast.success("Link copied!");
                            }
                          }}
                          className="h-7 w-7 rounded-md bg-secondary text-muted-foreground grid place-items-center hover:bg-primary/10 hover:text-primary transition-all"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Share via WhatsApp"
                          onClick={async () => {
                            const realId = s.id.replace("invite_", "");
                            const { data } = await supabase.from("staff_invites").select("token").eq("id", realId).maybeSingle();
                            const link = data?.token ? `${window.location.origin}/invite?token=${data.token}` : null;
                            if (!link) return toast.error("Could not find invite link");
                            const msg = encodeURIComponent(`You've been invited to join ${restaurant?.name} on PharmIQ. Click to accept: ${link}`);
                            window.open(`https://wa.me/?text=${msg}`, "_blank");
                          }}
                          className="h-7 w-7 rounded-md bg-green-500/10 text-green-600 grid place-items-center hover:bg-green-500 hover:text-white transition-all"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setRemoveStaffTarget({ id: s.id, name: s.profile?.full_name || s.profile?.email || "this staff member" })}
                      className="h-7 w-7 rounded-md bg-destructive/10 text-destructive grid place-items-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ── Dark Mode ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-lg">Dark mode</h2>
            <p className="text-sm text-muted-foreground">Switch the dashboard appearance.</p>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>

        {/* ── Save Bar ── */}
        <div className="flex justify-end gap-2 sticky bottom-20 lg:bottom-4 z-10 bg-background/80 backdrop-blur p-3 -mx-3 rounded-xl">
          <Button variant="ghost" onClick={() => setResetOpen(true)}>Reset</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save changes
          </Button>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>This will revert the form to your currently saved profile. Unsaved changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { refresh(); setResetOpen(false); }}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Staff Invite Link</DialogTitle>
            <DialogDescription>Share this link with your staff member. It expires in 7 days and can only be used once.</DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/60 rounded-xl p-3 flex items-center gap-2 mt-2">
            <code className="text-xs flex-1 break-all text-muted-foreground">{inviteLink}</code>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => { navigator.clipboard.writeText(inviteLink || ""); toast.success("Link copied!"); }}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">The staff member will be prompted to create a password when they open this link.</p>
          <Button variant="hero" className="w-full mt-3" onClick={() => setInviteLink(null)}>Done</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeStaffTarget} onOpenChange={(o) => !o && setRemoveStaffTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {removeStaffTarget?.id.startsWith("invite_") ? "revoke the pending invite for" : "remove"}{" "}
              <strong>{removeStaffTarget?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (removeStaffTarget) { removeStaff(removeStaffTarget.id); setRemoveStaffTarget(null); } }}
            >
              {removeStaffTarget?.id.startsWith("invite_") ? "Revoke Invite" : "Remove Staff"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
            <DialogDescription>Enter their email address. They'll receive a link to join your pharmacy on PharmIQ.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input type="email" placeholder="staff@example.com" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newStaffRole} onValueChange={(v: any) => setNewStaffRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager (Can manage products & reports)</SelectItem>
                  <SelectItem value="staff">Staff (Dispensing & sales only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddStaffOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={addStaff} disabled={addingStaff}>
              {addingStaff ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashSettings;
