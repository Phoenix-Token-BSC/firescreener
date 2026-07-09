import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const DAILY_REWARD = 10;

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

    // Check if user exists (regular user or developer)
    const { data: regularUser } = await supabase
      .from('auth_users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    const { data: devUser } = await supabase
      .from('developer_accounts')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!regularUser && !devUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's current stats
    let { data: stats, error: statsError } = await supabase
      .from('user_blaze_stats')
      .select('current_streak_day, last_claim_at, total_blaze_earned')
      .eq('user_id', userId)
      .maybeSingle();

    // Auto-initialize blaze data if doesn't exist
    if (!stats) {
      console.log(`[BLAZE] Initializing blaze stats for user ${userId}`);

      // Create user_blaze_stats
      const { data: newStats, error: createStatsError } = await supabase
        .from('user_blaze_stats')
        .insert([{
          user_id: userId,
          total_blaze_earned: 0,
          current_streak_day: 1,
          is_active_today: false,
        }])
        .select()
        .single();

      if (createStatsError) {
        console.error('Failed to create blaze stats:', createStatsError);
        return NextResponse.json(
          { error: 'Failed to initialize blaze stats' },
          { status: 500 }
        );
      }

      // Create 7-day cycle
      const claimsData = Array.from({ length: 7 }, (_, i) => ({
        user_id: userId,
        day_number: i + 1,
        amount: 10,
        is_claimed: false,
        claimed_at: null,
      }));

      const { error: createClaimsError } = await supabase
        .from('blaze_daily_claims')
        .insert(claimsData);

      if (createClaimsError) {
        console.error('Failed to create daily claims:', createClaimsError);
        return NextResponse.json(
          { error: 'Failed to initialize daily claims' },
          { status: 500 }
        );
      }

      stats = newStats;
    } else if (statsError) {
      console.error('Stats fetch error:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch user stats' },
        { status: 500 }
      );
    }

    if (!stats) {
      return NextResponse.json(
        { error: 'Failed to initialize user blaze stats' },
        { status: 500 }
      );
    }

    let currentDay = stats.current_streak_day;
    const now = new Date();

    // Check 24-hour cooldown (can only claim once per day)
    if (stats.last_claim_at) {
      const lastClaimTime = new Date(stats.last_claim_at);
      const timeDiff = now.getTime() - lastClaimTime.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeDiff < twentyFourHours) {
        const remainingTime = twentyFourHours - timeDiff;
        const hours = Math.floor(remainingTime / (60 * 60 * 1000));
        const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));

        console.log(`[DEBUG] 24h cooldown active. Last claim: ${stats.last_claim_at}, Time diff: ${timeDiff}ms, Hours: ${hours}h ${minutes}m`);

        return NextResponse.json(
          {
            error: 'Already claimed today',
            nextClaimAvailableIn: `${hours}h ${minutes}m`,
          },
          { status: 429 }
        );
      }
    }

    // Check if current day has already been claimed
    const { data: existingClaim, error: checkError } = await supabase
      .from('blaze_daily_claims')
      .select('is_claimed')
      .eq('user_id', userId)
      .eq('day_number', currentDay)
      .single();

    if (checkError) {
      console.error('Check claim error:', checkError);
      return NextResponse.json(
        { error: 'Failed to check claim status' },
        { status: 500 }
      );
    }

    if (existingClaim?.is_claimed) {
      return NextResponse.json(
        { error: 'Day already claimed' },
        { status: 400 }
      );
    }

    // Mark this day as claimed
    const { data: claim, error: claimError } = await supabase
      .from('blaze_daily_claims')
      .update({
        is_claimed: true,
        claimed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .eq('day_number', currentDay)
      .select()
      .single();

    if (claimError) {
      console.error('Claim update error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record claim' },
        { status: 500 }
      );
    }

    // Increment to next day (or reset to 1 after day 7)
    const nextDay = currentDay === 7 ? 1 : currentDay + 1;
    await supabase
      .from('user_blaze_stats')
      .update({
        current_streak_day: nextDay,
        last_claim_at: now.toISOString(),
      })
      .eq('user_id', userId);

    // Get updated stats
    const { data: updatedStats, error: updatedStatsError } = await supabase
      .from('user_blaze_stats')
      .select('total_blaze_earned, current_streak_day')
      .eq('user_id', userId)
      .single();

    if (updatedStatsError) {
      console.error('Updated stats fetch error:', updatedStatsError);
      return NextResponse.json(
        { error: 'Failed to fetch updated stats' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully claimed ${DAILY_REWARD} BLAZE points - Day ${currentDay}`,
        claim: {
          id: claim.id,
          dayNumber: claim.day_number,
          amount: claim.amount,
          claimedAt: claim.claimed_at,
        },
        balance: updatedStats?.total_blaze_earned || 0,
        nextDay: currentDay === 7 ? 1 : currentDay + 1,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json(
      { error: 'An error occurred during claim' },
      { status: 500 }
    );
  }
}
