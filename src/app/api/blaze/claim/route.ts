import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  DAILY_REWARD,
  hasClaimedToday,
  isDayClaimed,
  isStreakBroken,
  timeUntilNextUtcMidnight,
  withDayClaimed,
} from '@/lib/blaze';
import { getBlazeUser, logBlazeClaimEvent } from '@/lib/blazeUser';

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

    const found = await getBlazeUser(supabase, userId);
    if (!found) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { table, user } = found;
    const now = new Date();

    // One claim per calendar day — resets at 00:00 UTC
    if (hasClaimedToday(user.blaze_last_claim_at, now)) {
      const { hours, minutes } = timeUntilNextUtcMidnight(now);

      console.log(`[DEBUG] Daily claim already used. Last claim: ${user.blaze_last_claim_at}, resets in ${hours}h ${minutes}m`);

      return NextResponse.json(
        {
          error: 'Already claimed today',
          nextClaimAvailableIn: `${hours}h ${minutes}m`,
        },
        { status: 429 }
      );
    }

    let currentDay = user.blaze_streak_day;
    let claimedDays = user.blaze_claimed_days;
    let bonusClaimedDays = user.blaze_bonus_claimed_days;

    // Missed a day — streak goes back to day 1 with a fresh board
    if (isStreakBroken(user.blaze_last_claim_at, now)) {
      console.log(`[BLAZE] Streak broken for user ${userId} (last claim: ${user.blaze_last_claim_at}), resetting to day 1`);
      currentDay = 1;
      claimedDays = 0;
      bonusClaimedDays = 0;
    }

    if (isDayClaimed(claimedDays, currentDay)) {
      if (currentDay === 1) {
        // Completed a full 7-day cycle with the streak intact — start a fresh board
        console.log(`[BLAZE] User ${userId} starting a new 7-day cycle`);
        claimedDays = 0;
        bonusClaimedDays = 0;
      } else {
        return NextResponse.json(
          { error: 'Day already claimed' },
          { status: 400 }
        );
      }
    }

    const nextDay = currentDay === 7 ? 1 : currentDay + 1;
    const newBalance = (user.total_blazes_claimed || 0) + DAILY_REWARD;

    // Single guarded write: the blaze_last_claim_at condition makes concurrent
    // claims lose the race instead of double-crediting, and the balance
    // condition makes a write computed from a stale balance (e.g. a redeem
    // landed in between) fail instead of overwriting the other route's update.
    let update = supabase
      .from(table)
      .update({
        blaze_claimed_days: withDayClaimed(claimedDays, currentDay),
        blaze_bonus_claimed_days: bonusClaimedDays,
        blaze_streak_day: nextDay,
        blaze_last_claim_at: now.toISOString(),
        total_blazes_claimed: newBalance,
      })
      .eq('id', userId)
      .eq('total_blazes_claimed', user.total_blazes_claimed);

    update = user.blaze_last_claim_at === null
      ? update.is('blaze_last_claim_at', null)
      : update.eq('blaze_last_claim_at', user.blaze_last_claim_at);

    const { data: updated, error: claimError } = await update
      .select('total_blazes_claimed')
      .maybeSingle();

    if (claimError) {
      console.error('Claim update error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record claim' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Already claimed today' },
        { status: 429 }
      );
    }

    await logBlazeClaimEvent(supabase, {
      userId,
      kind: 'daily',
      dayNumber: currentDay,
      amount: DAILY_REWARD,
      claimedAt: now.toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: `Successfully claimed ${DAILY_REWARD} BLAZE points - Day ${currentDay}`,
        claim: {
          id: `${userId}-day-${currentDay}`,
          dayNumber: currentDay,
          amount: DAILY_REWARD,
          claimedAt: now.toISOString(),
        },
        balance: updated.total_blazes_claimed,
        nextDay,
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
