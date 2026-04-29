// js/universe/supabaseClient.js
// ANON key only — service_role key must never appear in frontend code.
// All writes go through /api/* endpoints (server-side service_role).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pionxzqtxcughvfbgadi.supabase.co';
const supabaseKey = 'sb_publishable_w29DE53nrdGnNEvBn68kzg_ujje7u5Y';

export const supabase = createClient(supabaseUrl, supabaseKey);