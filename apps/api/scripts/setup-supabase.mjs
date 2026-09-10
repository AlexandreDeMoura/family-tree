import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

for (const name of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'DATABASE_URL']) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query('select 1');
  console.log('PostgreSQL connection OK');
} finally {
  await pool.end();
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: buckets, error: listError } = await admin.storage.listBuckets();
if (listError) throw listError;

const options = {
  public: false,
  allowedMimeTypes: ['image/jpeg'],
  fileSizeLimit: 5 * 1024 * 1024,
};
const exists = buckets.some((bucket) => bucket.id === 'family-photos');
const { error } = exists
  ? await admin.storage.updateBucket('family-photos', options)
  : await admin.storage.createBucket('family-photos', options);
if (error) throw error;
console.log('Private family-photos bucket ready');
