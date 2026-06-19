import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!PAYSTACK_SECRET) {
    return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY is not set on the server." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Supabase internal keys are missing." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { kind, plan, tables, period, eventId, callbackUrl, restaurantId } = body as {
      kind: "restaurant" | "event";
      plan?: string;
      tables?: number;
      period?: "monthly" | "annual";
      eventId?: string;
      callbackUrl: string;
      restaurantId?: string;
    };

    // Strategy 1: direct restaurantId + owner match (most reliable)
    let restaurant: any = null;
    if (restaurantId) {
      const { data: r } = await admin
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (r) restaurant = r;
    }

    // Strategy 2: owner lookup without restaurantId
    if (!restaurant) {
      const { data: rows } = await admin
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .limit(1);
      if (rows && rows.length > 0) restaurant = rows[0];
    }

    // Strategy 3: user_roles fallback (staff/manager)
    if (!restaurant && restaurantId) {
      const { data: roleEntry } = await admin
        .from("user_roles")
        .select("restaurant_id")
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurantId)
        .limit(1)
        .maybeSingle();
      if (roleEntry) {
        const { data: r } = await admin.from("restaurants").select("*").eq("id", restaurantId).maybeSingle();
        if (r) restaurant = r;
      }
    }
    
    if (!restaurant) return new Response(JSON.stringify({ error: "No business found for this account. Please contact support." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let amount = 0;
    let metadata: Record<string, unknown> = { kind, restaurant_id: restaurant.id, user_id: user.id };

    if (kind === "restaurant") {
      const tableCount = Math.max(1, tables || 1);
      const monthly = tableCount * 2000;
      amount = period === "annual" ? monthly * 10 : monthly;
      metadata.tables = tableCount;
      metadata.period = period;
    } else {
      if (!eventId) return new Response(JSON.stringify({ error: "Missing eventId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: ev } = await admin.from("events").select("*").eq("id", eventId).eq("restaurant_id", restaurant.id).maybeSingle();
      if (!ev) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      amount = Number(ev.amount);
      metadata.event_id = eventId;
    }

    const ref = `ST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(amount * 100), // kobo
        reference: ref,
        callback_url: callbackUrl,
        metadata,
      }),
    });
    const j = await r.json();
    if (!j.status) return new Response(JSON.stringify({ error: j.message || "Paystack init failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (kind === "restaurant") {
      await admin.from("restaurants").update({ paystack_reference: ref }).eq("id", restaurant.id);
    } else {
      await admin.from("events").update({ paystack_reference: ref }).eq("id", eventId);
    }

    return new Response(JSON.stringify({ authorization_url: j.data.authorization_url, reference: ref }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});