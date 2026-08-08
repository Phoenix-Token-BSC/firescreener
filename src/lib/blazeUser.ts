import { SupabaseClient } from '@supabase/supabase-js';

// All blaze state lives directly on the profile row, so one lookup covers both the
// existence check and the claim state.
//
// This used to search auth_users and developer_accounts in parallel, because the same
// person could hold two accounts with two separate balances. There is one account per
// person now, so there is one balance and one place to look.

export type BlazeUserTable = 'profiles';

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
  const { data, error } = await supabase
    .from('profiles')
    .select(BLAZE_USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle<BlazeUserRow>();

  if (error) {
    console.error('profiles blaze lookup error (has the identity merge been applied?):', error);
  }

  return data ? { table: 'profiles', user: data } : null;
}

// Best-effort audit log — a failed insert must never fail the claim itself,
// so callers await this after the balance update and move on.
export async function logBlazeClaimEvent(
  supabase: SupabaseClient,
  event: {
    userId: string;
    kind: 'daily' | 'bonus';
    dayNumber: number;
    amount: number;
    claimedAt: string;
  }
): Promise<void> {
  const { error } = await supabase.from('blaze_claim_events').insert({
    user_id: event.userId,
    kind: event.kind,
    day_number: event.dayNumber,
    amount: event.amount,
    claimed_at: event.claimedAt,
  });

  if (error) {
    console.error('blaze_claim_events insert error (is the table migrated?):', error);
  }
}
