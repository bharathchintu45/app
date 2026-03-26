const SUPABASE_URL = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const DEBUG_TOKEN = 'TFB_DEBUG_VERIFY_2026';

async function trigger() {
  console.log("--- TRIGGERING ORDER GENERATION (2026-03-26) ---");
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEBUG_TOKEN}`,
      'x-path': '/v1/generate-daily-orders'
    },
    body: JSON.stringify({ targetDate: '2026-03-26' })
  });
  
  const data = await resp.json();
  console.log("Result:", JSON.stringify(data, null, 2));

  console.log("\n--- CHECKING RECENT ORDERS ---");
  const resp2 = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEBUG_TOKEN}`,
      'x-path': '/v1/debug-orders'
    },
    body: JSON.stringify({})
  });
  const data2 = await resp2.json();
  data2.recentOrders?.forEach(o => {
    console.log(`- Order ${o.order_number} | Customer: ${o.customer_name} | Date: ${o.delivery_date} | Status: ${o.status}`);
  });
}

trigger();
