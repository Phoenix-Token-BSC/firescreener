import { SupabaseClient } from '@supabase/supabase-js';

// All blaze state lives directly on the user row (auth_users or developer_accounts),
// so one lookup covers both the existence check and the claim state.

export type BlazeUserTable = 'auth_users' | 'developer_accounts';

export interface BlazeUserRow {
  id: string;
  total_blazes_claimed: number;
  blaze_streak_day: number;
  blaze_claimed_days: number;
  blaze_bonus_claimed_days: number;
  blaze_last_claim_at: string | null;
}

export const BLAZE_USER_COLUMNS =
  'id, total_blazes_claimed, blaze_streak_day, blaze_claimed_days, blaze_bonus_claimed_days, blaze_last_claim_at';

export async function getBlazeUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ table: BlazeUserTable; user: BlazeUserRow } | null> {
  const [regular, dev] = await Promise.all([
    supabase
      .from('auth_users')
      .select(BLAZE_USER_COLUMNS)
      .eq('id', userId)
      .maybeSingle<BlazeUserRow>(),
    supabase
      .from('developer_accounts')
      .select(BLAZE_USER_COLUMNS)
      .eq('id', userId)
      .maybeSingle<BlazeUserRow>(),
  ]);

  if (regular.error) {
    console.error('auth_users blaze lookup error (are the blaze columns migrated?):', regular.error);
  }
  if (dev.error) {
    console.error('developer_accounts blaze lookup error (are the blaze columns migrated?):', dev.error);
  }

  if (regular.data) return { table: 'auth_users', user: regular.data };
  if (dev.data) return { table: 'developer_accounts', user: dev.data };
  return null;
}
