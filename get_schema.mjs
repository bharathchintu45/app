import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve('react-app', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in react-app/.env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('subscriptions').select('*').limit(1);
  if (error) {
    console.error("Error fetching subscriptions:", error);
  } else {
    console.log("Subscription record structure:");
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]).join('\n'));
    } else {
      console.log("No data found, but table exists.");
    }
  }
}

checkSchema();
