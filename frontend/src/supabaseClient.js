import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseError = !supabaseUrl || !supabaseKey
  ? 'Missing Supabase environment variables. Copy frontend/.env.example to frontend/.env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  : null

export const supabase = supabaseError ? null : createClient(supabaseUrl, supabaseKey)
