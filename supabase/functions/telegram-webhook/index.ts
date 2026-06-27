import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Global bot token from environment
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8959478563:AAHKTrDoxZnX8L7gmhsd_cJiQrqRIEnwpu4";
    
    // Verify Webhook Secret (optional but recommended for security)
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
    // If you configure a secret on setWebhook, verify it here.
    // e.g., if (secretToken !== Deno.env.get('TELEGRAM_WEBHOOK_SECRET')) return Response("Unauthorized", { status: 401 });

    const payload = await req.json();
    
    if (!payload.message || !payload.message.text) {
      return new Response("OK");
    }

    const { text, chat, from } = payload.message;

    // Check if the message is /start <token>
    if (text.startsWith('/start ')) {
      const chatId = chat.id;
      const username = from.username ? `@${from.username}` : from.first_name;
      const secureToken = text.split(' ')[1];

      if (secureToken) {
        // 1. Look up token in DB
        const { data: tokenRecord, error: tokenError } = await supabase
          .from('telegram_verification_tokens')
          .select('id, restaurant_id, expires_at, used_at')
          .eq('token', secureToken)
          .maybeSingle();

        if (tokenError) throw tokenError;

        if (!tokenRecord) {
            await sendTelegramMessage(botToken, chatId, "❌ Invalid connection link. Please try connecting again from your PharmIQ dashboard.");
            return new Response("OK");
        }

        // 2. Validate token
        if (tokenRecord.used_at) {
            await sendTelegramMessage(botToken, chatId, "❌ This link has already been used. Please generate a new one from your PharmIQ dashboard.");
            return new Response("OK");
        }

        if (new Date(tokenRecord.expires_at) < new Date()) {
            await sendTelegramMessage(botToken, chatId, "❌ This connection link has expired. Please generate a new one from your PharmIQ dashboard.");
            return new Response("OK");
        }

        // 3. Mark token as used
        await supabase
            .from('telegram_verification_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', tokenRecord.id);

        // 4. Update the restaurant record with the chat details
        const { error: updateError } = await supabase
            .from('restaurants')
            .update({
                telegram_chat_id: chatId.toString(),
                telegram_username: username,
                telegram_connected_at: new Date().toISOString(),
                telegram_enabled: true
            })
            .eq('id', tokenRecord.restaurant_id);

        if (updateError) throw updateError;

        // 5. Send success message
        await sendTelegramMessage(botToken, chatId, "🎉 <b>PharmIQ Connected Successfully!</b>\n\nYou will now receive automated alerts, shift summaries, and stock reports directly in this chat.\n\nYou can manage your notification preferences from your PharmIQ dashboard.");
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
    });
}
