const fs = require('fs');
const https = require('https');
const path = require('path');

const projectRef = 'lusbaxesfvicoibnvjcr';
const token = 'SUPABASE_PAT_REMOVED';
const sqlFilePath = path.join(__dirname, 'supabase', '00_rls_security.sql');
const sql = fs.readFileSync(sqlFilePath, 'utf8');

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
    'Content-Length': Buffer.byteLength(data)
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
