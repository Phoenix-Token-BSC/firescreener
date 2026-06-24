import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redis } from '@/lib/redis';

const VOTE_COOLDOWN = 3600; // 1 hour cooldown between votes from same IP

interface VotePayload {
  tokenAddress: string;
  chain: string;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function checkVoteCooldown(ip: string, tokenAddress: string): Promise<boolean> {
  const cooldownKey = `vote:cooldown:${ip}:${tokenAddress.toLowerCase()}`;
  const lastVote = await redis.get(cooldownKey);
  return !lastVote;
}

async function recordVote(ip: string, tokenAddress: string): Promise<void> {
  const cooldownKey = `vote:cooldown:${ip}:${tokenAddress.toLowerCase()}`;
  await redis.setex(cooldownKey, VOTE_COOLDOWN, '1').catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    const body: VotePayload & { emoji?: number } = await request.json();
    const { tokenAddress, chain, emoji = 1 } = body;

    // Validation
    if (!tokenAddress || !chain) {
      return NextResponse.json(
        { error: 'Missing tokenAddress or chain' },
        { status: 400 }
      );
    }

    if (emoji < 1 || emoji > 5) {
      return NextResponse.json(
        { error: 'Emoji must be between 1 and 5' },
        { status: 400 }
      );
    }

    const normalizedAddress = tokenAddress.toLowerCase();
    const clientIp = getClientIp(request);

    // Check cooldown
    const canVote = await checkVoteCooldown(clientIp, normalizedAddress);
    if (!canVote) {
      return NextResponse.json(
        { error: 'Vote cooldown active. Please try again later.' },
        { status: 429 }
      );
    }

    // Increment emoji reaction in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const emojiField = `emoji_${emoji}`;
    const { error, data } = await supabase.rpc('increment_emoji_reaction', {
      p_contract_address: normalizedAddress,
      p_chain: chain.toLowerCase(),
      p_emoji_number: emoji,
    });

    if (error) {
      console.error('[Vote API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    // Record vote for cooldown
    await recordVote(clientIp, normalizedAddress);

    // Clear trending cache to reflect new votes
    await redis.del('trending:all:v2').catch(() => {});
    await redis.del(`votes:${normalizedAddress}`).catch(() => {});

    // Get updated reaction data
    const { data: reactionData } = await supabase
      .from('token-reactions')
      .select('emoji_1,emoji_2,emoji_3,emoji_4,emoji_5')
      .eq('contract_address', normalizedAddress)
      .single();

    const totalVotes = (reactionData?.emoji_1 || 0) + (reactionData?.emoji_2 || 0) + (reactionData?.emoji_3 || 0);

    console.log(`[Vote API] Token ${normalizedAddress} on ${chain} received emoji_${emoji}. Total positive: ${totalVotes}`);

    return NextResponse.json(
      {
        success: true,
        emoji: emoji,
        totalPositiveVotes: totalVotes,
        reactions: reactionData || {},
        message: 'Vote recorded successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Vote API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tokenAddress = request.nextUrl.searchParams.get('address');

    if (!tokenAddress) {
      return NextResponse.json(
        { error: 'Missing address parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabase
      .from('token_reactions')
      .select('emoji_1,emoji_2,emoji_3,emoji_4,emoji_5')
      .eq('contract_address', tokenAddress.toLowerCase())
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          contract_address: tokenAddress.toLowerCase(),
          totalPositiveVotes: 0,
          reactions: {
            emoji_1: 0,
            emoji_2: 0,
            emoji_3: 0,
            emoji_4: 0,
            emoji_5: 0,
          },
        },
        { status: 200 }
      );
    }

    const totalPositiveVotes = (data.emoji_1 || 0) + (data.emoji_2 || 0) + (data.emoji_3 || 0);

    return NextResponse.json(
      {
        contract_address: tokenAddress.toLowerCase(),
        totalPositiveVotes,
        reactions: {
          emoji_1: data.emoji_1 || 0,
          emoji_2: data.emoji_2 || 0,
          emoji_3: data.emoji_3 || 0,
          emoji_4: data.emoji_4 || 0,
          emoji_5: data.emoji_5 || 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Vote API GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
