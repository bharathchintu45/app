import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ijnigtjlphdeafstnrxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@thefitbowls.com',
    password: 'Admin@TFB2024!'
  });
  if (authErr) {
    console.error("Auth Error:", authErr.message);
    return;
  }
  console.log("Logged in!");

  const token = auth.session.access_token;
  const res = await fetch(SUPABASE_URL + '/functions/v1/api', {
    method: 'POST',
    headers: {
      'x-path': '/v1/generate-daily-orders',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ targetDate: '2026-03-24' })
  });
  console.log("Raw status:", res.status);
  console.log("Raw body:", await res.text());
}
test();
