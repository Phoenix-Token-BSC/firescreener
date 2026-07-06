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
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data: claims, error: claimsError } = await supabase
      .from('reward_claims')
      .select(`
        id,
        reward_id,
        cost_paid,
        wallet_address,
        claimed_at,
        rewards:reward_id (
          id,
          name,
          description,
          type,
          icon,
          color
        )
      `)
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false });

    if (claimsError) {
      throw claimsError;
    }

    return NextResponse.json({ claims });
  } catch (error) {
    console.error('Error fetching user rewards claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards claims' },
      { status: 500 }
    );
  }
}
