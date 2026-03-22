const fs = require('fs');
const envFile = fs.readFileSync('d:\\TFB\\fullstack-app\\.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Invoking generate-daily-orders...');
  const { data, error } = await supabase.functions.invoke('api', {
    headers: { 'x-path': '/v1/generate-daily-orders' },
    body: { targetDate: '2026-03-22' } 
  });
  
  if (error) {
    console.error('Function error:', error);
  } else {
    console.log('Function success:', JSON.stringify(data, null, 2));
  }
}

run();
