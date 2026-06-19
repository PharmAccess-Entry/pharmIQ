const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"?(.*?)\"?\r?\n/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"?(.*?)\"?\r?\n/)[1].trim();
const supabase = createClient(url, key);

async function test() {
  const { data: res } = await supabase.from('restaurants').select('id, category_order').limit(1).single();
  console.log("Before:", res);
  
  if (res) {
    const { error, status, statusText } = await supabase.from('restaurants').update({ category_order: ['A', 'B', 'C'] }).eq('id', res.id);
    console.log("Update response:", { error, status, statusText });
    
    const { data: res2 } = await supabase.from('restaurants').select('id, category_order').eq('id', res.id).single();
    console.log("After:", res2);
  }
}

test().catch(console.error);
