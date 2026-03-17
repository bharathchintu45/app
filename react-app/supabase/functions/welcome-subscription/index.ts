import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

serve(async (req) => {
  // Handle CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); 

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables! Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { orderId } = await req.json();

    if (!orderId) {
      throw new Error("Missing orderId in request body");
    }

    console.log(`[Welcome Subscription] Fetching details for Order: ${orderId}...`);

    // 1. Fetch the order details
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      throw new Error(`Order not found or fetch error: ${fetchErr?.message}`);
    }

    if (order.kind !== 'personalized') {
      return new Response(JSON.stringify({ message: "Order is not a personalized subscription, skipping email." }), { headers: { "Content-Type": "application/json" } });
    }

    const { delivery_date, customer_name, meta, user_id, order_number } = order;
    
    // Parse Meta
    const durationDays = meta?.durationDays || 0;
    const mealsPerDay = meta?.mealsPerDay || 0;
    const scheduleLines = meta?.scheduleLines || [];

    // Calculate End Date
    const startDate = new Date(delivery_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);
    const endDateString = endDate.toISOString().slice(0, 10);

    // 2. Fetch User Email
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const email = userData?.user?.email || "Unknown Email";

    // 3. Format the Day-by-Day Meal Plan into HTML
    // Group schedule lines by day
    const scheduleByDay = scheduleLines.reduce((acc: any, line: any) => {
      if (!acc[line.day]) acc[line.day] = [];
      acc[line.day].push(line);
      return acc;
    }, {});

    let scheduleHtml = `<div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 16px;">`;
    
    // Output sorted days
    Object.keys(scheduleByDay).sort().forEach(day => {
      scheduleHtml += `<h4 style="margin: 12px 0 4px 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">📅 ${day}</h4>`;
      scheduleHtml += `<ul style="margin: 0 0 16px 0; padding-left: 20px; color: #334155;">`;
      scheduleByDay[day].forEach((item: any) => {
        scheduleHtml += `<li><strong>${item.slot}</strong>: ${item.qty}x ${item.label}</li>`;
      });
      scheduleHtml += `</ul>`;
    });
    scheduleHtml += `</div>`;

    // 4. Construct Email Payload
    const emailSubject = `Welcome to TFB! Your Meal Subscription is Confirmed 🎉`;
    const emailBodyTxt = `
Hi ${customer_name},

Your fresh meal subscription has been successfully scheduled!
Order Reference: #${order_number}

🔹 Starting Date: ${delivery_date}
🔹 Ending Date: ${endDateString}
🔹 Meals per day: ${mealsPerDay}

Thank you for choosing The Fit Bros (TFB)!
    `.trim();

    const emailBodyHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
        <h2 style="color: #047857;">Welcome to TFB, ${customer_name}! 🥗</h2>
        <p>Your personalized fresh meal subscription has been successfully scheduled! Here are your plan details:</p>
        
        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin: 16px 0;">
          <strong>Order Reference:</strong> #${order_number}<br/>
          <strong>Starting Date:</strong> ${delivery_date}<br/>
          <strong>Ending Date:</strong> ${endDateString}<br/>
          <strong>Duration:</strong> ${durationDays} days<br/>
          <strong>Meals Per Day:</strong> ${mealsPerDay}
        </div>

        <h3>Your Custom Menu Schedule</h3>
        ${scheduleHtml}

        <p style="margin-top: 24px;">Thank you for trusting The Fit Bros with your nutrition!</p>
        <p style="color: #475569; font-size: 12px;">The TFB Team</p>
      </div>
    `;

    // --- 📧 SEND EMAIL ---
    const SMTP_HOSTNAME = Deno.env.get("SMTP_HOST") || "smtp.hostinger.com";
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");

    if (SMTP_USERNAME && SMTP_PASSWORD) {
      console.log(`[Welcome Subscription] Connecting to SMTP Server to send email to ${email}...`);
      const client = new SmtpClient();
      await client.connectTLS({
        hostname: SMTP_HOSTNAME,
        port: SMTP_PORT,
        username: SMTP_USERNAME,
        password: SMTP_PASSWORD,
      });

      await client.send({
        from: SMTP_USERNAME,
        to: email,
        subject: emailSubject,
        content: emailBodyTxt,
        html: emailBodyHtml,
      });

      await client.close();
      console.log(`[Welcome Subscription] Email successfully sent to ${email}`);
    } else {
      console.log(`[Welcome Subscription] MOCK EMAIL DISPATCH (Missing SMTP credentials)`);
      console.log(`To: ${email}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`HTML Body Preview:\n${emailBodyTxt}`);
    }

    return new Response(
      JSON.stringify({ 
        message: "Welcome email generated successfully"
        // We do not return the email here to prevent data leakage in case of public invocation
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err: any) {
    console.error("Error in welcome-subscription:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
