const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lusbaxesfvicoibnvjcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c2JheGVzZnZpY29pYm52amNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3NTQ0MSwiZXhwIjoyMDg3ODUxNDQxfQ.ouwvfCjIv7tfOndX4gxE0iV3t89ypm0MlWijr-nmvIM' // service role key
);

async function check() {
  const { data: rests, error: rErr } = await supabase.from('restaurants').select('id, name, owner_id');
  if (rErr) console.error(rErr);
  else console.log("Restaurants:", rests);
  
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) console.error(uErr);
  else console.log("Users:", users.users.map(u => ({ id: u.id, email: u.email })));
}

check();
