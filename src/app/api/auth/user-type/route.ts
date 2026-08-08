import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/profile';

/**
 * Resolve an account by id or email.
 *
 * There is one account per person now, so this no longer searches two tables and picks
 * a winner — it reads the single profile row. `userType` is retained for existing call
 * sites and is simply a projection of `is_developer`.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId && !email) {
      return NextResponse.json({ error: 'User ID or email required' }, { status: 400 });
    }

    let query = adminClient()
      .from('profiles')
      .select('id, username, email, is_developer, is_active');

    query = userId ? query.eq('id', userId) : query.ilike('email', email);

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('[auth/user-type]', error.message);
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      userType: data.is_developer ? 'dev' : 'user',
      isDeveloper: !!data.is_developer,
      id: data.id,
      username: data.username,
      email: data.email,
      isActive: data.is_active,
    });
  } catch (error) {
    console.error('User type error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
