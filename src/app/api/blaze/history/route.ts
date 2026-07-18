import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { BONUS_REWARDS, hasClaimedToday, isStreakBroken, timeUntilNextUtcMidnight } from '@/lib/blaze';

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

    // Run all lookups in parallel: user existence checks, blaze stats, and daily claims
    const [
      { data: regularUser },
      { data: devUser },
      { data: statsData, error: statsError },
      { data: claimsData, error: claimsError },
      { data: bonusData, error: bonusError },
    ] = await Promise.all([
      supabase
        .from('auth_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('developer_accounts')
        .select('id')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_blaze_stats')
        .select('total_blaze_earned, last_claim_at, current_streak_day')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('blaze_daily_claims')
        .select('day_number, amount, is_claimed, claimed_at')
        .eq('user_id', userId)
        .order('day_number', { ascending: true }),
      supabase
        .from('blaze_bonus_claims')
        .select('day_number, amount, is_claimed, claimed_at')
        .eq('user_id', userId)
        .order('day_number', { ascending: true }),
    ]);

    if (!regularUser && !devUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let stats = statsData;
    let dailyClaims = claimsData;

    // Auto-initialize if doesn't exist
    if (!stats) {
      console.log(`[BLAZE] Initializing blaze stats for user ${userId}`);

      const newClaims = Array.from({ length: 7 }, (_, i) => ({
        user_id: userId,
        day_number: i + 1,
        amount: 10,
        is_claimed: false,
        claimed_at: null,
      }));

      const [
        { data: newStats, error: createStatsError },
        { error: createClaimsError },
      ] = await Promise.all([
        supabase
          .from('user_blaze_stats')
          .insert([{
            user_id: userId,
            total_blaze_earned: 0,
            current_streak_day: 1,
            is_active_today: false,
          }])
          .select()
          .single(),
        supabase
          .from('blaze_daily_claims')
          .insert(newClaims),
      ]);

      if (createStatsError) {
        console.error('Failed to create blaze stats:', createStatsError);
        return NextResponse.json(
          { error: 'Failed to initialize blaze stats', details: createStatsError.message },
          { status: 500 }
        );
      }

      if (createClaimsError) {
        console.error('Failed to create daily claims:', createClaimsError);
        return NextResponse.json(
          { error: 'Failed to initialize daily claims', details: createClaimsError.message },
          { status: 500 }
        );
      }

      stats = newStats;
      dailyClaims = newClaims.map(({ day_number, amount, is_claimed, claimed_at }) => ({
        day_number,
        amount,
        is_claimed,
        claimed_at,
      }));
    } else if (statsError) {
      console.error('Stats fetch error:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch balance', details: statsError.message },
        { status: 500 }
      );
    }

    if (claimsError) {
      console.error('Claims fetch error:', claimsError);
      return NextResponse.json(
        { error: 'Failed to fetch claims', details: claimsError.message },
        { status: 500 }
      );
    }

    const now = new Date();
    const lastClaimAt = stats?.last_claim_at ?? null;
    const claimedToday = hasClaimedToday(lastClaimAt, now);
    const streakBroken = isStreakBroken(lastClaimAt, now);

    let currentStreakDay = stats?.current_streak_day || 1;
    let effectiveClaims = dailyClaims || [];

    // Mirror the claim route's lazy reset in what we display: a broken streak
    // (missed day) or a completed cycle rolling over shows a fresh board.
    // The actual DB reset happens on the next claim.
    const currentDayRow = effectiveClaims.find((c) => c.day_number === currentStreakDay);
    const boardWasReset = streakBroken || (!claimedToday && currentStreakDay === 1 && currentDayRow?.is_claimed);
    if (boardWasReset) {
      currentStreakDay = 1;
      effectiveClaims = effectiveClaims.map((c) => ({
        ...c,
        is_claimed: false,
        claimed_at: null,
      }));
    }

    // Build 7-day streak data
    const streakData = effectiveClaims.map((claim) => {
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
    });

    // One claim per calendar day — resets at 00:00 UTC
    const currentDayData = effectiveClaims.find((c) => c.day_number === currentStreakDay);
    const canClaim = currentStreakDay <= 7 && !claimedToday && !currentDayData?.is_claimed;
    const timeUntilNextClaim = claimedToday ? timeUntilNextUtcMidnight(now).formatted : '';

    console.log(`[HISTORY] User ${userId}: streak_day=${currentStreakDay}, can_claim=${canClaim}, day_is_claimed=${currentDayData?.is_claimed}, last_claim_at=${stats?.last_claim_at}, total_earned=${stats?.total_blaze_earned}`);

    const claimedCount = streakData.filter((d) => d.claimed).length;

    // Bonus claims: locked until the matching daily day is claimed. Rows are
    // created lazily by the bonus-claim route, so synthesize defaults when
    // missing (or when the table isn't set up yet — non-fatal).
    if (bonusError) {
      console.error('Bonus claims fetch error (is the blaze_bonus_claims table created?):', bonusError);
    }

    const bonuses = Object.entries(BONUS_REWARDS).map(([day, defaultAmount]) => {
      const dayNumber = Number(day);
      const row = bonusData?.find((b) => b.day_number === dayNumber);
      const claimed = !boardWasReset && !!row?.is_claimed;
      const dailyRow = effectiveClaims.find((c) => c.day_number === dayNumber);

      return {
        dayNumber,
        amount: row?.amount ?? defaultAmount,
        claimed,
        claimedAt: claimed ? row?.claimed_at ?? null : null,
        unlocked: !!dailyRow?.is_claimed,
      };
    });

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
        bonuses,
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
