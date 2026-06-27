import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the bot username provided by the user
const BOT_USERNAME = "PharmIQ_AdminBot";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user using the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { restaurant_id } = await req.json();

    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "Missing restaurant_id" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify that the user has access to this restaurant
    // Try owner
    let hasAccess = false;
    const { data: ownerRes } = await supabase.from('restaurants').select('id').eq('id', restaurant_id).eq('owner_id', user.id).maybeSingle();
    if (ownerRes) {
        hasAccess = true;
    } else {
        // Try staff
        const { data: roleRes } = await supabase.from('user_roles').select('id').eq('restaurant_id', restaurant_id).eq('user_id', user.id).maybeSingle();
        if (roleRes) hasAccess = true;
    }

    if (!hasAccess) {
       return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a secure 32-character random token
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const token = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // Insert into telegram_verification_tokens with 10-min expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    const { error: insertError } = await supabase
      .from('telegram_verification_tokens')
      .insert({
        restaurant_id,
        token,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      throw insertError;
    }

    // Return the deep link
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;

    return new Response(JSON.stringify({ ok: true, deep_link: deepLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Error generating telegram token:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
