import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { BONUS_REWARDS, hasClaimedToday, isStreakBroken } from '@/lib/blaze';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, dayNumber } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!BONUS_REWARDS[dayNumber]) {
      return NextResponse.json(
        { error: 'Invalid bonus day' },
        { status: 400 }
      );
    }

    const [
      { data: regularUser },
      { data: devUser },
      { data: stats, error: statsError },
      { data: dailyClaims, error: claimsError },
      { data: bonusRows, error: bonusFetchError },
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
        .select('day_number, is_claimed')
        .eq('user_id', userId),
      supabase
        .from('blaze_bonus_claims')
        .select('day_number, amount, is_claimed')
        .eq('user_id', userId),
    ]);

    if (!regularUser && !devUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (statsError || claimsError) {
      console.error('Bonus claim fetch error:', statsError || claimsError);
      return NextResponse.json(
        { error: 'Failed to fetch claim status' },
        { status: 500 }
      );
    }

    if (bonusFetchError) {
      console.error('Bonus claims fetch error (is the blaze_bonus_claims table created?):', bonusFetchError);
      return NextResponse.json(
        { error: 'Failed to fetch bonus claims', details: bonusFetchError.message },
        { status: 500 }
      );
    }

    if (!stats) {
      return NextResponse.json(
        { error: `Claim day ${dayNumber} of the daily streak first` },
        { status: 400 }
      );
    }

    const now = new Date();

    // The daily board resets lazily on the next daily claim — mirror those
    // conditions here so a stale board can't unlock an expired bonus.
    if (isStreakBroken(stats.last_claim_at, now)) {
      return NextResponse.json(
        { error: 'Streak was broken — this bonus is no longer available' },
        { status: 400 }
      );
    }

    const dayOneRow = dailyClaims?.find((c) => c.day_number === 1);
    if (!hasClaimedToday(stats.last_claim_at, now) && stats.current_streak_day === 1 && dayOneRow?.is_claimed) {
      return NextResponse.json(
        { error: 'A new cycle is starting — this bonus is no longer available' },
        { status: 400 }
      );
    }

    const dailyRow = dailyClaims?.find((c) => c.day_number === dayNumber);
    if (!dailyRow?.is_claimed) {
      return NextResponse.json(
        { error: `Claim day ${dayNumber} of the daily streak first` },
        { status: 400 }
      );
    }

    // Auto-initialize bonus rows on first use
    let bonusRow = bonusRows?.find((b) => b.day_number === dayNumber);
    if (!bonusRow) {
      const missingRows = Object.entries(BONUS_REWARDS)
        .filter(([day]) => !bonusRows?.some((b) => b.day_number === Number(day)))
        .map(([day, amount]) => ({
          user_id: userId,
          day_number: Number(day),
          amount,
          is_claimed: false,
          claimed_at: null,
        }));

      const { error: initError } = await supabase
        .from('blaze_bonus_claims')
        .insert(missingRows);

      if (initError) {
        console.error('Failed to initialize bonus claims:', initError);
        return NextResponse.json(
          { error: 'Failed to initialize bonus claims' },
          { status: 500 }
        );
      }

      bonusRow = { day_number: dayNumber, amount: BONUS_REWARDS[dayNumber], is_claimed: false };
    }

    if (bonusRow.is_claimed) {
      return NextResponse.json(
        { error: 'Bonus already claimed' },
        { status: 400 }
      );
    }

    // Mark as claimed — the is_claimed guard makes concurrent claims a no-op
    const { data: claimedRow, error: claimError } = await supabase
      .from('blaze_bonus_claims')
      .update({
        is_claimed: true,
        claimed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
      .eq('day_number', dayNumber)
      .eq('is_claimed', false)
      .select()
      .maybeSingle();

    if (claimError) {
      console.error('Bonus claim update error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record bonus claim' },
        { status: 500 }
      );
    }

    if (!claimedRow) {
      return NextResponse.json(
        { error: 'Bonus already claimed' },
        { status: 400 }
      );
    }

    // Credit the points (no DB trigger on this table)
    const newBalance = (stats.total_blaze_earned || 0) + claimedRow.amount;
    const { error: balanceError } = await supabase
      .from('user_blaze_stats')
      .update({ total_blaze_earned: newBalance })
      .eq('user_id', userId);

    if (balanceError) {
      console.error('Bonus balance update error:', balanceError);
      return NextResponse.json(
        { error: 'Failed to credit bonus points' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully claimed ${claimedRow.amount} bonus BLAZE points - Day ${dayNumber} Bonus`,
        claim: {
          id: claimedRow.id,
          dayNumber: claimedRow.day_number,
          amount: claimedRow.amount,
          claimedAt: claimedRow.claimed_at,
        },
        balance: newBalance,
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
