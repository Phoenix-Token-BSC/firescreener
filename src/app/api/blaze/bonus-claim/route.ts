import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  BONUS_REWARDS,
  hasClaimedToday,
  isBonusClaimWindow,
  isBonusDay,
  isDayClaimed,
  isStreakBroken,
  withDayClaimed,
} from '@/lib/blaze';
import { getBlazeUser } from '@/lib/blazeUser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    const dayNumber = Number(body.dayNumber);

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!isBonusDay(dayNumber)) {
      return NextResponse.json(
        { error: 'Bonus rewards are only available on day 3 and day 7' },
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
    const claimedToday = hasClaimedToday(user.blaze_last_claim_at, now);
    const streakBroken = isStreakBroken(user.blaze_last_claim_at, now);
    const currentStreakDay = user.blaze_streak_day;
    const boardWasReset =
      streakBroken ||
      (!claimedToday && currentStreakDay === 1 && isDayClaimed(user.blaze_claimed_days, 1));

    if (boardWasReset) {
      return NextResponse.json(
        { error: 'This bonus is no longer available for the current streak' },
        { status: 400 }
      );
    }

    if (
      !isBonusClaimWindow(
        dayNumber,
        currentStreakDay,
        claimedToday,
        isDayClaimed(user.blaze_claimed_days, dayNumber),
        boardWasReset
      )
    ) {
      return NextResponse.json(
        {
          error: `Day ${dayNumber} bonus can only be claimed on the same day you claim daily day ${dayNumber}`,
        },
        { status: 400 }
      );
    }

    if (isDayClaimed(user.blaze_bonus_claimed_days, dayNumber)) {
      return NextResponse.json(
        { error: 'Bonus already claimed' },
        { status: 400 }
      );
    }

    const amount = BONUS_REWARDS[dayNumber];
    const newBalance = (user.total_blazes_claimed || 0) + amount;

    // Guarded write: the bonus-mask condition makes concurrent claims lose the
    // race instead of double-crediting.
    const { data: updated, error: claimError } = await supabase
      .from(table)
      .update({
        blaze_bonus_claimed_days: withDayClaimed(user.blaze_bonus_claimed_days, dayNumber),
        total_blazes_claimed: newBalance,
      })
      .eq('id', userId)
      .eq('blaze_bonus_claimed_days', user.blaze_bonus_claimed_days)
      .select('total_blazes_claimed')
      .maybeSingle();

    if (claimError) {
      console.error('Bonus claim update error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record bonus claim' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Bonus already claimed' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully claimed ${amount} bonus BLAZE points - Day ${dayNumber} Bonus`,
        claim: {
          id: `${userId}-bonus-${dayNumber}`,
          dayNumber,
          amount,
          claimedAt: now.toISOString(),
        },
        balance: updated.total_blazes_claimed,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Bonus claim error:', error);
    return NextResponse.json(
      { error: 'An error occurred during bonus claim' },
      { status: 500 }
    );
  }
}
