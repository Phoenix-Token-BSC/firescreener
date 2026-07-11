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

    const { data: claims, error } = await supabase
      .from('reward_claims')
      .select('reward_id')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    const claimedRewardIds = (claims || []).map(c => c.reward_id);

    return NextResponse.json({ claimedRewardIds });
  } catch (error) {
    console.error('Error fetching user claims:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user claims' },
      { status: 500 }
    );
  }
}
