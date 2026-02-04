// js/universe/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Použij ty samé údaje, co máš v nahrávači
const supabaseUrl = 'https://pionxzqtxcughvfbgadi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpb254enF0eGN1Z2h2ZmJnYWRpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMxOTk2NiwiZXhwIjoyMDgyODk1OTY2fQ.lFAHdBtREF7TfM5UHuzbBkQQN3fdU_ac9Y-MJxCvmFI';

export const supabase = createClient(supabaseUrl, supabaseKey);