import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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

    // Password is correct
    return NextResponse.json({
      success: true,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
