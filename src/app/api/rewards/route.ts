import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET() {
  try {
    const { data: rewards, error: rewardsError } = await supabase
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (rewardsError) {
      throw rewardsError;
    }

    const { data: claims, error: claimsError } = await supabase
      .from('reward_claims')
      .select('reward_id');

    if (claimsError) {
      throw claimsError;
    }

    const claimCounts = (claims || []).reduce(
      (acc, claim) => {
        acc[claim.reward_id] = (acc[claim.reward_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const rewardsWithClaimed = (rewards || []).map((reward) => ({
      ...reward,
      claimed: claimCounts[reward.id] || 0,
    }));

    return NextResponse.json({ rewards: rewardsWithClaimed });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rewards' },
      { status: 500 }
    );
  }
}
