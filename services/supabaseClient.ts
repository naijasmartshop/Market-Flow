import { createClient } from '@supabase/supabase-js';

// Configuration updated with user provided credentials
const supabaseUrl = 'https://qcbcqekaeztqvsdqckeb.supabase.co';
const supabaseKey = 'sb_publishable_7uhZkj9bjpve-tTmd7TGvw_YbKux7qS';

export const supabase = createClient(supabaseUrl, supabaseKey);