
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  const { data: subs, error: subErr } = await supabase.from('subscriptions').select('*');
  console.log('--- SUBSCRIPTIONS ---');
  console.log(JSON.stringify(subs, null, 2));

  const { data: orders, error: ordErr } = await supabase.from('orders').select('*');
  console.log('--- ORDERS ---');
  console.log(JSON.stringify(orders, null, 2));
}

debug();
