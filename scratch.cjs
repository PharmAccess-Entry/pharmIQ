const { createClient } = require('C:/Users/PC/Desktop/netlify/SmartTable/node_modules/@supabase/supabase-js/dist/index.js');
const fs = require('fs');

const envFile = fs.readFileSync('C:/Users/PC/Desktop/netlify/SmartTable/.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/"/g, '').replace(/'/g, '').trim();
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: rpc, error: rpcErr } = await supabase.rpc('get_all_restaurants_admin');
  console.log("RPC DATA:", JSON.stringify(rpc, null, 2));
}
check();
