import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/profile';

/**
 * Confirms a stored session still corresponds to a live account.
 *
 * One account per person means one table to check. Deactivated accounts are rejected so
 * the client clears the session rather than rendering a signed-in shell.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { data, error } = await adminClient()
      .from('profiles')
      .select('id, is_active, is_developer')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Session verification error:', error);
      return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (data.is_active === false) {
      return NextResponse.json({ error: 'User account is inactive' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      userType: data.is_developer ? 'dev' : 'user',
      isDeveloper: !!data.is_developer,
    });
  } catch (error) {
    console.error('Verify session error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
