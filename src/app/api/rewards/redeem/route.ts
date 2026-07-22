import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getBlazeUser } from '@/lib/blazeUser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, rewardId, walletAddress } = body;

    if (!userId || !rewardId) {
      return NextResponse.json(
        { error: 'Missing userId or rewardId' },
        { status: 400 }
      );
    }

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Look up the reward
    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', rewardId)
      .single();

    if (rewardError || !reward) {
      return NextResponse.json(
        { error: 'Reward not found' },
        { status: 404 }
      );
    }

    // Verify user exists and get their balance in one lookup
    const found = await getBlazeUser(supabase, userId);
    if (!found) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { table, user } = found;

    // Check if user has enough balance
    if (user.total_blazes_claimed < reward.cost) {
      return NextResponse.json(
        { error: 'Insufficient balance', balance: user.total_blazes_claimed },
        { status: 400 }
      );
    }

    // Check FCFS stock availability
    if (reward.type === 'fcfs' && reward.stock) {
      const { data: claims, error: claimsError } = await supabase
        .from('reward_claims')
        .select('id')
        .eq('reward_id', rewardId);

      if (claimsError) {
        console.error('Claims fetch error:', claimsError);
        return NextResponse.json(
          { error: 'Failed to check stock' },
          { status: 500 }
        );
      }

      const claimedCount = claims?.length || 0;
      if (claimedCount >= reward.stock) {
        return NextResponse.json(
          { error: 'Reward is sold out' },
          { status: 409 }
        );
      }
    }

    // Record the claim
    const { data: claimRow, error: claimError } = await supabase
      .from('reward_claims')
      .insert([
        {
          user_id: userId,
          reward_id: rewardId,
          cost_paid: reward.cost,
          wallet_address: walletAddress.trim(),
        },
      ])
      .select('id')
      .single();

    if (claimError) {
      console.error('Claim insert error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record claim' },
        { status: 500 }
      );
    }

    // Deduct balance. Guarded on the balance we read so concurrent redemptions
    // can't both spend the same points.
    const newBalance = user.total_blazes_claimed - reward.cost;
    const { data: updated, error: updateError } = await supabase
      .from(table)
      .update({ total_blazes_claimed: newBalance })
      .eq('id', userId)
      .eq('total_blazes_claimed', user.total_blazes_claimed)
      .select('total_blazes_claimed')
      .maybeSingle();

    if (updateError) {
      console.error('Balance update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
      );
    }

    if (!updated) {
      // Roll back the claim so a lost race doesn't record a free reward
      await supabase.from('reward_claims').delete().eq('id', claimRow.id);
      return NextResponse.json(
        { error: 'Balance changed, please try again' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully redeemed ${reward.name}`,
        balance: newBalance,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Redeem error:', error);
    return NextResponse.json(
      { error: 'An error occurred during redemption' },
      { status: 500 }
    );
  }
}
