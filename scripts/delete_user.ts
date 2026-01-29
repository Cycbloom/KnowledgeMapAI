import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteUserByEmail(email: string) {
  console.log(`Searching for user with email: ${email}...`);
  
  // List users to find the ID (admin.listUsers)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);
  
  if (!user) {
    console.error(`User with email ${email} not found.`);
    // Just exit success-ish or fail? Let's say fail to inform user.
    process.exit(1);
  }

  console.log(`Found user: ${user.id}. Deleting...`);
  
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  
  if (deleteError) {
    console.error('Error deleting user:', deleteError.message);
    process.exit(1);
  }

  console.log(`Successfully deleted user ${email} from auth.users.`);
  console.log('You can now re-register with this email.');
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/delete_user.ts <email>');
  process.exit(1);
}

deleteUserByEmail(email);
