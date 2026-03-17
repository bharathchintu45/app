import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ijnigtjlphdeafstnrxk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c'
);

async function check() {
  const targetStr = '2026-03-16';
  console.log('Checking for target:', targetStr);

  // 1. Fetch active subscriptions
  const { data: subscriptions, error: subErr } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'Active');

  if (subErr) {
    console.error('Error fetching subscriptions:', subErr);
    return;
  }
  
  console.log(`Found ${subscriptions?.length || 0} active subscriptions.`);

  for (const sub of subscriptions || []) {
    console.log(`\nSub ${sub.id}: start=${sub.start_date}, end=${sub.end_date}, user=${sub.user_id}`);
    
    if (sub.start_date && sub.start_date > targetStr) {
      console.log('  -> skipped_future_start_date');
      continue;
    }
    if (sub.end_date && sub.end_date < targetStr) {
      console.log('  -> skipped_past_end_date');
      continue;
    }

    // Check existing orders
    const { data: existingOrders, error: extErr } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', sub.user_id)
      .eq('delivery_date', targetStr)
      .eq('kind', 'personalized');

    if (existingOrders && existingOrders.length > 0) {
      console.log(`  -> skipped_already_exists (Order ${existingOrders[0].id})`);
      continue;
    }

    // Check holds
    const { data: holds } = await supabase
      .from('subscription_holds')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('hold_date', targetStr);

    if (holds && holds.length > 0) {
      console.log('  -> skipped_on_hold');
      continue;
    }

    // Check schedule templates
    const targetDt = new Date(targetStr);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDayName = dayNames[targetDt.getDay()]; // March 16 2026 is a Monday. Wait, let's check local vs UTC issue!

    const scheduleLines = sub.meta?.scheduleLines || [];
    const dayLines = scheduleLines.filter((l) => l.day === targetDayName && l.qty > 0);

    if (dayLines.length === 0) {
       console.log(`  -> skipped_no_meals_scheduled_for_day (${targetDayName})`);
       continue; 
    }
    
    console.log('  -> WOULD GENERATE ORDER for items:', dayLines.map(l => l.label).join(', '));
  }
}

check();
