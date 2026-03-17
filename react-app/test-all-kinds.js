import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  const { data, error } = await supabase.from('orders').select('id, kind, status, meta');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Total Orders: ${data.length}`);
  const kinds = new Set(data.map(d => d.kind));
  console.log('Unique Kinds found:', Array.from(kinds));
  
  const subs = data.filter(d => ['personalized', 'subscription'].includes(d.kind));
  console.log(`Number of Personalized/Subscription rows: ${subs.length}`);
}

checkAll();
