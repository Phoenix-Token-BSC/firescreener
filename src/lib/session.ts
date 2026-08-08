'use client';

// One account at a time.
//
// The app has two independent login systems that were previously unaware of each other:
//
//   regular user  -> POST /api/auth/login, stored in localStorage ('user', 'auth_token')
//                    plus an auth_token cookie
//   developer     -> supabase.auth.signInWithPassword, stored in Supabase's own
//                    localStorage entry
//
// Nothing cleared one when the other signed in, so both could be live simultaneously.
// The visible symptom: log out as a user and the leftover developer session is picked up
// on the next load, silently logging you back in as someone else.
//
// Every login path now goes through here, which records which session is authoritative
// and tears the other one down.

import { createClient } from '@supabase/supabase-js';

export type SessionKind = 'user' | 'dev';

const ACTIVE_SESSION_KEY = 'activeSession';

interface ActiveSession {
  kind: SessionKind;
  at: number;
}

function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Which session the user most recently established, if we know. */
export function readActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    return parsed?.kind === 'user' || parsed?.kind === 'dev' ? parsed : null;
  } catch {
    return null;
  }
}

function markActiveSession(kind: SessionKind) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ kind, at: Date.now() }));
  } catch {
    /* private mode — exclusivity still holds, we just cannot record which won */
  }
}

/** Drops the regular-user session: localStorage entries and the auth_token cookie. */
export async function clearUserSession() {
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* the cookie is httpOnly-ish server state; a network failure here is not fatal */
  }
}

/** Drops the developer session held by Supabase Auth. */
export async function clearDevSession() {
  try {
    await browserSupabase()?.auth.signOut();
  } catch {
    /* already signed out */
  }
}

/**
 * Call immediately after a successful regular-user login. Ends any developer session so
 * the two cannot overlap.
 */
export async function startUserSession() {
  await clearDevSession();
  markActiveSession('user');
}

/**
 * Call immediately after a successful developer login. Ends any regular-user session so
 * the two cannot overlap.
 */
export async function startDevSession() {
  await clearUserSession();
  markActiveSession('dev');
}

/** Ends whichever session is active — both, so nothing can linger. */
export async function endAllSessions() {
  await Promise.all([clearUserSession(), clearDevSession()]);
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* nothing to do */
  }
}
