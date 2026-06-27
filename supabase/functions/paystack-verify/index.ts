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
    const url = new URL(req.url);
    const reference = url.searchParams.get("reference");
    if (!reference) return new Response(JSON.stringify({ error: "Missing reference" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const j = await r.json();
    if (!j.status || j.data?.status !== "success") {
      return new Response(JSON.stringify({ ok: false, status: j.data?.status || "failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const meta = j.data.metadata || {};
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (meta.kind === "event" && meta.event_id) {
      await admin.from("events").update({
        payment_status: "paid",
        qr_enabled: true,
        paid_at: new Date().toISOString(),
      }).eq("id", meta.event_id);
      await admin.from("restaurants").update({ active_event_id: meta.event_id }).eq("id", meta.restaurant_id);
    } else if ((meta.kind === "restaurant" || meta.kind === "pharmacy") && meta.restaurant_id) {
      const expiresAt = new Date();
      if (meta.period === "annual") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setDate(expiresAt.getDate() + 30); // Monthly approx
      }

      await admin.from("restaurants").update({
        subscription_status: "active",
        subscription_plan: meta.kind === "pharmacy" ? (meta.plan || "Starter") : (meta.tables ? `Dynamic (${meta.tables} Tables)` : "Dynamic"),
        table_count: meta.tables || 10,
        subscription_period: meta.period,
        last_payment_at: new Date().toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
      }).eq("id", meta.restaurant_id);
    }

    // Send receipt
    try {
      const { data: rData } = await admin.from("restaurants").select("owner_id").eq("id", meta.restaurant_id).single();
      if (rData?.owner_id) {
        const { data: uData } = await admin.auth.admin.getUserById(rData.owner_id);
        if (uData?.user?.email) {
          await admin.functions.invoke("send-email", {
            body: {
              template: "payment_receipt",
              to: uData.user.email,
              data: {
                description: meta.kind === "pharmacy" ? "PharmIQ Subscription Setup" : `PharmIQ Subscription (${meta.period})`,
                amount: `NGN ${j.data.amount / 100}`,
                reference: reference
              }
            }
          });
        }
      }
    } catch (emailErr) {
      console.error("Failed to send receipt:", emailErr);
    }

    return new Response(JSON.stringify({ ok: true, kind: meta.kind }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});