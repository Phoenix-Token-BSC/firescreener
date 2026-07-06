import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    // Verify user exists
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

    // Get user's balance
    const { data: stats, error: statsError } = await supabase
      .from('user_blaze_stats')
      .select('total_blaze_earned')
      .eq('user_id', userId)
      .single();

    if (statsError) {
      console.error('Stats fetch error:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch user balance' },
        { status: 500 }
      );
    }

    if (!stats) {
      return NextResponse.json(
        { error: 'User has no balance record' },
        { status: 400 }
      );
    }

    // Check if user has enough balance
    if (stats.total_blaze_earned < reward.cost) {
      return NextResponse.json(
        { error: 'Insufficient balance', balance: stats.total_blaze_earned },
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
    const { error: claimError } = await supabase
      .from('reward_claims')
      .insert([
        {
          user_id: userId,
          reward_id: rewardId,
          cost_paid: reward.cost,
          wallet_address: walletAddress.trim(),
        },
      ]);

    if (claimError) {
      console.error('Claim insert error:', claimError);
      return NextResponse.json(
        { error: 'Failed to record claim' },
        { status: 500 }
      );
    }

    // Deduct balance
    const newBalance = stats.total_blaze_earned - reward.cost;
    const { error: updateError } = await supabase
      .from('user_blaze_stats')
      .update({ total_blaze_earned: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Balance update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update balance' },
        { status: 500 }
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
