import { createClient } from '@supabase/supabase-js';
import { verifyPassword } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, password } = body;

    if (!login || !password) {
      return NextResponse.json(
        { error: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabase
      .from('auth_users')
      .select('*')
      .or(`email.eq.${login},username.eq.${login}`)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username/email or password' },
        { status: 401 }
      );
    }

    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([
        {
          user_id: user.id,
          token: sessionToken,
          expires_at: expiresAt.toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        },
      ]);

    if (sessionError) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      );
    }

    await supabase
      .from('auth_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const { password_hash, ...userWithoutPassword } = user;

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: userWithoutPassword,
        token: sessionToken,
      },
      { status: 200 }
    );

    response.cookies.set({
      name: 'auth_token',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
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
