import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

async function testLogin() {
  console.log("1. Simulating entering email...");
  const email = 'test_tfb_123@example.com';
  
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { full_name: "" },
    },
  });

  if (otpError) {
      console.error("❌ Failed to send OTP:", otpError.message);
      return;
  }
  console.log("✅ OTP triggered successfully (new user created in auth.users).");

  console.log("\n2. Waiting 2 seconds for Postgres Trigger to run...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("\n3. Testing profile read directly via Anon key...");
  
  // We can't verify the OTP easily in a script without reading the email, 
  // but we CAN check if the trigger worked by selecting the Profiles table via service role (admin)
  // or just querying the DB to see if `test_tfb_123@example.com` exists.
  
  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email);

  console.log("Raw Response from Profiles table:");
  console.log("Data:", data);
  console.log("Error:", profileError);

  if (profileError && profileError.message.includes("recursion")) {
      console.error("\n🚨 THE INFINITE RECURSION LOOP STILL EXISTS! 🚨");
      console.error("The SQL script was not run successfully.");
  } else if (!profileError) {
      console.log("\n✅ Database querying works. No recursion detected.");
  }
}

testLogin();
