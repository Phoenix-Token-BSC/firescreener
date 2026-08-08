import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { emailForLogin, getProfile, adminClient } from '@/lib/profile';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Single login for everyone.
 *
 * Both regular users and developers now authenticate against Supabase Auth — there is
 * one account per person, with `is_developer` as a capability on their profile. The old
 * split (bcrypt hashes in auth_users vs a separate Supabase login for developers) is
 * gone, along with the possibility of being signed in as two different people at once.
 *
 * Supabase only authenticates by email, so a username is resolved to one first. The
 * session is returned for the client to adopt via supabase.auth.setSession().
 */
export async function POST(request: NextRequest) {
  try {
    const { login, password } = await request.json();

    if (!login || !password) {
      return NextResponse.json(
        { error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const email = await emailForLogin(String(login));

    // Same generic message whether the account is missing or the password is wrong, so
    // this cannot be used to discover which usernames and emails exist.
    const invalid = NextResponse.json(
      { error: 'Invalid username/email or password' },
      { status: 401 }
    );
    if (!email) return invalid;

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return invalid;

    const profile = await getProfile(data.user.id);
    if (!profile) {
      console.error('[auth/login] authenticated user has no profile:', data.user.id);
      return NextResponse.json({ error: 'Account is not fully set up' }, { status: 500 });
    }
    if (!profile.is_active) {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
    }

    // Best effort — a failed timestamp write must not fail the login.
    await adminClient()
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        userType: profile.is_developer ? 'dev' : 'user',
        isDeveloper: profile.is_developer,
      },
      // The client installs this with supabase.auth.setSession(), giving one session
      // that every API route can verify.
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An error occurred during login' }, { status: 500 });
  }
}
