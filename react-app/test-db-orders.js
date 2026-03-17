import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
  console.log('Fetching orders...');
  const { data: plans, error: fetchErr } = await supabase
    .from('orders')
    .select('id, customer_name, status, kind, meta, created_at, delivery_date')
    .in('kind', ['personalized', 'subscription'])
    .not('meta->>is_auto_generated', 'eq', 'true')
    .not('status', 'in', '("cancelled", "Cancelled", "removed_by_admin")');

  if (fetchErr) {
    console.error('Error:', fetchErr);
    return;
  }

  console.log(`Found ${plans.length} potential subscription orders.\n`);
  
  const targetDate = new Date();
  const formattedTargetDate = targetDate.toISOString().split('T')[0];
  console.log(`Target processing date (Today UTC): ${formattedTargetDate}\n`);

  for (const plan of plans) {
    console.log(`--- Order: ${plan.id} (${plan.customer_name}) ---`);
    console.log(`Status: ${plan.status}`);
    console.log(`Created At: ${plan.created_at}`);
    console.log(`Delivery Date: ${plan.delivery_date}`);
    console.log(`Meta:`, JSON.stringify(plan.meta, null, 2));

    const startDateStr = plan.meta?.startDate || plan.delivery_date || plan.created_at.split('T')[0];
    const durationDays = plan.meta?.durationDays || 30;
    
    const startMs = new Date(startDateStr).getTime();
    const computedEndMs = startMs + (Math.max(0, durationDays - 1) * 24 * 60 * 60 * 1000);
    const endDateStr = plan.meta?.endDate || new Date(computedEndMs).toISOString().split('T')[0];

    console.log(`Resolved Start Date: ${startDateStr}`);
    console.log(`Duration Days: ${durationDays}`);
    console.log(`Resolved End Date:   ${endDateStr}`);

    if (startDateStr > formattedTargetDate) {
      console.log(`⏭️  SKIPPED: Starts in the future (${startDateStr} > ${formattedTargetDate})`);
    } else if (endDateStr < formattedTargetDate) {
      console.log(`⏭️  SKIPPED: Already expired (${endDateStr} < ${formattedTargetDate})`);
    } else {
      console.log(`✅ MATCH: Active for today!`);
    }
    console.log('');
  }
}

checkDB();
