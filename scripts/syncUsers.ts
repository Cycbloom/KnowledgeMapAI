import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function syncUsers() {
  console.log('🔧 Syncing users from auth.users to public.users...\n');

  const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing auth users:', listError);
    process.exit(1);
  }

  if (!authUsers?.users?.length) {
    console.log('ℹ️ No users found in auth.users');
    return;
  }

  console.log(`📋 Found ${authUsers.users.length} users in auth.users`);

  const { data: existingUsers, error: existingError } = await supabase
    .from('users')
    .select('id, email');

  if (existingError) {
    console.error('❌ Error fetching existing users:', existingError);
    process.exit(1);
  }

  const existingIds = new Set(existingUsers?.map(u => u.id) || []);
  console.log(`📋 Found ${existingIds.size} users in public.users`);

  for (const authUser of authUsers.users) {
    if (existingIds.has(authUser.id)) {
      console.log(`✅ User ${authUser.email} already exists in public.users`);
      continue;
    }

    console.log(`🔧 Creating public.users record for ${authUser.email}...`);

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
        password_hash: 'MANAGED_BY_SUPABASE_AUTH',
      });

    if (insertError) {
      console.error(`❌ Error creating user ${authUser.email}:`, insertError);
    } else {
      console.log(`✅ Created public.users record for ${authUser.email}`);
    }
  }

  console.log('\n✅ User sync completed!');
}

syncUsers();
