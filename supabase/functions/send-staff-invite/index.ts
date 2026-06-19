// Creates a staff_invite row + sends the invite email via send-email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, role, appUrl } = await req.json() as { email: string; role: "manager" | "staff"; appUrl: string };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (role !== "manager" && role !== "staff") {
      return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: rest } = await admin.from("restaurants").select("id, name").eq("owner_id", user.id).maybeSingle();
    if (!rest) return new Response(JSON.stringify({ error: "No business found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Generate a random token and set 7-day expiry
    const token = crypto.randomUUID().replace(/-/g, "");
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await admin.from("staff_invites").insert({
      restaurant_id: rest.id,
      email: email.toLowerCase().trim(),
      role,
      token,
      expires_at,
    }).select().single();
    if (error || !invite) return new Response(JSON.stringify({ error: error?.message || "Could not create invite" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/invite/${invite.token}`;

    // Best-effort send (won't fail invite creation if email isn't configured yet)
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({
          template: "staff_invite",
          to: email,
          data: { inviteUrl, businessName: rest.name, inviterName: user.email, role },
        }),
      });
    } catch { /* noop — email may not be configured yet */ }

    return new Response(JSON.stringify({ ok: true, inviteUrl, token: invite.token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
