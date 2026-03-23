import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ijnigtjlphdeafstnrxk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@thefitbowls.com',
    password: 'Admin@TFB2024!'
  });
  if (authErr) {
    console.error("Auth failed:", authErr.message);
    // Even if auth fails, we might still be able to query with an anon key if RLS allows
    // But admin queries require auth or service key. Let's try anyway.
  }

  // Note: Since I don't have the service_role key, I'll attempt to fetch them as the logged in user (admin).
  // If the admin doesn't have RLS bypass, it might not fetch all. But admin profiles often have RLS bypass.
  
  const targetDate = "2026-03-23"; // Today
  console.log("Analyzing target date:", targetDate);

  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, user_id, customer_name, schedule, start_date, end_date, status')
    .eq('status', 'active');

  if (subErr) {
    console.error("Sub fetch error:", subErr);
    return;
  }

  console.log(`Found ${subs?.length || 0} total active subscriptions.`);

  for (const sub of subs || []) {
    console.log(`\n=> Subscription: ${sub.customer_name} (ID: ${sub.id})`);
    console.log(`   Start: ${sub.start_date}, End: ${sub.end_date}, Status: ${sub.status}`);
    
    if (targetDate < sub.start_date || targetDate > sub.end_date) {
      console.log(`   [SKIPPED] Target date ${targetDate} is outside of sub bounds.`);
      continue;
    }

    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_date', targetDate)
      .filter('meta->>subscription_id', 'eq', sub.id)
      .filter('meta->>is_auto_generated', 'eq', 'true');

    if (existing && existing.length > 0) {
      console.log(`   [SKIPPED] Already has ${existing.length} generated orders!`);
      continue;
    }

    const schedule = (sub.schedule || []);
    console.log(`   Schedule has ${schedule.length} total entries.`);
    const targetDayName = "Monday"; // 2026-03-23 is Monday
    const dayLines = schedule.filter(l => (l.day === targetDate || l.day === targetDayName) && l.qty > 0);
    
    if (dayLines.length === 0) {
      console.log(`   [SKIPPED] No schedule lines found for ${targetDate} or ${targetDayName}.`);
      const sampleDays = schedule.map(l => l.day).filter(Boolean);
      console.log(`   Available schedule days: [...${new Set(sampleDays).keys()}]`);
      continue;
    }

    console.log(`   [READY] Will generate ${dayLines.length} lines, grouped into slots:`, [...new Set(dayLines.map(l=>l.slot || 'Meal'))]);
  }
}

run();
