import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// SmtpClient is imported dynamically inside handleWelcomeEmail to prevent boot crashes

/** 
 * UNIFIED API ROUTER (v1) - DASHBOARD COMPATIBLE
 * This function handles all /v1/* requests for the TFB project.
 * Logic is self-contained to allow manual deployment via the Supabase Dashboard.
 */

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://thefitbowls.vercel.app';

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin === 'null' ? '*' : origin,
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

function getISTDate() {
  const d = new Date();
  // Adjust for UTC+5:30
  d.setMinutes(d.getMinutes() + 330);
  return d.toISOString().slice(0, 10);
}

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
    const { SmtpClient } = await import("https://deno.land/x/smtp@v0.7.0/mod.ts");
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
  
  // Use provided date OR default to IST today (not UTC today!)
  const targetDate = body?.targetDate || getISTDate();
  
  // 0. Fetch Dynamic Settings
  const { data: settings } = await admin.from('app_settings').select('key, value');
  const getSetting = (key: string, def: any) => settings?.find(s => s.key === key)?.value ?? def;
  
  const taxPct = Number(getSetting('tax_percentage', 5));
  const gstRate = taxPct / 100;
  const slotMappings = getSetting('slot_mappings', {});
  
  // 1. Fetch all active subscriptions
  const { data: subs, error: subErr } = await admin
    .from('subscriptions')
    .select('id, user_id, customer_name, schedule, delivery_details, start_date, end_date, meta')
    .eq('status', 'active')
    .lte('start_date', targetDate)
    .gte('end_date', targetDate);

  if (subErr) throw subErr;
  
  console.log(`[GEN_ORDERS] Target: ${targetDate}. Found ${subs?.length || 0} active subs. GST: ${taxPct}%`);

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No active subscriptions', created: 0 }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  let createdOrders = 0;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayName = dayNames[new Date(targetDate + 'T12:00:00Z').getDay()];

  for (const sub of subs) {
    console.log(`[GEN_ORDERS] Processing ${sub.customer_name} (${sub.id.slice(0,8)})`);

    // Fetch holds for target date
    const { data: hold } = await admin.from('subscription_holds')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('hold_date', targetDate)
      .maybeSingle();

    if (hold?.is_full_day) {
      console.log(`[GEN_ORDERS] -> Skipped: Full day hold`);
      continue;
    }

    // Filter schedule for target date/day
    const schedule = (sub.schedule || []) as any[];
    const baseDateStr = sub.start_date ? sub.start_date.split('T')[0] : null;

    let dayLines = schedule.filter(l => {
      if (l.qty <= 0) return false;
      if (l.day === targetDate || l.day === targetDayName) return true;
      if (typeof l.day === 'number' && baseDateStr) {
        const d = new Date(baseDateStr + 'T12:00:00Z');
        d.setDate(d.getDate() + (l.day - 1));
        const derivedDateStr = d.toISOString().slice(0, 10);
        return derivedDateStr === targetDate;
      }
      return false;
    });

    // Fetch swaps for target date
    const { data: swaps } = await admin.from('subscription_swaps')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('date', targetDate);

    // Merge Swaps into dayLines (Swaps override OR add new slots)
    if (swaps && swaps.length > 0) {
      dayLines = JSON.parse(JSON.stringify(dayLines)); // Copy to mutate
      for (const swap of swaps) {
        const slot = swap.slot || 'Meal';
        let existingLine = dayLines.find(l => (l.slot || 'Meal') === slot);
        
        const { data: menuItem } = await admin.from('menu_items')
          .select('name, price_inr')
          .eq('id', swap.menu_item_id)
          .maybeSingle();

        if (existingLine) {
          existingLine.itemId = swap.menu_item_id;
          if (menuItem) {
            existingLine.label = menuItem.name;
            existingLine.unitPriceAtOrder = menuItem.price_inr || 0;
          }
        } else {
          dayLines.push({
            itemId: swap.menu_item_id,
            slot: slot,
            qty: 1,
            label: menuItem?.name || "Swapped Item",
            unitPriceAtOrder: menuItem?.price_inr || 0
          });
        }
      }
    }

    if (dayLines.length === 0) {
      console.log(`[GEN_ORDERS] -> Skipped: No schedule for ${targetDate}`);
      continue;
    }

    // Apply partial holds
    if (hold?.slots) {
      dayLines = dayLines.filter(l => !hold.slots[l.slot || 'Meal']);
    }

    if (dayLines.length === 0) {
      console.log(`[GEN_ORDERS] -> Skipped: All slots held.`);
      continue;
    }

    // Ensure prices are current if missing
    const missingPriceIds = [...new Set(dayLines.filter(l => l.itemId && l.unitPriceAtOrder === undefined).map(l => l.itemId))];
    if (missingPriceIds.length > 0) {
      const { data: menuItems } = await admin.from('menu_items').select('id, price_inr').in('id', missingPriceIds);
      if (menuItems) {
        dayLines.forEach(l => {
          const match = menuItems.find(mi => mi.id === l.itemId);
          if (match) l.unitPriceAtOrder = match.price_inr || 0;
        });
      }
    }

    // Group by slot and Create atomically via RPC
    const slots = [...new Set(dayLines.map(l => l.slot || 'Meal'))];
    for (const slot of slots) {
      const slotItems = dayLines.filter(l => (l.slot || 'Meal') === slot);
      const orderNumber = `${sub.meta?.orderNumber || sub.id.slice(-6).toUpperCase()}-${slot}`;
      const syncToken = `sub:${sub.id}:${targetDate}:${slot}`;

      const subtotal = slotItems.reduce((s, i) => s + ((i.unitPriceAtOrder || 0) * (i.qty || 1)), 0);
      const gstAmount = Math.round(subtotal * gstRate);
      const total = subtotal + gstAmount;

      const { data: orderId, error: orderErr } = await admin.rpc('create_subscription_order_v2', {
        p_user_id: sub.user_id,
        p_order_number: orderNumber,
        p_customer_name: sub.customer_name,
        p_delivery_details: sub.delivery_details,
        p_delivery_date: targetDate,
        p_subtotal: subtotal,
        p_gst_amount: gstAmount,
        p_total: total,
        p_sync_token: syncToken,
        p_meta: {
          subscription_id: sub.id,
          is_auto_generated: true,
          slot: slot,
          delivery_otp: Math.floor(1000 + Math.random() * 9000).toString(),
        },
        p_items: slotItems.map(l => ({
          menu_item_id: l.itemId,
          item_name: `[${slotMappings[slot] || slot}] ${l.label}`,
          quantity: l.qty,
          unit_price: l.unitPriceAtOrder || 0
        }))
      });

      if (orderErr) {
        console.error(`[GEN_ORDERS] RPC Error [${orderNumber}]:`, orderErr.message);
        continue;
      }
      
      if (orderId) createdOrders++;
    }
  }

  // 3. Update last run date to prevent redundant triggers
  if (createdOrders > 0) {
    await admin.from('app_settings').upsert({ key: 'auto_order_last_run', value: targetDate });
  }

  return new Response(JSON.stringify({ success: true, message: `Created ${createdOrders} orders`, created: createdOrders }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
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

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !authData.user) {
    console.error("Auth mismatch:", authErr?.message);
    throw new Error(`Unauthorized: ${authErr?.message || 'No user session'}`);
  }
  const user = authData.user;

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
    // 1. Identify child orders for this subscription
    const { data: childOrders } = await admin
      .from('orders')
      .select('id')
      .contains('meta', { subscription_id: subscriptionId });

    if (childOrders && childOrders.length > 0) {
      const childIds = childOrders.map((o: any) => o.id);
      
      // 2. Cleanup delivery assignments first (FKey constraint)
      await admin.from('delivery_assignments').delete().in('order_id', childIds);
      
      // 3. Cleanup order items
      await admin.from('order_items').delete().in('order_id', childIds);
      
      // 4. Delete the orders
      await admin.from('orders').delete().in('id', childIds);
    }

    // 5. Cleanup subscription-specific auxiliary data
    await admin.from('subscription_swaps').delete().eq('subscription_id', subscriptionId);
    await admin.from('subscription_holds').delete().eq('subscription_id', subscriptionId);
    
    // 6. Finally, delete the subscription itself
    const { error } = await admin.from('subscriptions').delete().eq('id', subscriptionId);
    
    if (error) throw error;
    return new Response(JSON.stringify({ success: true, message: 'Subscription and all associated data removed' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
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

async function handleCleanupProofs(req: Request, headers: any) {
  const admin = supabaseAdmin();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // 1. List files in proofs/ folder
  const { data: files, error: listErr } = await admin.storage.from('delivery-proofs').list('proofs', {
    limit: 100,
    sortBy: { column: 'created_at', order: 'asc' },
  });

  if (listErr) throw listErr;
  if (!files || files.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No proofs found to clean.' }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  const toDelete = files
    .filter((f: any) => f.created_at && new Date(f.created_at) < sevenDaysAgo)
    .map((f: any) => `proofs/${f.name}`);

  if (toDelete.length > 0) {
    // 2. Delete from Storage
    const { error: delErr } = await admin.storage.from('delivery-proofs').remove(toDelete);
    if (delErr) console.error("Storage delete error:", delErr);

    // 3. Clear meta in DB (extracted from filenames: orderId_timestamp.jpg)
    for (const fullPath of toDelete) {
      try {
        const fileName = fullPath.split('/')[1];
        const orderId = fileName.split('_')[0];
        
        const { data: order } = await admin.from('orders').select('meta').eq('id', orderId).single();
        if (order?.meta?.proof_image_url) {
           const newMeta = { ...order.meta, proof_image_url: null, proof_archived: true };
           await admin.from('orders').update({ meta: newMeta }).eq('id', orderId);
        }
      } catch (e) {
        console.error("Meta update failed for", fullPath, e);
      }
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    deletedCount: toDelete.length,
    message: `Cleanup complete. ${toDelete.length} older proofs removed.` 
  }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
}

async function handleDebugOrders(req: Request, headers: any) {
  const admin = supabaseAdmin();
  const { data: orders } = await admin.from('orders').select('*').limit(5).order('created_at', { ascending: false });
  return new Response(JSON.stringify({ success: true, recentOrders: orders }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
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
      case '/v1/debug-orders': return await handleDebugOrders(req, headers);
      case '/v1/generate-daily-orders': return await handleGenerateDailyOrders(req, headers);
      case '/v1/subscriptions': return await handleManageSubscriptions(req, headers);
      case '/v1/orders/manage': return await handleOrderAction(req, headers);
      case '/v1/dispatch': return await handleDispatchAction(req, headers);
      case '/v1/cleanup-proofs': return await handleCleanupProofs(req, headers);
      default:
        return new Response(JSON.stringify({ error: `Not Found: ${path}` }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    const errorBody = { error: err.message || err.toString(), stack: err.stack };
    return new Response(JSON.stringify(errorBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
