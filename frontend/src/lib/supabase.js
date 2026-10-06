import { createClient } from '@supabase/supabase-js'

// Anon key use karo frontend mein — service role key kabhi frontend mein mat daalo
// VITE_ prefix zaroori hai — Vite sirf inhi env vars expose karta hai browser ko
const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.error('Supabase env vars missing — check frontend/.env')
}

export const supabase = createClient(supabaseUrl, supabaseAnon)
