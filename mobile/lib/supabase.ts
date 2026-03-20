/**
 * Supabase JS client initialised with the anon (public) key.
 * Never use the service role key on the frontend.
 */

import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yatyxiyiqdmyjhqukgpj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdHl4aXlpcWRteWpocXVrZ3BqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzQ4MjcsImV4cCI6MjA4OTUxMDgyN30.bKDqqLTIqShcCWYtpALEJoqLpXK_pnt-ZFkmF6E7kv8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
