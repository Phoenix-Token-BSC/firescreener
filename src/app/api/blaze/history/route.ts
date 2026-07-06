import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const days = request.nextUrl.searchParams.get('days') || '7';

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

    // Get user's blaze stats
    let { data: stats, error: statsError } = await supabase
      .from('user_blaze_stats')
      .select('total_blaze_earned, last_claim_at, current_streak_day')
      .eq('user_id', userId)
      .maybeSingle();

    // Auto-initialize if doesn't exist
    if (!stats) {
      console.log(`[BLAZE] Initializing blaze stats for user ${userId}`);

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
          { error: 'Failed to initialize blaze stats', details: createStatsError.message },
          { status: 500 }
        );
      }

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
          { error: 'Failed to initialize daily claims', details: createClaimsError.message },
          { status: 500 }
        );
      }

      stats = newStats;
    } else if (statsError) {
      console.error('Stats fetch error:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch balance', details: statsError.message },
        { status: 500 }
      );
    }

    // Get all 7 daily claims for this user
    const { data: dailyClaims, error: claimsError } = await supabase
      .from('blaze_daily_claims')
      .select('day_number, amount, is_claimed, claimed_at')
      .eq('user_id', userId)
      .order('day_number', { ascending: true });

    if (claimsError) {
      console.error('Claims fetch error:', claimsError);
      return NextResponse.json(
        { error: 'Failed to fetch claims', details: claimsError.message },
        { status: 500 }
      );
    }

    // Build 7-day streak data from database
    const streakData = dailyClaims?.map((claim) => {
      const dayNames = [
        'Today',
        'Yesterday',
        '2 days ago',
        '3 days ago',
        '4 days ago',
        '5 days ago',
        '6 days ago',
      ];

      return {
        dayNumber: claim.day_number,
        date: dayNames[claim.day_number - 1] || `Day ${claim.day_number}`,
        claimed: claim.is_claimed,
        amount: claim.amount,
        claimedAt: claim.claimed_at,
      };
    }) || [];

    // Determine if current day can be claimed
    const currentStreakDay = stats?.current_streak_day || 1;
    const currentDayData = dailyClaims?.find((c) => c.day_number === currentStreakDay);

    // Check 24-hour cooldown
    let canClaim = currentStreakDay <= 7 && !currentDayData?.is_claimed;
    let timeUntilNextClaim = '';

    if (stats?.last_claim_at) {
      const now = new Date();
      const lastClaimTime = new Date(stats.last_claim_at);
      const timeDiff = now.getTime() - lastClaimTime.getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeDiff < twentyFourHours) {
        // Still in cooldown period - can't claim yet
        canClaim = false;
        const remainingTime = twentyFourHours - timeDiff;
        const hours = Math.floor(remainingTime / (60 * 60 * 1000));
        const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
        timeUntilNextClaim = `${hours}h ${minutes}m ${seconds}s`;
      }
    }

    console.log(`[HISTORY] User ${userId}: streak_day=${currentStreakDay}, can_claim=${canClaim}, day_is_claimed=${currentDayData?.is_claimed}, last_claim_at=${stats?.last_claim_at}, total_earned=${stats?.total_blaze_earned}`);

    const claimedCount = streakData.filter((d) => d.claimed).length;

    return NextResponse.json(
      {
        success: true,
        balance: {
          totalBlaze: stats?.total_blaze_earned || 0,
          lastClaimAt: stats?.last_claim_at,
        },
        streak: {
          data: streakData,
          claimedDays: claimedCount,
          totalDays: 7,
          currentStreakDay: currentStreakDay,
          canClaim,
          timeUntilNextClaim,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('History error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching history' },
      { status: 500 }
    );
  }
}
