import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Uses service role to access all orders & auth

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables! Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date and the date exactly 2 days from now
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + 2);
    
    const targetDateString = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

    console.log(`[Subscription Reminders] Checking for subscriptions ending on ${targetDateString}...`);

    // 1. Fetch all active personalized subscriptions
    const { data: plans, error: fetchErr } = await supabase
      .from("subscriptions")
      .select("id, customer_name, start_date, end_date, duration_days, user_id")
      .eq("status", "active");

    if (fetchErr) throw fetchErr;

    const endingSoon = [];

    // 2. Identify which ones end exactly on the target date
    for (const plan of plans || []) {
      const endDateString = plan.end_date;
      const durationDays = plan.duration_days;
      
      if (!endDateString || !durationDays) continue;

      // 3. If the plan ends exactly 2 days from now, we send the reminder
      if (endDateString === targetDateString) {
        
        // Fetch user email via Supabase Admin Auth API
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(plan.user_id);
        const email = userData?.user?.email || "Unknown Email";
        
        endingSoon.push({
          orderId: plan.id,
          customer: plan.customer_name,
          email,
          endDate: endDateString
        });
        
        // --- 📧 SEND EMAIL/SMS ---
        const SMTP_HOSTNAME = Deno.env.get("SMTP_HOST") || "smtp.hostinger.com";
        const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
        const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
        const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
        
        const emailSubject = `Your TFB Subscription ends in 2 days!`;
        const emailBodyTxt = `Hi ${plan.customer_name},\n\nYour ${durationDays}-day meal plan is expiring soon on ${endDateString}. Renew now to keep your delicious meals coming without interruption!\n\nThe TFB Team`;
        const emailBodyHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
            <h2 style="color: #047857;">TFB Subscription Reminder 📅</h2>
            <p>Hi ${plan.customer_name},</p>
            <p>Your ${durationDays}-day meal plan is <strong>expiring soon on ${endDateString}</strong>.</p>
            <p>Renew now to keep your delicious meals coming without interruption!</p>
            <br/>
            <p style="color: #475569; font-size: 12px;">The TFB Team</p>
          </div>
        `;

        if (SMTP_USERNAME && SMTP_PASSWORD) {
          console.log(`[Subscription Reminders] Connecting to SMTP Server to send email to ${email}...`);
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
          console.log(`[Subscription Reminders] Email successfully sent to ${email}`);
        } else {
          console.log(`[Subscription Reminders] MOCK EMAIL DISPATCH (Missing SMTP credentials)`);
          console.log(`To: ${email}`);
          console.log(`Subject: ${emailSubject}`);
          console.log(`Body:\n${emailBodyTxt}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Successfully processed subscription reminders",
        targetDate: targetDateString,
        remindersSent: endingSoon.length,
        details: endingSoon
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in subscription-reminders:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
