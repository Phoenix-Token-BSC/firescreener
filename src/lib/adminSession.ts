// Admin session handling.
//
// Replaces the previous scheme, where every /api/admin/* route trusted an `x-user-email`
// header and looked it up in admin_users. That meant knowing an admin's email address —
// typically a public, guessable address — granted full admin API access with no password
// and no session at all. /api/admin/login validated a password and then had no way to
// prove that validation had happened.
//
// Now login issues a signed, expiring token stored in an HttpOnly cookie, and every admin
// route verifies that signature server-side. A caller cannot mint one without the secret.

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const ADMIN_COOKIE = 'admin_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Signing key. Prefer a dedicated secret; fall back to the service-role key so an
 * existing deploy does not break the moment this ships. Both are server-only.
 */
function signingKey(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set');
  }
  return secret;
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64url');

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

interface SessionPayload {
  email: string;
  exp: number; // unix seconds
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = {
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/** Returns the email if the token is authentic and unexpired, otherwise null. */
export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }

  // Constant-time compare so the signature cannot be discovered byte by byte.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
    if (!payload?.email || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.email;
  } catch {
    return null;
  }
}

/**
 * Gate for every /api/admin/* route.
 *
 * Verifies the signed cookie *and* re-checks admin_users, so revoking an admin
 * (is_active = false) takes effect immediately rather than at token expiry.
 *
 * Returns the admin's email, or null if the caller is not an authenticated admin.
 */
export async function requireAdmin(request: NextRequest): Promise<string | null> {
  const email = readSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!email) return null;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[adminSession] admin_users lookup failed:', error.message);
      return null;
    }
    return data ? email : null;
  } catch (err) {
    console.error('[adminSession] admin check error:', err);
    return null;
  }
}

/** Cookie attributes shared by login (set) and logout (clear). */
export function sessionCookieOptions(maxAge: number) {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true, // not readable from JS, so XSS cannot lift the session
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
