import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createSessionToken, sessionCookieOptions, SESSION_TTL_SECONDS } from '@/lib/adminSession';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// There is a single admin account, so a wrong password is far more likely to be an
// attack than a typo storm. Keep the window tight.
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

async function tooManyAttempts(key: string): Promise<boolean> {
  try {
    const count = await redis.incr(`admin-login-fails:${key}`);
    if (count === 1) await redis.expire(`admin-login-fails:${key}`, ATTEMPT_WINDOW_SECONDS);
    return count > MAX_ATTEMPTS;
  } catch (err) {
    // Redis down must not lock the only admin out of their own dashboard.
    console.error('[admin/login] rate limit check failed:', err);
    return false;
  }
}

async function clearAttempts(key: string) {
  try {
    await redis.del(`admin-login-fails:${key}`);
  } catch {
    /* best effort */
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Keyed on the submitted email so one attacker cannot lock out a different admin,
    // and so a shared NAT does not punish everyone behind it.
    const attemptKey = String(email).toLowerCase();
    if (await tooManyAttempts(attemptKey)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 15 minutes.' },
        { status: 429 }
      );
    }

    // Get admin user from database
    const { data: adminUser, error: queryError } = await supabase
      .from('admin_users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (queryError) {
      console.error('Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to verify credentials' },
        { status: 500 }
      );
    }

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password using RPC function
    const { data: isPasswordValid, error: verifyError } = await supabase.rpc(
      'verify_password',
      {
        password: password,
        password_hash: adminUser.password_hash,
      }
    );

    if (verifyError) {
      console.error('Verify error:', verifyError);
      return NextResponse.json(
        { error: 'Failed to verify password' },
        { status: 500 }
      );
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Password is correct — issue the signed session. This cookie, not the email the
    // client sends back, is what every /api/admin/* route trusts from here on.
    await clearAttempts(attemptKey);

    const response = NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });

    response.cookies.set({
      ...sessionCookieOptions(SESSION_TTL_SECONDS),
      value: createSessionToken(adminUser.email),
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
