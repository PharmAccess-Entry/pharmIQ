import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, restaurant_id } = await req.json();

    if (!token || !restaurant_id) {
      return new Response(JSON.stringify({ error: "Missing token or restaurant_id" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify token with Telegram
    const verifyRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const verifyData = await verifyRes.json();

    if (!verifyData.ok) {
      return new Response(JSON.stringify({ error: "Invalid Telegram bot token" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const botName = verifyData.result.first_name + (verifyData.result.username ? ` (@${verifyData.result.username})` : '');

    // Setup Webhook
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        secret_token: restaurant_id.replace(/-/g, '') // Telegram requires secret_token to contain only A-Z, a-z, 0-9, _ and -
      })
    });
    const webhookData = await webhookRes.json();

    if (!webhookData.ok) {
      console.error("Failed to set webhook:", webhookData);
      return new Response(JSON.stringify({ error: "Failed to set Telegram webhook" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save token and bot name to restaurant
    const { error: updateError } = await supabase
      .from('restaurants')
      .update({
        telegram_bot_token: token,
        telegram_bot_name: botName,
        telegram_enabled: true
      })
      .eq('id', restaurant_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ ok: true, botName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error setting up telegram bot:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
