import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get a short-lived OAuth2 access token from a Google Service Account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${payload}`;
  
  // Import the private key
  const pemKey = serviceAccount.private_key;
  const pemBody = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  // Exchange JWT for OAuth2 token
  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { restaurantId, title, body, link } = await req.json();

    if (!restaurantId || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: "Firebase not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;
    const accessToken = await getAccessToken(serviceAccount);

    // Fetch all FCM tokens for this restaurant
    const { data: subs, error } = await supabaseClient
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("restaurant_id", restaurantId)
      .not("fcm_token", "is", null);

    if (error) throw error;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    
    // Send to each subscriber
    const results = await Promise.allSettled(
      subs.map(async (row: any) => {
        const message = {
          message: {
            token: row.fcm_token,
            // No top-level `notification` key — FCM would auto-show a notification
            // which duplicates the one shown by onBackgroundMessage in the service worker.
            // All notification content goes in webpush.notification instead.
            data: { link: link || "/dashboard/orders" },
            webpush: {
              headers: {
                Urgency: "high"
              },
              fcm_options: { link: link || "/dashboard/orders" },
              notification: {
                title: title,
                body: body || "",
                icon: "/pwa-192x192.png",
                badge: "/favicon.svg",
                vibrate: [200, 100, 200],
                requireInteraction: false,
              },
            },
          },
        };

        const resp = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (!resp.ok) {
          const errBody = await resp.json();
          // If token is invalid/expired, remove it
          if (errBody?.error?.code === 404 || errBody?.error?.details?.[0]?.errorCode === "UNREGISTERED") {
            await supabaseClient
              .from("push_subscriptions")
              .delete()
              .eq("fcm_token", row.fcm_token);
          }
          throw new Error(`FCM error: ${JSON.stringify(errBody?.error)}`);
        }
        return resp.json();
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    return new Response(
      JSON.stringify({ success: true, sent: successCount, total: subs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
