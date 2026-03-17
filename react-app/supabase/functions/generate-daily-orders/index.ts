import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env vars.");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine target date (default to today in IST)
    let body: any = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch(e) {} }

    let targetStr = body?.targetDate;
    if (!targetStr) {
      const dt = new Date();
      dt.setHours(dt.getHours() + 5);
      dt.setMinutes(dt.getMinutes() + 30);
      targetStr = dt.toISOString().slice(0, 10);
    }

    console.log(`[generate-daily-orders] Target date: ${targetStr}`);

    // 1. Fetch active subscriptions from the DEDICATED subscriptions table
    //    Simple .eq("status","active") + date range — no complex filtering
    const { data: activeSubscriptions, error: subErr } = await supabase
      .from('subscriptions')
      .select('id, user_id, customer_name, plan_name, duration_days, start_date, end_date, status, schedule, delivery_details, targets')
      .eq('status', 'active')       // only genuinely active subscriptions
      .lte('start_date', targetStr)  // subscription has started
      .gte('end_date', targetStr);   // subscription has not ended

    if (subErr) {
      console.error("[generate] subscriptions fetch error:", subErr);
      throw subErr;
    }

    console.log(`[generate] Active subscriptions found: ${activeSubscriptions?.length || 0}`);

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No active subscriptions found.", targetDate: targetStr }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDt = new Date(targetStr);
    const targetDayName = dayNames[targetDt.getDay()];

    const results = [];

    // 2. Iterate over each active subscription and generate daily delivery orders
    for (const sub of activeSubscriptions) {

      // Skip if a delivery order already exists for this subscription + date
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('delivery_date', targetStr)
        .filter('meta->>subscription_id', 'eq', sub.id);

      if (existingOrders && existingOrders.length > 0) {
        results.push({ subscriptionId: sub.id, status: "skipped_already_exists" });
        continue;
      }

      // Skip if the user has a hold/pause for this date
      const { data: holds } = await supabase
        .from('subscription_holds')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('hold_date', targetStr);

      if (holds && holds.length > 0) {
        results.push({ subscriptionId: sub.id, status: "skipped_on_hold" });
        continue;
      }

      // Find schedule lines for today
      // schedule is a JSONB array: [{day: "2026-03-16", slot: "Breakfast", itemId, label, qty}]
      const scheduleLines: any[] = sub.schedule || [];
      const dayLines = scheduleLines.filter((l: any) =>
        (l.day === targetStr || l.day === targetDayName) && l.qty > 0
      );

      if (dayLines.length === 0) {
        results.push({ subscriptionId: sub.id, status: "skipped_no_meals_scheduled", targetStr, targetDayName });
        continue;
      }

      // Fetch any meal swaps for this subscription on this date
      const { data: swaps } = await supabase
        .from('subscription_swaps').select('*').eq('subscription_id', sub.id).eq('date', targetStr);

      const swapItemIds = swaps?.map((s: any) => s.menu_item_id) || [];
      let swapMenuItems: any[] = [];
      if (swapItemIds.length > 0) {
        const { data: fetchedItems } = await supabase.from('menu_items').select('id, name, price').in('id', swapItemIds);
        swapMenuItems = fetchedItems || [];
      }

      // Resolve order items for today (applying swaps if they exist)
      const orderItemsPayload = dayLines.map((line: any) => {
        const slotPrefix = line.slot ? `[${line.slot}] ` : '';
        const swap = swaps?.find((s: any) => s.slot === line.slot);
        if (swap) {
          const menuItem = swapMenuItems.find((m: any) => m.id === swap.menu_item_id);
          return {
            menu_item_id: swap.menu_item_id,
            item_name: `${slotPrefix}${menuItem?.name || 'Swapped Item'}`,
            quantity: line.qty,
            unit_price: menuItem?.price || line.unitPriceAtOrder || 0
          };
        }
        return {
          menu_item_id: line.itemId,
          item_name: `${slotPrefix}${line.label}`,
          quantity: line.qty,
          unit_price: line.unitPriceAtOrder || 0
        };
      });

      // Create the daily delivery order in the orders table
      const orderNumber = `SUB-${Math.floor(Math.random() * 900000) + 100000}`;
      const deliveryDetails = sub.delivery_details || {
        receiverName: sub.customer_name || "Subscription Customer",
        receiverPhone: ""
      };

      const { data: insertedOrder, error: insOrdErr } = await supabase
        .from('orders')
        .insert({
          user_id: sub.user_id,
          order_number: orderNumber,
          customer_name: sub.customer_name || deliveryDetails.receiverName,
          delivery_details: deliveryDetails,
          payment_status: "paid",
          subtotal: 0,
          total: 0,
          gst_amount: 0,
          kind: "personalized",
          status: "pending",
          delivery_date: targetStr,
          meta: {
            subscription_id: sub.id,    // links back to subscriptions table
            is_auto_generated: true,
            generated_at: new Date().toISOString(),
          }
        })
        .select('id')
        .single();

      if (insOrdErr || !insertedOrder) {
        console.error(`Failed to create order for sub ${sub.id}:`, insOrdErr);
        results.push({ subscriptionId: sub.id, status: "error_creating_order", error: insOrdErr?.message });
        continue;
      }

      const itemsToInsert = orderItemsPayload.map((item: any) => ({ order_id: insertedOrder.id, ...item }));
      const { error: insItemsErr } = await supabase.from('order_items').insert(itemsToInsert);

      if (insItemsErr) {
        console.error(`Failed to insert items for order ${insertedOrder.id}:`, insItemsErr);
        results.push({ subscriptionId: sub.id, orderId: insertedOrder.id, status: "partial_error_items_failed" });
      } else {
        results.push({ subscriptionId: sub.id, orderId: insertedOrder.id, status: "success", items: itemsToInsert.length });
      }
    }

    return new Response(JSON.stringify({
      message: "Daily orders generation complete",
      targetDate: targetStr,
      results
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err: any) {
    console.error("Critical error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
