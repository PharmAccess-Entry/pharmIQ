const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lusbaxesfvicoibnvjcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c2JheGVzZnZpY29pYm52amNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3NTQ0MSwiZXhwIjoyMDg3ODUxNDQxfQ.ouwvfCjIv7tfOndX4gxE0iV3t89ypm0MlWijr-nmvIM' // service role key
);

async function check() {
  const { data, error } = await supabase.rpc('get_policies'); // won't work if not defined
  // Instead, let's query pg_policies directly
  const { data: policies, error: pErr } = await supabase.from('pg_policies').select('*').in('tablename', ['restaurants', 'notifications']);
  if (pErr) console.error(pErr);
  else console.log(policies);
}

check();
