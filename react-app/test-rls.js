import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
// We need the service role key to bypass RLS and execute RPC or manage policies
// Since we only have ANON key in React, we'll write a quick function to do a simple fetch to see if it hangs
const key = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  console.log("Fetching profiles as anonymous...");
  fetch(`${url}/rest/v1/profiles?select=*`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  }).then(async r => {
    console.log("Status:", r.status);
    console.log("Body:", await r.text());
  }).catch(e => console.error("Fetch error:", e));
}
check();
