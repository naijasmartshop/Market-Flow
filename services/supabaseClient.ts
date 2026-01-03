import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION REQUIRED
// ------------------------------------------------------------------
// You must replace these values with your own project details from 
// the Supabase Dashboard -> Project Settings -> API.
// 
// Alternatively, set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY 
// in your environment variables.
// ------------------------------------------------------------------

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseKey);