import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'missing',
  process.env.VITE_SUPABASE_ANON_KEY || 'missing'
);

async function test() {
  const { data, error } = await supabase.from('daily_deliveries').select('*').limit(2);
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}
test();
