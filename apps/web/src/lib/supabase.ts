import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing browser Supabase configuration');

// Browser usage is limited to Auth and authorized signed uploads.
export const supabase = createClient(url, key);
