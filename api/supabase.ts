import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials missing in .env file!');
}

// Prevent crash if env vars are missing by using placeholders. 
// Requests will fail gracefully instead of crashing the server on startup.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseServiceKey || 'placeholder-key';

export const supabase = createClient(validUrl, validKey);
