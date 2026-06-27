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

    const { restaurant_id, message, event_type } = await req.json();

    if (!restaurant_id || !message) {
      return new Response(JSON.stringify({ error: "Missing restaurant_id or message" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch restaurant telegram details
    const { data: restaurant, error } = await supabase
      .from('restaurants')
      .select('telegram_chat_id, telegram_enabled, telegram_notify_prefs')
      .eq('id', restaurant_id)
      .single();

    if (error || !restaurant) {
      return new Response(JSON.stringify({ error: "Restaurant not found" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!restaurant.telegram_enabled || !restaurant.telegram_chat_id) {
      return new Response(JSON.stringify({ error: "Telegram is not configured or enabled for this restaurant" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check preferences if an event_type was provided
    if (event_type && restaurant.telegram_notify_prefs) {
        const prefs = restaurant.telegram_notify_prefs as Record<string, boolean>;
        // If the pref exists and is strictly false, do not send
        if (prefs[event_type] === false) {
             return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Preference disabled" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    // Use global bot token
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || "8959478563:AAHKTrDoxZnX8L7gmhsd_cJiQrqRIEnwpu4";

    // Send the message
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: restaurant.telegram_chat_id,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const telegramData = await telegramRes.json();

    if (!telegramData.ok) {
      console.error("Telegram API Error:", telegramData);
      return new Response(JSON.stringify({ error: "Failed to send message to Telegram", details: telegramData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update last notified timestamp
    await supabase.from('restaurants').update({ telegram_last_notified_at: new Date().toISOString() }).eq('id', restaurant_id);

    return new Response(JSON.stringify({ ok: true, messageId: telegramData.result.message_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error sending telegram notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
