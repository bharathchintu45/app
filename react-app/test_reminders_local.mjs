import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read the connection details from the fullstack-app env file
const envFile = fs.readFileSync('d:\\TFB\\fullstack-app\\.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) envVars[key.trim()] = value.trim();
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in fullstack-app/.env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runTest() {
  const today = new Date();
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + 2);
  const targetDateString = targetDate.toISOString().slice(0, 10);
  
  console.log(`[LOCAL TEST] Checking for subscriptions ending exactly on ${targetDateString}...`);

  const { data: plans, error: fetchErr } = await supabase
    .from("orders")
    .select("id, customer_name, delivery_date, meta, user_id")
    .eq("kind", "personalized")
    .neq("status", "cancelled");

  if (fetchErr) {
    console.error("DB Error:", fetchErr);
    return;
  }

  const endingSoon = [];

  for (const plan of plans || []) {
    const startDateStr = plan.delivery_date;
    const meta = plan.meta || {};
    const durationDays = meta.durationDays;
    
    if (!startDateStr || !durationDays) continue;

    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);
    
    const endDateString = endDate.toISOString().slice(0, 10);

    if (endDateString === targetDateString) {
      const { data: userData } = await supabase.auth.admin.getUserById(plan.user_id);
      const email = userData?.user?.email || "Unknown Email";
      
      endingSoon.push({ orderId: plan.id, customer: plan.customer_name, email, endDate: endDateString });
      
      console.log(`\n--------------------------------------------------`);
      console.log(`✨ FOUND EXPIRING SUBSCRIPTION! ✨`);
      console.log(`--------------------------------------------------`);
      console.log(`[MOCK EMAIL DISPATCH]`);
      console.log(`To: ${email}`);
      console.log(`Subject: Your TFB Subscription ends in 2 days!`);
      console.log(`Body: Hi ${plan.customer_name}, your ${durationDays}-day meal plan is expiring soon on ${endDateString}. Renew now!`);
      console.log(`--------------------------------------------------\n`);
    }
  }

  if (endingSoon.length === 0) {
    console.log(`\nNo subscriptions found ending exactly on ${targetDateString}.`);
    console.log(`\nTo test this properly, you need an order in your DB where (delivery_date + durationDays = ${targetDateString})`);
    console.log(`Run the 'test_subscription_reminder.sql' script in your Supabase SQL Editor to insert a dummy order, then completely rerun this script.`);
  } else {
    console.log(`Successfully simulated sending ${endingSoon.length} reminders!`);
  }
}

runTest();
