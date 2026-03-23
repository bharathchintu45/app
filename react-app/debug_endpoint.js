async function test() {
  const res = await fetch('https://ijnigtjlphdeafstnrxk.supabase.co/functions/v1/api', {
    method: 'POST',
    headers: {
      'x-path': '/v1/debug-orders',
      'Content-Type': 'application/json'
    }
  });
  console.log("Status:", res.status);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log("Body:", text);
  }
}
test();
