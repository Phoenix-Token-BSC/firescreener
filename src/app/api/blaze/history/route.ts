import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  BONUS_REWARDS,
  DAILY_REWARD,
  hasClaimedToday,
  isBonusClaimWindow,
  isDayClaimed,
  isStreakBroken,
  timeUntilNextUtcMidnight,
} from '@/lib/blaze';
import { getBlazeUser } from '@/lib/blazeUser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const DAY_NAMES = [
  'Today',
  'Yesterday',
  '2 days ago',
  '3 days ago',
  '4 days ago',
  '5 days ago',
  '6 days ago',
];

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Blaze state lives on the user row itself — one lookup covers the
    // existence check, balance, streak, and both claim boards. New users need
    // no initialization; the column defaults are the fresh state.
    const found = await getBlazeUser(supabase, userId);
    if (!found) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { user } = found;
    const now = new Date();
    const lastClaimAt = user.blaze_last_claim_at;
    const claimedToday = hasClaimedToday(lastClaimAt, now);
    const streakBroken = isStreakBroken(lastClaimAt, now);

    let currentStreakDay = user.blaze_streak_day || 1;
    let claimedDays = user.blaze_claimed_days;
    let bonusClaimedDays = user.blaze_bonus_claimed_days;

    // Mirror the claim route's lazy reset in what we display: a broken streak
    // (missed day) or a completed cycle rolling over shows a fresh board.
    // The actual DB reset happens on the next claim.
    const boardWasReset =
      streakBroken || (!claimedToday && currentStreakDay === 1 && isDayClaimed(claimedDays, 1));
    if (boardWasReset) {
      currentStreakDay = 1;
      claimedDays = 0;
      bonusClaimedDays = 0;
    }

    // Build 7-day streak data. Only the most recent claim's timestamp is
    // stored, so earlier days show claimed without a timestamp.
    const lastClaimedDay = currentStreakDay === 1 ? 7 : currentStreakDay - 1;
    const streakData = Array.from({ length: 7 }, (_, i) => {
      const dayNumber = i + 1;
      const claimed = isDayClaimed(claimedDays, dayNumber);

      return {
        dayNumber,
        date: DAY_NAMES[i] || `Day ${dayNumber}`,
        claimed,
        amount: DAILY_REWARD,
        claimedAt: claimed && dayNumber === lastClaimedDay ? lastClaimAt : null,
      };
    });

    // One claim per calendar day — resets at 00:00 UTC
    const canClaim =
      currentStreakDay <= 7 && !claimedToday && !isDayClaimed(claimedDays, currentStreakDay);
    const timeUntilNextClaim = claimedToday ? timeUntilNextUtcMidnight(now).formatted : '';

    console.log(`[HISTORY] User ${userId}: streak_day=${currentStreakDay}, can_claim=${canClaim}, claimed_days=${claimedDays}, last_claim_at=${lastClaimAt}, total_earned=${user.total_blazes_claimed}`);

    const claimedCount = streakData.filter((d) => d.claimed).length;

    const bonuses = Object.entries(BONUS_REWARDS).map(([day, amount]) => {
      const dayNumber = Number(day);
      const claimed = isDayClaimed(bonusClaimedDays, dayNumber);
      const unlocked = isBonusClaimWindow(
        dayNumber,
        currentStreakDay,
        claimedToday,
        isDayClaimed(claimedDays, dayNumber),
        boardWasReset
      );

      return {
        dayNumber,
        amount,
        claimed,
        claimedAt: claimed ? lastClaimAt : null,
        unlocked,
      };
    });

    return NextResponse.json(
      {
        success: true,
        balance: {
          totalBlaze: user.total_blazes_claimed || 0,
          lastClaimAt,
        },
        streak: {
          data: streakData,
          claimedDays: claimedCount,
          totalDays: 7,
          currentStreakDay,
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
