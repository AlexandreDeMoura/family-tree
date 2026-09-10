import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import type { AuthVerifier } from '../features/auth/auth.service.js';

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/** Supabase validates the signature, expiry, and revocation state server-side. */
export function createSupabaseAuthVerifier(
  auth: Pick<typeof supabaseAdmin.auth, 'getUser'>,
): AuthVerifier {
  return {
    async verifyAccessToken(accessToken) {
      const { data, error } = await auth.getUser(accessToken);
      return error || !data.user ? null : { id: data.user.id };
    },
  };
}
