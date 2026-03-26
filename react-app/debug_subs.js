const SUPABASE_URL = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

async function debug() {
  console.log("--- DEBUGGING SUBSCRIPTIONS ---");
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-path': '/v1/debug-subs'
    },
    body: JSON.stringify({})
  });
  
  const data = await resp.json();
  console.log("Subs found:", data.subs?.length || 0);
  data.subs?.forEach(s => {
    console.log(`- Sub ${s.id.slice(0,8)} | Customer: ${s.customer_name} | Status: ${s.status} | Range: ${s.start_date} to ${s.end_date}`);
    console.log(`  Schedule: ${JSON.stringify(s.schedule)}`);
  });

  console.log("\n--- DEBUGGING ORDERS ---");
  const resp2 = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-path': '/v1/debug-orders'
    },
    body: JSON.stringify({})
  });
  const data2 = await resp2.json();
  console.log("Recent Orders:", data2.recentOrders?.length || 0);
  data2.recentOrders?.forEach(o => {
    console.log(`- Order ${o.order_number} | Kind: ${o.kind} | Status: ${o.status} | Delivery: ${o.delivery_date}`);
  });
}

debug();
