import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 400 }
      );
    }

    // Check if developer (in developer_accounts)
    const { data: devUser } = await supabase
      .from('developer_accounts')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (devUser) {
      return NextResponse.json({ success: true, userType: 'dev' }, { status: 200 });
    }

    // Check if regular user (in auth_users)
    const { data: regularUser, error } = await supabase
      .from('auth_users')
      .select('id, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Session verification error:', error);
      return NextResponse.json(
        { error: 'Failed to verify session' },
        { status: 500 }
      );
    }

    if (!regularUser) {
      // User doesn't exist
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (regularUser.is_active === false) {
      // User is deactivated
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, userType: 'user' }, { status: 200 });
  } catch (error) {
    console.error('Verify session error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
