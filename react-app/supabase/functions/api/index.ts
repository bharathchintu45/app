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
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + offset);
  return istTime.toISOString().split('T')[0];
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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
  if (authErr || !authData.user) throw new Error('Unauthorized');
  
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
  if (!['admin', 'kitchen', 'manager'].includes(profile?.role)) {
    throw new Error('Forbidden: Requires staff privileges');
  }

  const { subscriptionId } = await req.json();
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

// =============================================================================
// handleGenerateDailyOrders — FULL REWRITE (2026-03-26)
//
// KEY DESIGN DECISIONS:
//
// 1. SCHEDULE MATCHING — SINGLE EXACT-DATE RULE:
//    A schedule line fires on targetDate if `line.day` OR `line.date` equals
//    targetDate exactly as a YYYY-MM-DD string. No other fallbacks.
//    - Day-of-week fallback REMOVED  (caused wrong-day matches)
//    - Numeric offset fallback REMOVED (ambiguous, unused in prod data)
//
// 2. FIELD NORMALISATION:
//    Different plan types use itemId / item_id / menuItemId, qty / quantity, etc.
//    All are resolved to canonical names before processing.
//
// 3. is_auto_generated IN META:
//    Always set so the debug script and admin UI can find these orders.
//
// 4. IDEMPOTENCY:
//    sync_token = `sub:{sub_id}:{date}:{slot}` — guaranteed unique per slot/day.
//    The RPC handles unique_violation to avoid duplicate orders on retry.
//
// 5. DB QUERY OPTIMISATION:
//    Subscriptions are filtered at DB level using .lte/.gte on start/end_date
//    instead of filtering in JS after fetching all rows.
// =============================================================================

async function handleGenerateDailyOrders(req: Request, headers: any) {
  // 1. Parse body FIRST (req.json() can only be called once per request)
  let body: any = {};
  if (req.method === 'POST') try { body = await req.json(); } catch (_e) {}

  // 2. Auth: accept service-role key, debug sentinel, or a valid admin session
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!isServiceRole) {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !authData.user) {
      console.error('[GEN_ORDERS] Auth failed:', authErr?.message);
      throw new Error('Unauthorized');
    }
    const admin = supabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
    if (profile?.role !== 'admin') throw new Error('Forbidden');
  }

  const admin = supabaseAdmin();

  // Use caller-provided date OR fall back to IST today
  const targetDate = body?.targetDate || getISTDate();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayName = dayNames[new Date(targetDate + 'T12:00:00Z').getDay()];

  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log(`[GEN_ORDERS] ======================================================`);
  log(`[GEN_ORDERS] Target date : ${targetDate} (${targetDayName})`);
  log(`[GEN_ORDERS] Triggered at: ${new Date().toISOString()}`);

  // 0. Load dynamic settings
  const { data: settings } = await admin.from('app_settings').select('key, value');
  const getSetting = (key: string, def: any) => settings?.find((s: any) => s.key === key)?.value ?? def;
  const taxPct      = Number(getSetting('tax_percentage', 5));
  const gstRate     = taxPct / 100;
  const slotMappings: Record<string, string> = getSetting('slot_mappings', {});

  // 1. Fetch active subscriptions whose date range covers targetDate (DB-level filter)
  const { data: allSubs, error: subErr } = await admin
    .from('subscriptions')
    .select('id, user_id, customer_name, schedule, delivery_details, start_date, end_date, meta, status')
    .eq('status', 'active')
    .lte('start_date', targetDate)
    .gte('end_date',   targetDate);

  if (subErr) {
    log(`[GEN_ORDERS] DB Error fetching subs: ${JSON.stringify(subErr)}`);
    throw subErr;
  }

  log(`[GEN_ORDERS] Active subs in date range: ${allSubs?.length ?? 0}`);

  if (!allSubs || allSubs.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No active subscriptions covering this date', created: 0, logs }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let createdOrders = 0;

  for (const sub of allSubs) {
    log(`[GEN_ORDERS] --------------------------------------------------`);
    log(`[GEN_ORDERS] Processing: ${sub.customer_name} (${sub.id.slice(0, 8)})`);

    // ── A: Full-day hold check ──────────────────────────────────────────────
    const { data: hold } = await admin
      .from('subscription_holds')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('hold_date', targetDate)
      .maybeSingle();

    if (hold?.is_full_day) {
      log(`[GEN_ORDERS]   SKIP: Full-day hold on ${targetDate}`);
      continue;
    }

    // ── B: Schedule matching ────────────────────────────────────────────────
    //
    // THE ONE AND ONLY MATCHING RULE:
    //   A schedule line fires on targetDate if line.day (or line.date) equals
    //   targetDate exactly as a YYYY-MM-DD string.
    //
    //   Previously there were 4 fallback strategies (day-of-week, numeric offset,
    //   etc.) These caused silent wrong-day matches and missed deliveries.
    //   They are all removed here.
    //
    const schedule = (sub.schedule ?? []) as any[];
    log(`[GEN_ORDERS]   Schedule total lines: ${schedule.length}`);

    if (schedule.length > 0) {
      log(`[GEN_ORDERS]   Sample (first 3): ${JSON.stringify(schedule.slice(0, 3))}`);
    }

    let dayLines: any[] = schedule.filter((l: any) => {
      const dateField = l.day ?? l.date ?? null;       // support 'day' or 'date' key
      if (dateField === null)               return false;
      if ((l.qty ?? l.quantity ?? 1) <= 0) return false;
      return dateField === targetDate;                 // exact YYYY-MM-DD match only
    });

    log(`[GEN_ORDERS]   Exact-match lines for ${targetDate}: ${dayLines.length}`);

    if (dayLines.length === 0) {
      const sampleDays = schedule.slice(0, 5).map((l: any) => l.day ?? l.date ?? '?');
      log(`[GEN_ORDERS]   SKIP: No exact match. Sample date fields in schedule: ${JSON.stringify(sampleDays)}`);
      continue;
    }

    // ── C: Normalise field names (handle variations across plan types) ──────
    dayLines = dayLines.map((l: any) => ({
      ...l,
      itemId:           l.itemId   ?? l.item_id   ?? l.menuItemId   ?? null,
      slot:             l.slot     ?? 'Meal',
      qty:              l.qty      ?? l.quantity   ?? 1,
      label:            l.label    ?? l.item_name  ?? l.name         ?? 'Unknown Item',
      unitPriceAtOrder: l.unitPriceAtOrder ?? l.unit_price ?? l.price ?? undefined,
    }));

    // ── D: Apply swaps (item overrides saved for this exact date) ───────────
    const { data: swaps } = await admin
      .from('subscription_swaps')
      .select('*')
      .eq('subscription_id', sub.id)
      .eq('date', targetDate);

    if (swaps && swaps.length > 0) {
      dayLines = JSON.parse(JSON.stringify(dayLines)); // deep copy before mutating
      for (const swap of swaps) {
        const slot = swap.slot || 'Meal';
        const { data: menuItem } = await admin
          .from('menu_items')
          .select('name, price_inr')
          .eq('id', swap.menu_item_id)
          .maybeSingle();

        const existing = dayLines.find((l: any) => l.slot === slot);
        if (existing) {
          existing.itemId           = swap.menu_item_id;
          existing.label            = menuItem?.name      ?? existing.label;
          existing.unitPriceAtOrder = menuItem?.price_inr ?? existing.unitPriceAtOrder;
        } else {
          dayLines.push({
            itemId:           swap.menu_item_id,
            slot,
            qty:              1,
            label:            menuItem?.name      ?? 'Swapped Item',
            unitPriceAtOrder: menuItem?.price_inr ?? 0,
          });
        }
      }
      log(`[GEN_ORDERS]   Applied ${swaps.length} swap(s)`);
    }

    // ── E: Apply partial slot holds ─────────────────────────────────────────
    if (hold?.slots) {
      const before = dayLines.length;
      dayLines = dayLines.filter((l: any) => !hold.slots[l.slot]);
      log(`[GEN_ORDERS]   Partial hold removed ${before - dayLines.length} slot(s)`);
    }

    if (dayLines.length === 0) {
      log(`[GEN_ORDERS]   SKIP: All slots held.`);
      continue;
    }

    // ── F: Batch-fetch missing prices in one query ──────────────────────────
    const missingPriceIds = [...new Set(
      dayLines
        .filter((l: any) => UUID_REGEX.test(l.itemId ?? '') && l.unitPriceAtOrder === undefined)
        .map((l: any) => l.itemId as string)
    )];

    if (missingPriceIds.length > 0) {
      const { data: menuItems } = await admin
        .from('menu_items')
        .select('id, name, price_inr')
        .in('id', missingPriceIds);

      if (menuItems) {
        dayLines.forEach((l: any) => {
          const mi = menuItems.find((m: any) => m.id === l.itemId);
          if (mi) {
            if (l.unitPriceAtOrder === undefined) l.unitPriceAtOrder = mi.price_inr || 0;
            if (!l.label || l.label === 'Unknown Item') l.label = mi.name;
          }
        });
      }
    }

    // ── G: Create one idempotent order per slot via RPC ─────────────────────
    const slots = [...new Set(dayLines.map((l: any) => l.slot as string))];

    for (const slot of slots) {
      const slotItems = dayLines.filter((l: any) => l.slot === slot);
      const syncToken  = `sub:${sub.id}:${targetDate}:${slot}`;

      const subtotal  = slotItems.reduce((s: number, i: any) => s + ((i.unitPriceAtOrder || 0) * (i.qty || 1)), 0);
      const gstAmount = Math.round(subtotal * gstRate);
      const total     = subtotal + gstAmount;

      const p_items = slotItems.map((l: any) => ({
        menu_item_id: UUID_REGEX.test(l.itemId ?? '') ? l.itemId : null,
        item_name:    `[${slotMappings[l.slot] || l.slot}] ${l.label}${!UUID_REGEX.test(l.itemId ?? '') && l.itemId ? ` (${l.itemId})` : ''}`,
        quantity:     l.qty,
        unit_price:   l.unitPriceAtOrder || 0,
      }));

      // Always set is_auto_generated so the debug script and admin UI can find these orders
      const p_meta = {
        ...(sub.meta ?? {}),
        is_auto_generated: true,
        subscription_id:   sub.id,
        generated_at:      new Date().toISOString(),
      };

      log(`[GEN_ORDERS]   → RPC: slot=${slot}, items=${p_items.length}, subtotal=₹${subtotal}, total=₹${total}`);

      const { data: rpcRes, error: rpcErr } = await admin.rpc('create_subscription_order_v2', {
        p_user_id:          sub.user_id,
        p_order_number:     `SUB-${sub.id.slice(0, 4).toUpperCase()}-${targetDate.replace(/-/g, '')}-${slot}`,
        p_customer_name:    sub.customer_name,
        p_delivery_details: sub.delivery_details,
        p_delivery_date:    targetDate,
        p_subtotal:         subtotal,
        p_gst_amount:       gstAmount,
        p_total:            total,
        p_sync_token:       syncToken,
        p_meta:             p_meta,
        p_items:            p_items,
      });

      if (rpcErr) {
        log(`[GEN_ORDERS]   ✗ RPC failed [${syncToken}]: ${rpcErr.message || JSON.stringify(rpcErr)}`);
        continue;
      }

      log(`[GEN_ORDERS]   ✓ Order created — id=${rpcRes}`);
      createdOrders++;
    }
  }

  log(`[GEN_ORDERS] ======================================================`);
  log(`[GEN_ORDERS] Done. Created ${createdOrders} order(s) for ${targetDate}.`);

  return new Response(
    JSON.stringify({ success: true, message: `Created ${createdOrders} orders`, created: createdOrders, logs }),
    { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateCatalog(req: Request, headers: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin' && profile?.role !== 'manager') throw new Error('Forbidden');

  const body = await req.json();
  const { action, itemId, item } = body;

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
    const { newDuration, newEndDate } = data;
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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
  if (authErr || !authData.user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
  if (!['admin', 'kitchen', 'manager'].includes(profile?.role)) {
    throw new Error('Forbidden: Requires staff privileges');
  }

  const body = await req.json();
  const { orderId, action, data } = body;

  if (action === 'solidify') {
    const { subId, dateStr, customer, userId, lines, orderNumber } = data;
    const { data: newOrder, error } = await admin.from('orders').insert({
      order_number: orderNumber,
      user_id: userId,
      customer_name: customer?.receiverName || "Unknown",
      status: 'pending',
      kind: 'personalized',
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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
  if (authErr || !authData.user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
  if (!['admin', 'kitchen', 'manager'].includes(profile?.role)) {
    throw new Error('Forbidden: Requires staff privileges');
  }

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
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing authorization');

  const token = authHeader.replace('Bearer ', '');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: authData, error: authErr } = await supabaseClient.auth.getUser(token);
  if (authErr || !authData.user) throw new Error('Unauthorized');

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', authData.user.id).single();
  if (profile?.role !== 'admin') throw new Error('Forbidden');

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
      case '/v1/cleanup-proofs': return await handleCleanupProofs(req, headers);
      default:
        return new Response(JSON.stringify({ error: `Not Found: ${path}` }), { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    const errorBody = { error: err.message || err.toString(), stack: err.stack };
    return new Response(JSON.stringify(errorBody), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
});
