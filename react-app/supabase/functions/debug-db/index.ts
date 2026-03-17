import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if(!supabaseUrl || !supabaseKey) { return new Response(JSON.stringify({error: "No env"})); }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: legacySubs } = await supabase.from('subscriptions').select('id, status, kind, created_at, user_id');
    const { data: orderSubs } = await supabase.from('orders').select('id, status, kind, meta, user_id, total').in('kind', ['personalized', 'subscription']);
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name');
    
    return new Response(JSON.stringify({
      legacySubs: legacySubs,
      orderSubs: orderSubs,
      profiles: profiles
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
