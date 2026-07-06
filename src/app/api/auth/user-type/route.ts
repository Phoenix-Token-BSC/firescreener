import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'User ID or email required' },
        { status: 400 }
      );
    }

    // Check if user is a developer (in developer_accounts)
    if (userId) {
      const { data: devAccount, error: devError } = await supabase
        .from('developer_accounts')
        .select('id, username, email')
        .eq('id', userId)
        .maybeSingle();

      if (devAccount) {
        return NextResponse.json(
          {
            userType: 'dev',
            id: devAccount.id,
            username: devAccount.username,
            email: devAccount.email,
          },
          { status: 200 }
        );
      }
    }

    // Check if user is a regular user (in auth_users)
    if (userId) {
      const { data: userAccount, error: userError } = await supabase
        .from('auth_users')
        .select('id, username, email')
        .eq('id', userId)
        .maybeSingle();

      if (userAccount) {
        return NextResponse.json(
          {
            userType: 'user',
            id: userAccount.id,
            username: userAccount.username,
            email: userAccount.email,
          },
          { status: 200 }
        );
      }
    }

    // By email
    if (email) {
      const { data: devAccount } = await supabase
        .from('developer_accounts')
        .select('id, username, email')
        .eq('email', email)
        .maybeSingle();

      if (devAccount) {
        return NextResponse.json(
          {
            userType: 'dev',
            id: devAccount.id,
            username: devAccount.username,
            email: devAccount.email,
          },
          { status: 200 }
        );
      }

      const { data: userAccount } = await supabase
        .from('auth_users')
        .select('id, username, email')
        .eq('email', email)
        .maybeSingle();

      if (userAccount) {
        return NextResponse.json(
          {
            userType: 'user',
            id: userAccount.id,
            username: userAccount.username,
            email: userAccount.email,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('User type check error:', error);
    return NextResponse.json(
      { error: 'Failed to determine user type' },
      { status: 500 }
    );
  }
}
