const https = require('https');

const projectRef = 'lusbaxesfvicoibnvjcr';
const token = 'SUPABASE_PAT_REMOVED';
const sql = `
  insert into storage.buckets (id, name, public) 
  values ('payment-screenshots', 'payment-screenshots', true) 
  on conflict (id) do nothing;

  -- Just to be safe, drop existing policies if they exist so we can recreate them
  drop policy if exists "Public Access" on storage.objects;
  drop policy if exists "Insert Access" on storage.objects;

  create policy "Public Access" on storage.objects for select using ( bucket_id = 'payment-screenshots' );
  create policy "Insert Access" on storage.objects for insert with check ( bucket_id = 'payment-screenshots' );
`;

const data = JSON.stringify({
  query: sql
});

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/query`, // <-- This endpoint returned 404 earlier!
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(data);
req.end();
