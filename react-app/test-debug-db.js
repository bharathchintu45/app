import fs from 'node:fs';

async function check() {
  const url = 'https://ijnigtjlphdeafstnrxk.supabase.co/functions/v1/debug-db';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg1NzYsImV4cCI6MjA4ODQ5NDU3Nn0.QvRpJXtbS8CtoVctipcThItHXgcoS9GZzyXhhDBIh3c';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    fs.writeFileSync('db-dump.json', JSON.stringify(data, null, 2));
    console.log('Saved to db-dump.json');
  } catch(e) {
    console.error(e);
  }
}
check();
