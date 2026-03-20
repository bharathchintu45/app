const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log('=== DEBUG: Auto-Generated Orders ===\n');

  // 1. Check all orders with is_auto_generated flag
  const { data: autoOrders, error: err1 } = await supabase
    .from('orders')
    .select('id, order_number, user_id, kind, status, delivery_date, meta, customer_name')
    .order('created_at', { ascending: false })
    .limit(20);

  if (err1) {
    console.error('Orders fetch error:', err1.message);
  } else {
    console.log(`Total orders fetched (latest 20): ${autoOrders.length}\n`);
    
    const autoGenOrders = autoOrders.filter(o => {
      const meta = typeof o.meta === 'string' ? JSON.parse(o.meta) : o.meta;
      return meta?.is_auto_generated === true;
    });
    
    console.log(`Auto-generated orders: ${autoGenOrders.length}`);
    autoGenOrders.forEach(o => {
      const meta = typeof o.meta === 'string' ? JSON.parse(o.meta) : o.meta;
      console.log(`  - ID: ${o.id.slice(0,8)}... | Order#: ${o.order_number} | User: ${o.user_id?.slice(0,8)}... | Kind: ${o.kind} | Status: ${o.status} | Date: ${o.delivery_date} | SubID: ${meta?.subscription_id?.slice(0,8) || 'N/A'}...`);
    });

    const nonAutoOrders = autoOrders.filter(o => {
      const meta = typeof o.meta === 'string' ? JSON.parse(o.meta) : o.meta;
      return !meta?.is_auto_generated;
    });
    console.log(`\nNon-auto orders: ${nonAutoOrders.length}`);
    nonAutoOrders.forEach(o => {
      console.log(`  - ID: ${o.id.slice(0,8)}... | Order#: ${o.order_number} | User: ${o.user_id?.slice(0,8)}... | Kind: ${o.kind} | Status: ${o.status} | Date: ${o.delivery_date}`);
    });
  }

  // 2. Check subscriptions
  console.log('\n=== Subscriptions ===');
  const { data: subs, error: err2 } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_name, status, start_date, end_date, duration_days')
    .order('created_at', { ascending: false })
    .limit(10);

  if (err2) {
    console.error('Subscriptions fetch error:', err2.message);
  } else {
    console.log(`Total subscriptions: ${subs.length}`);
    subs.forEach(s => {
      console.log(`  - ID: ${s.id.slice(0,8)}... | User: ${s.user_id?.slice(0,8)}... | Plan: ${s.plan_name} | Status: ${s.status} | ${s.start_date} → ${s.end_date} | ${s.duration_days} days`);
    });
  }
}

debug().catch(console.error);
