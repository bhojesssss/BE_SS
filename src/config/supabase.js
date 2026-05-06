import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();


const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Anonymous client — used for unauthenticated requests
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client — bypasses RLS, use carefully (server only!)
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

// User-scoped client — respects RLS by forwarding user JWT
export const getUserClient = (userJWT) => {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${userJWT}` } },
  });
};