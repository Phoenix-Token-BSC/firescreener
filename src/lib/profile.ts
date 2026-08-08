// Server-side identity resolution.
//
// There is now exactly one account per person: a Supabase Auth user plus a `profiles`
// row. `is_developer` is a capability on that row, not a separate account — it replaces
// the old auth_users / developer_accounts split, where the same person could hold two
// unrelated logins with two passwords and two blaze balances.
//
// Every server route that needs to know "who is calling, and may they do this?" should
// go through requireUser / requireDeveloper rather than reading a table directly.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface Profile {
  id: string;
  username: string;
  email: string;
  is_developer: boolean;
  is_active: boolean;
  display_name: string | null;
  avatar_url: string | null;
  total_blazes_claimed: number;
  blaze_streak_day: number;
  blaze_claimed_days: number;
  blaze_bonus_claimed_days: number;
  blaze_last_claim_at: string | null;
  created_at: string;
}

export const PROFILE_COLUMNS =
  'id, username, email, is_developer, is_active, display_name, avatar_url, ' +
  'total_blazes_claimed, blaze_streak_day, blaze_claimed_days, ' +
  'blaze_bonus_claimed_days, blaze_last_claim_at, created_at';

/** Service-role client — bypasses RLS. Never expose the result to the browser. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Verifies a bearer JWT and returns the Supabase user id, or null. */
async function userIdFromRequest(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  const { data: { user }, error } = await scoped.auth.getUser();
  return error || !user ? null : user.id;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle<Profile>();

  if (error) {
    console.error('[profile] lookup failed:', error.message);
    return null;
  }
  return data;
}

/**
 * The caller's profile, or null if they are unauthenticated or deactivated.
 * A deactivated account is treated as no account at all.
 */
export async function requireUser(req: NextRequest): Promise<Profile | null> {
  const userId = await userIdFromRequest(req);
  if (!userId) return null;

  const profile = await getProfile(userId);
  if (!profile || !profile.is_active) return null;
  return profile;
}

/**
 * As requireUser, but also requires the developer capability. This is the single gate
 * for listing tokens and managing them.
 */
export async function requireDeveloper(req: NextRequest): Promise<Profile | null> {
  const profile = await requireUser(req);
  return profile?.is_developer ? profile : null;
}

/**
 * Resolve a login identifier — username or email — to the email Supabase Auth needs.
 * Both are matched case-insensitively, matching how the login form normalizes input.
 */
export async function emailForLogin(identifier: string): Promise<string | null> {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;

  const db = adminClient();

  // Two separate queries rather than one .or() filter. PostgREST's `or` takes a filter
  // *string*, so interpolating the identifier into it would let input containing commas
  // or parentheses rewrite the query. Passing the value as a normal filter argument
  // keeps it data.
  const byEmail = await db
    .from('profiles')
    .select('email')
    .ilike('email', value)
    .maybeSingle<{ email: string }>();

  if (byEmail.data?.email) return byEmail.data.email;

  const byUsername = await db
    .from('profiles')
    .select('email')
    .ilike('username', value)
    .maybeSingle<{ email: string }>();

  return byUsername.data?.email ?? null;
}
