const https = require('https');

const url = 'https://ijnigtjlphdeafstnrxk.supabase.co';

console.log(`Checking connectivity to ${url}...`);

const req = https.get(url, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  process.exit(0);
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.end();
