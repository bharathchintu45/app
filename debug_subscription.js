
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/TFB/react-app/.env' });

async function debugSub() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  // We'll search for the specific user from the screenshot/audit
  const userId = '8cc90c42-5f65-4f9e-bc43-bd21f0084537'; // Based on previous audit

  console.log("Checking orders for user:", userId);
  
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .in('kind', ['personalized', 'subscription'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Found", data.length, "total potential subscriptions.");
  data.forEach((o, i) => {
    console.log(`\nOrder #${i+1}: ${o.id}`);
    console.log(`Order Number: ${o.order_number}`);
    console.log(`Status: ${o.status}`);
    console.log(`Kind: ${o.kind}`);
    console.log(`Meta Auto Gen: ${o.meta?.is_auto_generated}`);
    console.log(`Dates: ${o.start_date} to ${o.end_date}`);
    console.log(`Delivery Date: ${o.delivery_date}`);
  });
}

debugSub();
