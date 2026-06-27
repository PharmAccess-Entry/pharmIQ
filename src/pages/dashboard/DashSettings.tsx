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
import { Loader2, Upload, Lock, Users, Trash2, Plus, X, Copy, Link2, Share2, MessageCircle, CreditCard, Building2, WifiOff, Globe, Send, CheckCircle2, XCircle, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNaira } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePushPermission } from "@/lib/usePushPermission";
import imageCompression from "browser-image-compression";
import { useAuth } from "@/lib/auth";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { SUPPORTED_COUNTRIES, symbolForCode } from "@/lib/countryDetect";

// Pharmacy plan definitions (user limits)
const PHARMACY_PLANS: Record<string, { users: number | null; label: string }> = {
  Starter:  { users: 4,    label: "Starter" },
  Growth:   { users: 11,   label: "Growth" },
  Business: { users: null, label: "Business" },
};

function getPlanLimit(plan: string | null | undefined): number | null {
  if (!plan) return 4; // trial defaults to Starter limits
  return PHARMACY_PLANS[plan]?.users ?? 4;
}

const DashSettings = () => {
  const { theme, toggle } = useTheme();
  const { restaurant, refresh, role } = useRestaurant();
  const { user } = useAuth();
  const { permission, requestPermission, supported } = usePushPermission();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isOffline = useOfflineStatus();

  // Staff management
  const [staff, setStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">("staff");
  const [addingStaff, setAddingStaff] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removeStaffTarget, setRemoveStaffTarget] = useState<{ id: string; name: string } | null>(null);

  // Telegram state (SaaS Architecture)
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [connectingTg, setConnectingTg] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [tgConnected, setTgConnected] = useState(false);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [tgConnectedAt, setTgConnectedAt] = useState<string | null>(null);
  const [tgLastNotified, setTgLastNotified] = useState<string | null>(null);
  const [tgPollStatus, setTgPollStatus] = useState<"idle" | "waiting" | "found">("idle");
  const [tgPrefs, setTgPrefs] = useState<Record<string, boolean>>({});
  const [tgReportTime, setTgReportTime] = useState<string>("22:00:00");
  const [showPrefs, setShowPrefs] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);

  // Business locale state
  const [localeForm, setLocaleForm] = useState({ country: "", currency_code: "", currency_symbol: "", timezone: "", language: "" });
  const [savingLocale, setSavingLocale] = useState(false);

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
    setLocaleForm({
      country: restaurant.country || "",
      currency_code: restaurant.currency_code || "",
      currency_symbol: restaurant.currency_symbol || "",
      timezone: restaurant.timezone || "",
      language: restaurant.language || "",
    });
    setTelegramEnabled(restaurant.telegram_enabled || false);
    setTgConnected(!!restaurant.telegram_chat_id);
    setTgUsername(restaurant.telegram_username || null);
    setTgConnectedAt(restaurant.telegram_connected_at || null);
    setTgLastNotified(restaurant.telegram_last_notified_at || null);
    setTgPrefs(restaurant.telegram_notify_prefs || {
      daily_report: true, weekly_report: true, monthly_report: true,
      end_shift: true, low_stock: true, out_of_stock: true,
      reconciliation: true, subscription: true, sync_status: true
    });
    setTgReportTime(restaurant.telegram_report_time || "22:00:00");
  }, [restaurant]);

  const setLocale = (k: keyof typeof localeForm, v: string) => setLocaleForm(p => ({ ...p, [k]: v }));

  const saveLocale = async () => {
    if (!restaurant?.id) return;
    setSavingLocale(true);
    const { error } = await supabase.from("restaurants").update({
      country: localeForm.country,
      currency_code: localeForm.currency_code,
      currency_symbol: localeForm.currency_symbol,
      timezone: localeForm.timezone,
      language: localeForm.language,
    }).eq("id", restaurant.id);
    setSavingLocale(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Business details updated");
  };

  const connectTelegram = async () => {
    setConnectingTg(true);
    setTgPollStatus("idle");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Authentication required");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-connect`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.session.access_token}`
          },
          body: JSON.stringify({ restaurant_id: restaurant?.id })
      });

      const data = await response.json();
      
      if (!response.ok || !data?.ok) throw new Error(data?.error || "Failed to generate connection link");
      
      // Open telegram deep link in new tab
      window.open(data.deep_link, "_blank");
      toast.success("Waiting for you to click Start in Telegram...");
      setTgPollStatus("waiting");
      
      // Poll for completion (3 minutes max)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 90) { // 90 * 2s = 3 mins
          clearInterval(poll);
          setTgPollStatus("idle");
          toast.error("Timed out waiting for Telegram connection. Try again.");
          return;
        }
        const { data: checkData } = await supabase.from("restaurants")
          .select("telegram_chat_id")
          .eq("id", restaurant?.id)
          .maybeSingle();
        
        if (checkData?.telegram_chat_id) {
          clearInterval(poll);
          setTgPollStatus("found");
          await refresh();
          toast.success("Telegram connected successfully!");
        }
      }, 2000);
    } catch (e: any) {
      toast.error(e.message || "Failed to start connection.");
    } finally {
      setConnectingTg(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!restaurant?.id) return;
    const { error } = await supabase.from("restaurants").update({
      telegram_chat_id: null,
      telegram_username: null,
      telegram_connected_at: null,
      telegram_last_notified_at: null,
      telegram_enabled: false
    }).eq("id", restaurant.id);
    if (error) return toast.error(error.message);
    setTgConnected(false);
    setTgUsername(null);
    setTgConnectedAt(null);
    setTgLastNotified(null);
    setTelegramEnabled(false);
    setDisconnectConfirmOpen(false);
    await refresh();
    toast.success("Telegram disconnected");
  };

  const toggleTgPref = async (key: string, checked: boolean) => {
    if (!restaurant?.id) return;
    const newPrefs = { ...tgPrefs, [key]: checked };
    setTgPrefs(newPrefs);
    const { error } = await supabase.from("restaurants").update({ telegram_notify_prefs: newPrefs }).eq("id", restaurant.id);
    if (error) toast.error("Failed to update preferences");
    else await refresh();
  };

  const toggleTelegramEnabled = async (checked: boolean) => {
    if (!restaurant?.id) return;
    setTelegramEnabled(checked);
    const { error } = await supabase.from("restaurants").update({ telegram_enabled: checked }).eq("id", restaurant.id);
    if (error) toast.error("Failed to update status");
    else await refresh();
  };

  const updateTgReportTime = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!restaurant?.id || !val) return;
    setTgReportTime(val + ":00"); // Ensure HH:mm:ss format for PG time
    
    // Auto-detect browser timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { error } = await supabase.from("restaurants").update({ 
      telegram_report_time: val + ":00",
      telegram_report_timezone: tz 
    }).eq("id", restaurant.id);
    
    if (error) toast.error("Failed to save report time");
    else toast.success("Automated report time saved");
  };

  const testTelegram = async () => {
    setTestingTg(true);
    const { error } = await supabase.functions.invoke("telegram-notify", {
      body: { restaurant_id: restaurant?.id, message: "👋 Test notification from PharmIQ!\n\nYour integration is working perfectly." }
    });
    setTestingTg(false);
    if (error) toast.error("Failed to send test notification");
    else toast.success("Test notification sent!");
  };

  const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const loadStaff = async () => {
    if (!restaurant?.id || !navigator.onLine) return;
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

    // Enforce user limit based on current subscription plan
    const planLimit = getPlanLimit(restaurant?.subscription_plan);
    if (planLimit !== null) {
      // Total users = owner (1) + current staff
      const totalUsers = 1 + staff.length;
      if (totalUsers >= planLimit) {
        toast.error(
          `You have reached the maximum number of users for your current plan (${restaurant?.subscription_plan || "Starter"}: ${planLimit} users). Upgrade your plan to add more users.`,
          { duration: 6000 }
        );
        return;
      }
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
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — Settings cannot be updated until you reconnect.</span>
        </div>
      )}
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
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} disabled={isOffline} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading || isOffline} title={isOffline ? "Online only" : undefined}>
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
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1.5" placeholder="e.g. MedPlus Pharmacy" disabled={isOffline} />
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
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="mt-1.5" placeholder="+234 801 234 5678" disabled={isOffline} />
            </div>
          </div>
        </div>

        {/* ── Business Locale & Currency ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Business details</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your country, currency, and locale settings.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Country</Label>
              <Select value={localeForm.country} onValueChange={(v) => {
                const c = SUPPORTED_COUNTRIES.find(x => x.name === v);
                if (c) {
                  setLocale("country", c.name);
                  setLocale("currency_code", c.currency_code);
                  setLocale("currency_symbol", symbolForCode(c.currency_code));
                } else {
                  setLocale("country", v);
                }
              }} disabled={isOffline}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {SUPPORTED_COUNTRIES.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency Symbol</Label>
              <Input value={localeForm.currency_symbol} onChange={(e) => setLocale("currency_symbol", e.target.value)} className="mt-1.5" placeholder="e.g. ₦, $, £" disabled={isOffline} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={saveLocale} disabled={savingLocale || isOffline} size="sm">
              {savingLocale ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save details
            </Button>
          </div>
        </div>


        {/* ── Subscription ── */}
        <div id="plan" className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft scroll-mt-20">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Subscription</h2>
            </div>
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>

          {/* Compact plan info */}
          <div className="bg-secondary/30 rounded-xl border border-border p-4 space-y-3">
            {/* Plan + billing row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{restaurant?.subscription_plan || "Free Trial"}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {restaurant?.subscription_period ? `${restaurant.subscription_period === "annual" ? "Yearly" : "Monthly"} billing` : "Trial period"}
                </div>
              </div>
              {restaurant?.subscription_expires_at && (
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Renews</div>
                  <div className="text-xs font-semibold">
                    {new Date(restaurant.subscription_expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              )}
            </div>

            {/* User count row */}
            <div className="flex items-center justify-between border-t border-border/50 pt-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Users</span>
              </div>
              <div className="text-sm font-semibold">
                {1 + staff.length}
                {getPlanLimit(restaurant?.subscription_plan) !== null && (
                  <span className="text-muted-foreground font-normal"> / {getPlanLimit(restaurant?.subscription_plan)}</span>
                )}
                {getPlanLimit(restaurant?.subscription_plan) === null && (
                  <span className="text-muted-foreground font-normal"> / Unlimited</span>
                )}
              </div>
            </div>

            {/* User limit progress (when not unlimited) */}
            {getPlanLimit(restaurant?.subscription_plan) !== null && (() => {
              const limit = getPlanLimit(restaurant?.subscription_plan)!;
              const current = 1 + staff.length;
              const pct = Math.min(100, Math.round((current / limit) * 100));
              return (
                <div>
                  <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button asChild variant="hero" size="sm">
              <Link to={`/pharmacy/pricing`}>
                {status === "active" && !isExpired ? "Manage / Upgrade" : "Subscribe Now"}
              </Link>
            </Button>
            {status === "active" && !isExpired && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/payment?kind=pharmacy&plan=${restaurant?.subscription_plan || "Starter"}&period=${restaurant?.subscription_period === "annual" ? "annual" : "monthly"}`}>
                  Renew
                </Link>
              </Button>
            )}
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
              <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} className="mt-1.5" placeholder="e.g. Zenith Bank" disabled={isOffline} />
            </div>
            <div>
              <Label>Account number</Label>
              <Input value={form.bank_account_number} onChange={(e) => set("bank_account_number", e.target.value)} className="mt-1.5" placeholder="e.g. 1012345678" maxLength={10} disabled={isOffline} />
            </div>
            <div className="sm:col-span-2">
              <Label>Account name</Label>
              <Input value={form.bank_account_name} onChange={(e) => set("bank_account_name", e.target.value)} className="mt-1.5" placeholder="e.g. PharmAccess Pharmacy Ltd" disabled={isOffline} />
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

        {/* ── Telegram Notifications ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Send className="h-5 w-5 text-[#229ED9]" />
            <h2 className="font-display font-semibold text-lg">Telegram notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Connect a Telegram Bot to receive automated shift summaries, low stock alerts, and daily sales reports.
          </p>
          
          {!tgConnected ? (
            <div className="space-y-4">
              <div className="bg-secondary/40 p-4 rounded-xl border border-border text-sm space-y-2">
                <p className="font-medium">Stay in the loop</p>
                <p className="text-muted-foreground">
                  Connect PharmIQ to Telegram to automatically receive end-of-shift reports, low stock alerts, and daily sales summaries directly to your phone.
                </p>
              </div>
              <Button onClick={connectTelegram} disabled={connectingTg || isOffline} className="w-full sm:w-auto bg-[#229ED9] hover:bg-[#1c84b6] text-white gap-2">
                {connectingTg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Connect Telegram
              </Button>
              
              {tgPollStatus === "waiting" && (
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-600 text-sm animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Waiting for you to click <strong>Start</strong> in Telegram...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary/30 rounded-xl border border-border gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#229ED9]/10 grid place-items-center shrink-0">
                    <Send className="h-5 w-5 text-[#229ED9]" />
                  </div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {tgUsername || "Telegram Account"}
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tgConnectedAt ? `Connected ${new Date(tgConnectedAt).toLocaleDateString()}` : "Connected"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tgLastNotified ? `Last alert: ${new Date(tgLastNotified).toLocaleString()}` : "No alerts sent yet"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" onClick={() => setShowPrefs(!showPrefs)} disabled={isOffline}>
                      Preferences
                   </Button>
                   <Button variant="outline" size="sm" onClick={testTelegram} disabled={testingTg || isOffline}>
                    {testingTg ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setDisconnectConfirmOpen(true)} disabled={isOffline} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    Disconnect
                  </Button>
                </div>
              </div>

              {showPrefs && (
                <div className="bg-secondary/20 rounded-xl border border-border p-4 space-y-4 mt-2 animate-in slide-in-from-top-2">
                   <h3 className="text-sm font-semibold mb-2">Notification Preferences</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {[
                       { key: 'daily_report', label: 'Daily Reports', desc: 'Summary of daily sales and activities' },
                       { key: 'weekly_report', label: 'Weekly Reports', desc: 'Summary of weekly performance' },
                       { key: 'monthly_report', label: 'Monthly Reports', desc: 'Detailed monthly analysis' },
                       { key: 'end_shift', label: 'End of Shift', desc: 'Shift summary when a register is closed' },
                       { key: 'low_stock', label: 'Low Stock Alerts', desc: 'When items fall below reorder level' },
                       { key: 'out_of_stock', label: 'Out of Stock', desc: 'When items reach zero inventory' },
                       { key: 'reconciliation', label: 'Reconciliation', desc: 'Inventory audit variance alerts' },
                       { key: 'sync_status', label: 'Sync Issues', desc: 'Offline sync failure notifications' }
                     ].map(pref => (
                       <div key={pref.key} className="flex items-start justify-between gap-3">
                         <div className="min-w-0">
                            <div className="font-medium text-sm">{pref.label}</div>
                            <div className="text-[10px] text-muted-foreground">{pref.desc}</div>
                         </div>
                         <Switch checked={tgPrefs[pref.key] ?? true} onCheckedChange={(c) => toggleTgPref(pref.key, c)} disabled={isOffline} />
                       </div>
                     ))}
                   </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 py-3 border-t border-border/50">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Automated Report Time</div>
                  <div className="text-xs text-muted-foreground mt-0.5">When should daily/weekly summaries be sent? (Browser timezone will be used)</div>
                </div>
                <div className="w-32 shrink-0">
                  <Select 
                    value={tgReportTime.substring(0, 2)} 
                    onValueChange={(val) => {
                      const pseudoEvent = { target: { value: `${val}:00` } } as any;
                      updateTgReportTime(pseudoEvent);
                    }}
                    disabled={isOffline || !telegramEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({ length: 24 }).map((_, i) => {
                        const hr = i.toString().padStart(2, '0');
                        const ampm = i < 12 ? 'AM' : 'PM';
                        const displayHr = i === 0 ? 12 : i > 12 ? i - 12 : i;
                        return (
                          <SelectItem key={hr} value={hr}>
                            {displayHr}:00 {ampm}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 py-2 border-t border-border/50 pt-4">
                <div className="min-w-0">
                  <div className="font-medium text-sm">Master Toggle</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Enable or disable all Telegram alerts temporarily.</div>
                </div>
                <Switch checked={telegramEnabled} onCheckedChange={toggleTelegramEnabled} disabled={isOffline} />
              </div>
            </div>
          )}
        </div>

        {/* ── Staff Management ── */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-soft">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Staff management</h2>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 w-fit" onClick={() => setAddStaffOpen(true)} disabled={isOffline} title={isOffline ? "Online only" : undefined}>
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
          <Button variant="ghost" onClick={() => setResetOpen(true)} disabled={isOffline}>Reset</Button>
          <Button variant="hero" onClick={save} disabled={saving || isOffline} title={isOffline ? "Online only" : undefined}>
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

      <AlertDialog open={disconnectConfirmOpen} onOpenChange={setDisconnectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Telegram?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to disconnect? You will no longer receive automated reports or alerts until you connect again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disconnectTelegram} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disconnect</AlertDialogAction>
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
