const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lusbaxesfvicoibnvjcr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1c2JheGVzZnZpY29pYm52amNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjI3NTQ0MSwiZXhwIjoyMDg3ODUxNDQxfQ.ouwvfCjIv7tfOndX4gxE0iV3t89ypm0MlWijr-nmvIM'
);

async function cleanup() {
  const { data: rests, error: rErr } = await supabase.from('restaurants').select('id, owner_id, created_at, table_count, short_code').order('created_at', { ascending: true });
  if (rErr) return console.error(rErr);
  
  const byOwner = {};
  rests.forEach(r => {
    if (!byOwner[r.owner_id]) byOwner[r.owner_id] = [];
    byOwner[r.owner_id].push(r);
  });
  
  for (const owner in byOwner) {
    const list = byOwner[owner];
    if (list.length > 1) {
      // Keep the one with the highest table_count, or the oldest one
      list.sort((a, b) => b.table_count - a.table_count || new Date(a.created_at) - new Date(b.created_at));
      const keep = list[0];
      const toDelete = list.slice(1).map(r => r.id);
      console.log(`Keeping ${keep.id} for owner ${owner}, deleting ${toDelete.length} duplicates`);
      
      for (let i = 0; i < toDelete.length; i += 50) {
        const batch = toDelete.slice(i, i + 50);
        await supabase.from('restaurants').delete().in('id', batch);
      }
    }
  }
  console.log("Cleanup complete!");
}

cleanup();
