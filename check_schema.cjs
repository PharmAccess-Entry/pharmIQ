const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"?(.*?)\"?\r?\n/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"?(.*?)\"?\r?\n/)[1].trim();
const supabase = createClient(url, key);
supabase.from('restaurants').select('category_order').limit(1).then(console.log).catch(console.error);
