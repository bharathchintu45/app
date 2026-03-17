import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, currency = 'INR', receipt, notes } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ error: 'Razorpay keys not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Razorpay order (amount must be in paise)
    const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // ₹1 = 100 paise
        currency,
        receipt: receipt ?? `tfb_${Date.now()}`,
        notes: notes ?? {},
      }),
    });

    const orderData = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: orderData.error?.description ?? 'Razorpay error' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      razorpay_order_id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      key_id: razorpayKeyId, // Frontend needs this to initialize the SDK
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
