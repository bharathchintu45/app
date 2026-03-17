import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testDelete() {
  const { data: order } = await supabase.from('orders').select('id, kind').eq('kind', 'personalized').limit(1).single();
  
  if (!order) {
    console.log("No orders found.");
    return;
  }
  
  console.log("Found order:", order);
  const { error } = await supabase.from('orders').delete().eq('id', order.id);
  console.log("Delete error:", error);
}

testDelete();
