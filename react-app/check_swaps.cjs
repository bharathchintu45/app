const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSwaps() {
  const { data, error } = await supabase.from('subscription_swaps').select('*').limit(5);
  console.log('Error:', error);
  console.log('Data:', data);
}

checkSwaps();
