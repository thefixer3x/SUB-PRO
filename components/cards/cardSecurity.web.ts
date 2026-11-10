import { supabase } from '@/lib/supabase';

/**
 * Web: re-check the session with the auth server (not just the cached token)
 * before a card action or a card-details reveal. A revoked or expired session
 * is refused here, before any request for a reveal key is made.
 */
export async function confirmCardAction(_reason: string): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user;
}
