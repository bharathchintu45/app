const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Invoking edge function...');
  const { data, error } = await supabase.functions.invoke('api', {
    headers: { 'x-path': '/v1/generate-daily-orders' },
    body: { targetDate: new Date().toISOString().slice(0, 10) },
  });

  if (error) {
    console.error('ERROR Object:', error);
    console.error('name:', error.name);
    console.error('message:', error.message);
    if (error.context) {
      console.log('Has context!');
      try {
        const text = await error.context.text();
        console.error('Response text:', text);
      } catch (e) {
        console.error('Could not read context text:', e);
      }
    }
  } else {
    console.log('SUCCESS:', data);
  }
}

test();
