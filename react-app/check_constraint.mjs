import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ijnigtjlphdeafstnrxk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ'
);

async function check() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conname = 'orders_kind_check'"
  });
  console.log("SQL ERROR?", error);
  console.log("CONSTRAINT DEF:", data);

  // If no execute_sql RPC, let's try direct insert to see
  const { error: insErr } = await supabase.from('orders').insert({
    user_id: 'cf490f18-d7f8-48f6-9fd2-5a6b71994496',
    customer_name: 'test',
    delivery_date: '2026-03-26',
    subtotal: 0,
    gst_amount: 0,
    total: 0,
    payment_status: 'paid',
    status: 'pending',
    kind: 'subscription'
  });
  console.log("INSERT subscription:", insErr);

  const { error: insErr2 } = await supabase.from('orders').insert({
    user_id: 'cf490f18-d7f8-48f6-9fd2-5a6b71994496',
    customer_name: 'test',
    delivery_date: '2026-03-26',
    subtotal: 0,
    gst_amount: 0,
    total: 0,
    payment_status: 'paid',
    status: 'pending',
    kind: 'Subscription'
  });
  console.log("INSERT Subscription:", insErr2);
}
check();
