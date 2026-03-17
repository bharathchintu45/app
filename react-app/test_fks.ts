import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkFKs() {
  const { data, error } = await supabase.rpc('get_foreign_keys');
  if (error) {
    console.error("RPC Error (might not exist):", error.message);
  } else {
    console.log(data);
  }
}

checkFKs();
