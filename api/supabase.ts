import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase credentials missing in .env file!');
}

// Prevent crash if env vars are missing by using placeholders. 
// Requests will fail gracefully instead of crashing the server on startup.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseServiceKey || 'placeholder-key';
const validAnonKey = supabaseAnonKey || validKey;

export const supabaseAdmin = createClient(validUrl, validKey);

export const supabaseAnon = createClient(validUrl, validAnonKey);

export const createClientWithToken = (token: string) => {
  return createClient(validUrl, validAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};
