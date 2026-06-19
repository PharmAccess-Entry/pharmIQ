const https = require('https');

const projectRef = 'lusbaxesfvicoibnvjcr';
const token = 'SUPABASE_PAT_REMOVED';
const sql = `
  alter publication supabase_realtime add table public.orders;
  alter publication supabase_realtime add table public.notifications;
  alter publication supabase_realtime add table public.customer_requests;
  alter publication supabase_realtime add table public.order_messages;
`;

const data = JSON.stringify({
  query: sql
});

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/query`,
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
