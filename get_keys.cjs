const https = require('https');

const projectRef = 'lusbaxesfvicoibnvjcr';
const token = 'SUPABASE_PAT_REMOVED';

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/api-keys`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log(body);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();
