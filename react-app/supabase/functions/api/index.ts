import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

/** 
 * UNIFIED API ROUTER (v1) - DASHBOARD COMPATIBLE
 * This function handles all /v1/* requests for the TFB project.
 * Logic is self-contained to allow manual deployment via the Supabase Dashboard.
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://thefitbowl.vercel.app';

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  return {
    'Access-Control-Allow-Origin': (origin === ALLOWED_ORIGIN) ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-version, x-path',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

// --- RATE LIMITER (INLINED) ---
const rateStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

function rateLimit(req: Request, config: { windowMs?: number; maxRequests?: number; message?: string } = {}) {
  const { windowMs = 60000, maxRequests = 10, message = "Too many requests. Please try again." } = config;
  const now = Date.now();
  
  // Cleanup
  if (now - lastCleanup > 60000) {
    lastCleanup = now;
    for (const [key, entry] of rateStore) if (now > entry.resetAt) rateStore.delete(key);
  }

  // Key Extraction
  let key = "anon";
  const auth = req.headers.get("authorization");
  if (auth) {
    key = `u:${auth.slice(-16)}`;
  } else {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    key = `ip:${ip.split(",")[0].trim()}`;
  }

  let entry = rateStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateStore.set(key, entry);
  }

  entry.count++;

  const headers = {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, maxRequests - entry.count)),
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Content-Type": "application/json",
  };

  if (entry.count > maxRequests) {
    return new Response(JSON.stringify({ error: message }), { 
      status: 429, 
      headers: { ...headers, "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } 
    });
  }
  return null;
}

// --- UTILS ---
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const supabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// --- HANDLERS ---

async function handleRazorpayOrder(req: Request, headers: any) {
  const body = await req.json();
  const { amount, currency = 'INR', receipt, notes } = body;
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')!;
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!;
  
  const credentials = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: currency.toUpperCase(),
      receipt: receipt ?? `tfb_${Date.now()}`,
      notes: notes ?? {},
    }),
  });

  const orderData = await response.json();
  if (!response.ok) throw new Error(orderData.error?.description ?? 'Razorpay error');

  return new Response(JSON.stringify({
    razorpay_order_id: orderData.id,
    amount: orderData.amount,
    currency: orderData.currency,
    key_id: razorpayKeyId,
  }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function handleManageStaff(req: Request, headers: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden');

  const body = await req.json();
  const { action, email, password, name, role, userId } = body;

  if (action === 'create') {
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });
    if (createError) throw createError;
    await admin.from('profiles').upsert({ id: newUser.user!.id, full_name: name.trim(), email: email.trim().toLowerCase(), role });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'delete') {
    if (userId === user.id) throw new Error('Cannot delete self');
    await admin.auth.admin.deleteUser(userId);
    await admin.from('profiles').delete().eq('id', userId);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'update_role') {
    const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
  
  throw new Error('Unknown action');
}

async function handleWelcomeEmail(req: Request, headers: any) {
  const { subscriptionId } = await req.json();
  const admin = supabaseAdmin();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("id", subscriptionId).single();
  if (!sub) throw new Error("Subscription not found");

  const { data: userData } = await admin.auth.admin.getUserById(sub.user_id);
  const email = userData?.user?.email;
  if (!email) throw new Error("Email not found");

  const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
  const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

  if (SMTP_USERNAME && SMTP_PASSWORD) {
    const client = new SmtpClient();
    await client.connectTLS({ hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com", port: parseInt(Deno.env.get("SMTP_PORT") || "465"), username: SMTP_USERNAME, password: SMTP_PASSWORD });
    await client.send({
      from: SMTP_USERNAME, to: email,
      subject: `Welcome to TFB! Subscription Confirmed`,
      content: `Hi ${sub.customer_name}, your subscription is confirmed!`,
      html: `<h2>Welcome ${escapeHtml(sub.customer_name)}</h2><p>Plan: ${escapeHtml(sub.plan_name)}</p>`
    });
    await client.close();
  }
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function handleGenerateDailyOrders(req: Request, headers: any) {
  const admin = supabaseAdmin();
  let body: any = {};
  if (req.method === 'POST') try { body = await req.json(); } catch(e) {}
  const targetDate = body?.targetDate || new Date().toISOString().slice(0, 10);
  
  // 1. Fetch all active subscriptions
  const { data: subs, error: subErr } = await admin
    .from('subscriptions')
    .select('id, user_id, customer_name, schedule, delivery_details, start_date, end_date, meta')
    .eq('status', 'active')
    .lte('start_date', targetDate)
    .gte('end_date', targetDate);

  if (subErr) throw subErr;
  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No active subscriptions', created: 0 }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  let createdOrders = 0;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayName = dayNames[new Date(targetDate + 'T12:00:00Z').getDay()];

  for (const sub of subs) {
    // Check if order already exists for this sub and date
    const { data: existing } = await admin
      .from('orders')
      .select('id')
      .eq('delivery_date', targetDate)
      .filter('meta->>subscription_id', 'eq', sub.id)
      .filter('meta->>is_auto_generated', 'eq', 'true');

    if (existing && existing.length > 0) continue;

    // Filter schedule for target date/day
    const schedule = (sub.schedule || []) as any[];
    const dayLines = schedule.filter(l => (l.day === targetDate || l.day === targetDayName) && l.qty > 0);
    if (dayLines.length === 0) continue;

    // Group by slot
    const slots = [...new Set(dayLines.map(l => l.slot || 'Meal'))];
    for (const slot of slots) {
      const slotItems = dayLines.filter(l => (l.slot || 'Meal') === slot);
      const orderNumber = `${sub.meta?.orderNumber || sub.id.slice(-6).toUpperCase()}-${slot}`;
      
      const { data: order, error: orderErr } = await admin.from('orders').insert({
        user_id: sub.user_id,
        order_number: orderNumber,
        customer_name: sub.customer_name,
        delivery_details: sub.delivery_details,
        payment_status: 'paid',
        status: 'pending',
        kind: 'personalized',
        delivery_date: targetDate,
        meta: {
          subscription_id: sub.id,
          is_auto_generated: true,
          slot: slot,
          delivery_otp: Math.floor(1000 + Math.random() * 9000).toString(),
        }
      }).select('id').single();

      if (orderErr) continue;

      const items = slotItems.map(l => ({
        order_id: order.id,
        menu_item_id: l.itemId,
        item_name: `[${slot}] ${l.label}`,
        quantity: l.qty,
        unit_price: l.unitPriceAtOrder || 0
      }));

      await admin.from('order_items').insert(items);
      createdOrders++;
    }
  }

  return new Response(JSON.stringify({ success: true, message: `Generated ${createdOrders} orders`, created: createdOrders }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function handleUpdateCatalog(req: Request, headers: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden');

  const body = await req.json();
  const { action, itemId, item, value } = body;

  if (action === 'delete') {
    const { error } = await admin.from('menu_items').delete().eq('id', itemId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Item deleted' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  // Handle upsert (default if item is provided)
  if (item) {
    const updateData: any = { id: item.id };
    const fields = ['category', 'name', 'description', 'image_url', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'price_inr', 'available'];
    fields.forEach(f => {
      if (item[f] !== undefined) updateData[f] = item[f];
    });

    const { error } = await admin.from('menu_items').upsert(updateData);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Item updated' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  throw new Error('Unknown catalog action');
}

async function handleManageSubscriptions(req: Request, headers: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden');

  const body = await req.json();
  const { action, subscriptionId, data } = body;

  if (action === 'manual_add') {
    const { userId, name, duration, startDate, endDate, schedule } = data;
    const { error } = await admin.from('subscriptions').insert({
      user_id: userId,
      customer_name: name,
      plan_name: "Manual Subscription",
      plan_type: "Lunch Only",
      duration_days: duration,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      schedule: schedule,
      delivery_details: { receiverName: name, receiverPhone: "", building: "Deliver at Home", street: "", area: "" },
      targets: { calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 30 },
      meta: { is_manual: true, manual_order_number: `MAN-${Math.floor(Math.random() * 90000) + 10000}` },
      total: 0,
      payment_status: 'paid'
    });
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Subscription created' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'pause' || action === 'resume' || action === 'update_status') {
    const newStatus = action === 'pause' ? 'paused' : (action === 'resume' ? 'active' : data.status);
    const { error } = await admin.from('subscriptions').update({ status: newStatus }).eq('id', subscriptionId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: `Subscription ${newStatus}` }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'add_days') {
    const { days, newDuration, newEndDate } = data;
    const { error } = await admin.from('subscriptions').update({ duration_days: newDuration, end_date: newEndDate }).eq('id', subscriptionId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Days added' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'delete') {
    // Child order cleanup
    const { data: childOrders } = await admin.from('orders').select('id').filter('meta->>subscription_id', 'eq', subscriptionId);
    if (childOrders && childOrders.length > 0) {
      const childIds = childOrders.map((o: any) => o.id);
      await admin.from('order_items').delete().in('order_id', childIds);
      await admin.from('orders').delete().in('id', childIds);
    }
    await admin.from('subscription_swaps').delete().eq('subscription_id', subscriptionId);
    await admin.from('subscription_holds').delete().eq('subscription_id', subscriptionId);
    const { error } = await admin.from('subscriptions').delete().eq('id', subscriptionId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Subscription removed' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  throw new Error('Unknown subscription action');
}

async function handleOrderAction(req: Request, headers: any) {
  const admin = supabaseAdmin();
  const body = await req.json();
  const { orderId, action, data } = body;

  if (action === 'solidify') {
    const { subId, dateStr, customer, userId, lines, orderNumber } = data;
    const { data: newOrder, error } = await admin.from('orders').insert({
      order_number: orderNumber,
      user_id: userId,
      customer_name: customer?.receiverName || "Unknown",
      status: 'pending',
      kind: 'subscription',
      payment_status: 'paid',
      delivery_date: dateStr,
      delivery_details: customer,
      meta: { is_auto_generated: true, subscription_id: subId, orderNumber }
    }).select("id").single();

    if (error) throw error;
    if (lines && lines.length > 0) {
      await admin.from('order_items').insert(
        lines.map((l: any) => ({
          order_id: newOrder.id,
          menu_item_id: l.itemId,
          item_name: l.label,
          quantity: l.qty,
          unit_price: l.unitPriceAtOrder || 0
        }))
      );
    }
    return new Response(JSON.stringify({ success: true, message: 'Order solidified', id: newOrder.id }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'update_status') {
    const { error } = await admin.from("orders").update({ status: data.status }).eq("id", orderId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Status updated' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'update_payment') {
    const { error } = await admin.from("orders").update({ payment_status: data.status }).eq("id", orderId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Payment updated' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  throw new Error('Unknown order action');
}

async function handleDispatchAction(req: Request, headers: any) {
  const admin = supabaseAdmin();
  const body = await req.json();
  const { action, boyId, orderId, data } = body;

  if (action === 'add_boy') {
    const { name, phone, vehicle, profileId } = data;
    const { error } = await admin.from('delivery_boys').insert({
      name, phone, vehicle, profile_id: profileId || null
    });
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Partner added' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'update_boy') {
    const { error } = await admin.from('delivery_boys').update(data).eq('id', boyId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Partner updated' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'remove_boy') {
    await admin.from('delivery_assignments').delete().eq('delivery_boy_id', boyId);
    const { error } = await admin.from('delivery_boys').delete().eq('id', boyId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Partner removed' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  if (action === 'assign_order') {
    const { data: existing } = await admin.from('delivery_assignments').select('id').eq('order_id', orderId).single();
    if (existing) {
      const { error } = await admin.from('delivery_assignments').update({ delivery_boy_id: boyId, status: 'assigned' }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from('delivery_assignments').insert({ order_id: orderId, delivery_boy_id: boyId, status: 'assigned' });
      if (error) throw error;
    }
    return new Response(JSON.stringify({ success: true, message: 'Order assigned' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  throw new Error('Unknown dispatch action');
}

// --- MAIN ROUTER ---

serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  const url = new URL(req.url);
  const path = req.headers.get('x-path') || url.pathname.replace(/\/functions\/v1\/api/, '');
  
  const limitConfig = {
    '/v1/orders': { windowMs: 60000, maxRequests: 5 },
    '/v1/staff': { windowMs: 60000, maxRequests: 10 },
    '/v1/welcome': { windowMs: 60000, maxRequests: 3 },
  }[path] || { windowMs: 60000, maxRequests: 20 };

  const limited = rateLimit(req, limitConfig);
  if (limited) return limited;

  try {
    switch (path) {
      case '/v1/orders': return await handleRazorpayOrder(req, headers);
      case '/v1/staff': return await handleManageStaff(req, headers);
      case '/v1/catalog': return await handleUpdateCatalog(req, headers);
      case '/v1/welcome': return await handleWelcomeEmail(req, headers);
      case '/v1/generate-daily-orders': return await handleGenerateDailyOrders(req, headers);
      case '/v1/subscriptions': return await handleManageSubscriptions(req, headers);
      case '/v1/orders/manage': return await handleOrderAction(req, headers);
      case '/v1/dispatch': return await handleDispatchAction(req, headers);
      default:
        return new Response(JSON.stringify({ error: `Not Found: ${path}` }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
