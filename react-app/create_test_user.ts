import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ijnigtjlphdeafstnrxk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqbmlndGpscGhkZWFmc3RucnhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkxODU3NiwiZXhwIjoyMDg4NDk0NTc2fQ.3m-l23p_YG9TboMEgKkE6tmlRagezvmFCmtC3S80AiQ';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: 'test2@example.com',
    password: 'testpassword1',
    email_confirm: true
  });
  
  if (error) {
     if (error.message.includes('already exists')) {
       console.log("User already exists, getting ID...");
       const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
       const u = users.find(u => u.email === 'test2@example.com');
       if (u) {
         console.log("Existing user ID:", u.id);
         await updateProfile(u.id);
         // Ensure password is correct
         await supabaseAdmin.auth.admin.updateUserById(u.id, { password: 'testpassword1', email_confirm: true });
       }
       return;
     }
     console.error(error);
     return;
  }
  console.log("Created user:", data?.user?.id);
  if (data?.user?.id) {
    await updateProfile(data.user.id);
  }
}

async function updateProfile(id) {
  const { error } = await supabaseAdmin.from('profiles').upsert({
    id: id,
    full_name: 'Test Dummy',
    email: 'test2@example.com',
    role: 'customer'
  });
  if (error) console.error("Profile error:", error);
  else console.log("Profile updated!");
}

run();
