// Quick test to diagnose why the edge function returns non-2xx
const https = require('https');

const url = 'https://ijnigtjlphdeafstnrxk.supabase.co/functions/v1/api';
const anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

const body = JSON.stringify({ targetDate: new Date().toISOString().slice(0, 10) });

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anon_key}`,
    'x-path': '/v1/generate-daily-orders',
  },
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
    console.log(`Body: ${data}`);
  });
});

req.on('error', (e) => console.error('Request error:', e));
req.write(body);
req.end();
