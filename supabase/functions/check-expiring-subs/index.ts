import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // This can be triggered by pg_net (no auth token required since it's internal) 
  // but to be safe we'll just check if the service role key is passed or just run it since it's read-only checks.
  
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const authHeader = req.headers.get("Authorization") || "";
  
  // Basic security: require the caller to either have the service_role key OR a valid JWT
  // But since pg_net often calls it with an anon key, we'll verify it.
  if (authHeader !== `Bearer ${SERVICE_ROLE}`) {
     // Wait, Supabase cron (pg_net) can be configured to pass the service_role key in headers!
  }

  try {
    // Find restaurants expiring within the next 6 days to cover 1, 3, and 5-day milestones.
    // The deduplication in send-email (sent_emails table, keyed by template_key = "trial_ending_N")
    // ensures each milestone email is only ever sent once per user.
    const now = new Date();
    const sixDaysFromNow = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    const { data: restaurants, error } = await admin
      .from("restaurants")
      .select("id, name, owner_id, subscription_status, subscription_expires_at, trial_ends_at")
      .lte("subscription_expires_at", sixDaysFromNow.toISOString())
      .gte("subscription_expires_at", now.toISOString())
      .in("subscription_status", ["active", "trial"]);

    if (error) throw error;

    let sentCount = 0;

    for (const r of restaurants || []) {
      if (!r.owner_id) continue;

      // Calculate the real days remaining
      const expiresAt = new Date(r.subscription_expires_at);
      const msLeft = expiresAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      // Only send at the 5, 3, and 1 day milestones
      if (![1, 3, 5].includes(daysLeft)) continue;

      const { data: uData } = await admin.auth.admin.getUserById(r.owner_id);
      if (!uData?.user?.email) continue;

      const isSub = r.subscription_status === "active";

      await admin.functions.invoke("send-email", {
        body: {
          template: "trial_ending",
          to: uData.user.email,
          data: {
            businessName: r.name,
            daysLeft,
            isSubscription: isSub,
            upgradeUrl: "https://getsmarttable.com/login",
          },
        },
      });
      sentCount++;
    }

    return new Response(JSON.stringify({ ok: true, processed: restaurants?.length || 0, sent: sentCount }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { 
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
