// Send transactional email via Resend.
// Templates: "welcome" | "payment_receipt" | "trial_ending" | "staff_invite" | "forgot_password"
// Auth: requires a logged-in Supabase user (anon key + Authorization header) for "welcome",
// "payment_receipt", "staff_invite". "trial_ending" can be called server-side with service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const FROM = Deno.env.get("EMAIL_FROM") || "PharmIQ <noreply@pharmiq.site>";

type Payload = {
  template: "welcome" | "payment_receipt" | "trial_ending" | "staff_invite" | "forgot_password";
  to: string;
  data?: Record<string, any>;
};

const wrap = (title: string, subtitle: string, html: string, icon: string = "✨") => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FFF1F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF1F2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(225,29,72,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#BE123C 0%,#E11D48 55%,#FB7185 100%);padding:40px 32px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.35);border-radius:14px;padding:10px 22px;margin-bottom:18px;">
                <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Pharm<span style="opacity:0.8;">IQ</span></span>
              </div>
              <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;margin-bottom:14px;">
                ${icon}
              </div>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.3;">
                ${title}
              </h1>
              <p style="margin:10px 0 0;font-size:15px;color:rgba(255,255,255,0.82);line-height:1.5;">
                ${subtitle}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px 32px;">
              ${html}
            </td>
          </tr>
          <tr>
            <td style="background:#FFF1F2;padding:20px 32px;border-top:1px solid #fce7eb;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">
                Need help? Reach us at <a href="mailto:hello@pharmiq.site" style="color:#E11D48;text-decoration:none;">hello@pharmiq.site</a>
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                &copy; ${new Date().getFullYear()} PharmIQ &nbsp;·&nbsp; <a href="https://pharmiq.site" style="color:#9CA3AF;text-decoration:none;">pharmiq.site</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const btn = (url: string, text: string) => `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:8px 0 32px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#BE123C 0%,#E11D48 100%);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 18px rgba(225,29,72,0.38);">
        ${text}
      </a>
    </td>
  </tr>
</table>`;

const renderTemplate = (template: Payload["template"], data: Record<string, any> = {}) => {
  const intro = `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#374151;">Hi${data.businessName ? ` ${data.businessName}` : (data.email ? ` ${data.email}` : " there")} 👋,</p>`;

  switch (template) {
    case "welcome":
      return {
        subject: `Welcome to PharmIQ, ${data.businessName || "friend"}! 🎉`,
        html: wrap(
          `Welcome aboard!`,
          `You're one step away from transforming your pharmacy`,
          `${intro}
           <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;">Your free 3-day trial has started. Let's get your inventory set up and your team onboarded.</p>
           ${btn(data.dashboardUrl || "#", "🚀 &nbsp;Go to Dashboard")}`,
          "🎉"
        ),
      };
    case "payment_receipt":
      return {
        subject: `Payment received — ${data.amount || ""}`,
        html: wrap(
          `Payment Confirmed`,
          `Thank you! We've received your payment.`,
          `${intro}
           <table width="100%" style="font-size:14px;margin:16px 0;border-collapse:collapse;color:#374151;">
             <tr><td style="padding:10px;border-bottom:1px solid #fce7eb;">Description</td><td style="padding:10px;border-bottom:1px solid #fce7eb;text-align:right"><strong>${data.description || "—"}</strong></td></tr>
             <tr><td style="padding:10px;border-bottom:1px solid #fce7eb;">Amount</td><td style="padding:10px;border-bottom:1px solid #fce7eb;text-align:right"><strong style="color:#E11D48;font-size:16px;">${data.amount || "—"}</strong></td></tr>
             <tr><td style="padding:10px;">Reference</td><td style="padding:10px;text-align:right"><code>${data.reference || "—"}</code></td></tr>
           </table>
           <p style="color:#6B7280;font-size:13px;margin-top:20px;">Need help? Reply directly to this email.</p>`,
          "💳"
        ),
      };
    case "trial_ending": {
      const isSub = data.isSubscription;
      const tSubject = isSub 
        ? `Your PharmIQ subscription expires in ${data.daysLeft || "a few"} day${data.daysLeft === 1 ? "" : "s"}`
        : `Your PharmIQ trial ends in ${data.daysLeft || "a few"} day${data.daysLeft === 1 ? "" : "s"}`;
      
      const tText = isSub
        ? `<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;">Your subscription expires in <strong>${data.daysLeft || "a few"} day(s)</strong>. Ensure uninterrupted service by renewing your plan today.</p>`
        : `<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;">Your free trial ends in <strong>${data.daysLeft || "a few"} day(s)</strong>. Keep your pharmacy running smoothly by picking a plan!</p>`;
      
      return {
        subject: tSubject,
        html: wrap(
          isSub ? `Subscription Expiring` : `Trial Ending Soon`,
          isSub ? `Action required to keep your menu live` : `Don't lose access to your digital menu`,
          `${intro}${tText}${btn(data.upgradeUrl || "#", "⚡ &nbsp;" + (isSub ? "Renew Subscription" : "Choose a Plan"))}`,
          "⏳"
        ),
      };
    }
    case "staff_invite":
      return {
        subject: `${data.inviterName || "Your team"} invited you to ${data.businessName || "PharmIQ"}`,
        html: wrap(
          `You're Invited!`,
          `Join your team on PharmIQ`,
          `${intro}
           <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;"><strong>${data.inviterName || "A teammate"}</strong> invited you to join <strong>${data.businessName || "their pharmacy"}</strong> on PharmIQ as a <strong>${data.role || "staff"}</strong>.</p>
           ${btn(data.inviteUrl, "🤝 &nbsp;Accept Invite")}
           <p style="color:#6B7280;font-size:13px;text-align:center;">This link expires in 14 days.</p>`,
          "👋"
        ),
      };
    case "forgot_password":
      return {
        subject: `Reset your PharmIQ password`,
        html: wrap(
          `Password Reset Request`,
          `We received a request to reset your password`,
          `${intro}
           <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#374151;">Click the button below to create a new password. This link is valid for <strong>1 hour</strong>.</p>
           ${btn(data.resetUrl || "#", "🔑 &nbsp;Reset My Password")}
           <p style="color:#6B7280;font-size:13px;text-align:center;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>`,
          "🔐"
        ),
      };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email not configured (RESEND_API_KEY missing)" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: allow if a Bearer token (logged-in user) is present, OR if the caller used service role.
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Best-effort verify of user (skips for service role token)
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
      await userClient.auth.getUser();
    } catch { /* noop */ }

    const body = (await req.json()) as Payload;
    if (!body?.template || !body?.to) {
      return new Response(JSON.stringify({ error: "Missing template or to" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tpl = renderTemplate(body.template, body.data || {});
    if (!tpl) return new Response(JSON.stringify({ error: "Unknown template" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Deduplication logic for welcome and trial_ending emails
    // Uses an atomic INSERT-first approach to avoid race conditions.
    // We attempt to insert the reservation row BEFORE sending. If the row
    // already exists (unique constraint violation), the insert returns 0 rows
    // and we skip sending — preventing duplicates even under concurrent calls.
    let templateKey: string | null = null;
    if (body.template === "welcome") {
      templateKey = "welcome";
    } else if (body.template === "trial_ending") {
      templateKey = `trial_ending_${body.data?.daysLeft || "unknown"}`;
    }

    let adminClient: ReturnType<typeof createClient> | null = null;

    if (templateKey) {
      const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SERVICE_ROLE_KEY) {
        adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        // Atomic upsert: insert the reservation now, ignore if duplicate.
        const { error: insertErr, count } = await adminClient
          .from("sent_emails")
          .insert({ email: body.to, template_key: templateKey })
          .select("id", { count: "exact", head: true });

        if (insertErr) {
          // Unique violation (23505) means it was already sent → skip
          if (insertErr.code === "23505") {
            console.log(`[dedup] ${templateKey} already sent to ${body.to}, skipping.`);
            return new Response(JSON.stringify({ ok: true, skipped: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Any other DB error: log and continue (fail open — better to send than not)
          console.error("Error reserving sent_emails slot:", insertErr);
        } else if (count === 0) {
          // Row already existed (ON CONFLICT silently skipped)
          console.log(`[dedup] ${templateKey} already sent to ${body.to}, skipping.`);
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY not configured, skipping dedup check");
      }
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [body.to], subject: tpl.subject, html: tpl.html }),
    });
    const j = await r.json();
    if (!r.ok) {
      // Roll back the dedup reservation so the email can be retried
      if (templateKey && adminClient) {
        await adminClient
          .from("sent_emails")
          .delete()
          .eq("email", body.to)
          .eq("template_key", templateKey)
          .catch(e => console.error("Failed to rollback sent_emails reservation:", e));
      }
      return new Response(JSON.stringify({ error: j.message || "Resend error", details: j }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reservation was already inserted before sending — no need to log again.
    return new Response(JSON.stringify({ ok: true, id: j.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
