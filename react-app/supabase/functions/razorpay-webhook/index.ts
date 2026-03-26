import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cryptographically verify Razorpay Webhook Signatures using built-in Deno WebCrypto
async function verifyRazorpaySignature(bodyText: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const hexSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
    
  return hexSignature === signature;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("Missing RAZORPAY_WEBHOOK_SECRET config");
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }

    if (!signature) {
      console.error("Missing X-Razorpay-Signature");
      return new Response("Missing signature", { status: 400, headers: corsHeaders });
    }

    // Razorpay requires verifying the RAW unparsed body string
    const bodyText = await req.text();
    
    const isValid = await verifyRazorpaySignature(bodyText, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid Razorpay Webhook Signature!");
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    // Now it's safe to parse
    const payload = JSON.parse(bodyText);
    
    // We only care about successful payments for now (payment.captured or order.paid)
    // Razorpay sends "payment.captured" when a payment is fully authorized and captured
    if (payload.event !== "payment.captured" && payload.event !== "order.paid") {
      return new Response(`Event ${payload.event} ignored`, { status: 200, headers: corsHeaders });
    }

    const paymentEntity = payload.event === "payment.captured" ? payload.payload.payment.entity : null;
    const orderEntity = payload.event === "order.paid" ? payload.payload.order.entity : null;

    // We need our internal order_number from Razorpay's notes payload to match it against our database
    const orderNumber = paymentEntity?.notes?.order_number || orderEntity?.notes?.order_number;
    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const razorpayPaymentId = paymentEntity?.id;

    if (!orderNumber) {
      console.error(`No internal order_number found in Razorpay notes for PayID: ${razorpayPaymentId}.`);
      // If we don't have the internal order number, we cannot link it reliably.
      return new Response("Missing internal order_number in notes", { status: 400, headers: corsHeaders });
    }

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Verified Webhook for TFB Order: ${orderNumber}. Searching database...`);
    
    // Search `orders` table directly by order_number
    const { data: orderData, error: orderErr } = await supabase
      .from('orders')
      .select('id, payment_status, meta')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderData) {
      console.log(`Found matching Retail Order ${orderData.id}. Marking as Paid.`);
      
      const newMeta = { ...orderData.meta, webhook_verified_at: new Date().toISOString() };
      if (razorpayPaymentId && !newMeta.razorpay_payment_id) newMeta.razorpay_payment_id = razorpayPaymentId;
      if (razorpayOrderId && !newMeta.razorpay_order_id) newMeta.razorpay_order_id = razorpayOrderId;

      await supabase.from('orders').update({
        payment_status: 'paid', // THIS IS THE SECURE VERIFICATION
        status: 'preparing', // Sync with frontend behavior
        meta: newMeta
      }).eq('id', orderData.id);
      
      return new Response("Order successfully verified and marked as paid.", { status: 200, headers: corsHeaders });
    }

    // If not in orders, search `subscriptions` (meta->orderNumber is used in subscriptions, but wait: is order_number a column?)
    // Ah, wait. `subscriptions` DOES NOT have an `order_number` column. It has `meta->>orderNumber`.
    // Let me check my previous replace where I inserted the `subscription`:
    // It creates it with `meta: { orderNumber }`... So I DO need a JSON search for subscriptions!
    
    const { data: subData, error: subErr } = await supabase
      .from('subscriptions')
      .select('id, payment_status, status, meta')
      .contains('meta', { orderNumber: orderNumber }) // Notice it's orderNumber, not order_number!
      .maybeSingle();

    if (subData) {
      console.log(`Found matching Subscription ${subData.id}. Marking as Paid and Active.`);

      const newMeta = { ...subData.meta, webhook_verified_at: new Date().toISOString() };
      if (razorpayPaymentId && !newMeta.razorpay_payment_id) newMeta.razorpay_payment_id = razorpayPaymentId;
      if (razorpayOrderId && !newMeta.razorpay_order_id) newMeta.razorpay_order_id = razorpayOrderId;

      await supabase.from('subscriptions').update({
        payment_status: 'paid', // SECURE VERIFICATION
        status: 'active',       // Change from 'new' to 'active' now that it's paid!
        meta: newMeta
      }).eq('id', subData.id);

      return new Response("Subscription successfully verified and marked as paid.", { status: 200, headers: corsHeaders });
    }

    console.warn(`Webhook processed, but no matching order/subscription found for TFB Order: ${orderNumber}`);
    return new Response("No matching database record found.", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("Webhook processing error:", error.message);
    return new Response(`Error: ${error.message}`, { status: 400, headers: corsHeaders });
  }
});
