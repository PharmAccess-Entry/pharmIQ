import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use environment variable in production, fallback to provided token
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "8959478563:AAHKTrDoxZnX8L7gmhsd_cJiQrqRIEnwpu4";
const ALLOWED_ADMIN_ID = 8316379364;
const ADMIN_EMAIL = "lightorbinnovations@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { initData, redirectUrl } = await req.json();
    if (!initData) {
      throw new Error("Missing initData");
    }

    // 1. Parse and verify Telegram initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    // Sort parameters alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    // Calculate HMAC-SHA256 signature
    const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) {
      console.error("Telegram Auth Failed: Hash mismatch");
      return new Response(JSON.stringify({ error: "Invalid Telegram signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate User ID
    const userJson = urlParams.get("user");
    if (!userJson) throw new Error("No user data found in initData");
    
    const user = JSON.parse(userJson);
    if (user.id !== ALLOWED_ADMIN_ID) {
      console.error(`Unauthorized Telegram ID: ${user.id}`);
      return new Response(JSON.stringify({ error: "Unauthorized user ID" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate Magic Link for the Super Admin
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL,
      options: {
        redirectTo: redirectUrl || "https://pharmiq.site/super-admin"
      }
    });

    if (error) {
      throw error;
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      throw new Error("Failed to generate action link");
    }

    return new Response(JSON.stringify({ action_link: actionLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
