import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

interface ReactionCount {
  [key: number]: number;
}

interface EmojiReactionsResponse {
  contractAddress: string;
  reactions: ReactionCount;
  updatedAt?: string;
}

interface ErrorResponse {
  error: string;
}

/**
 * GET /api/reactions/[contractAddress]
 * Retrieve emoji reaction counts for a specific token
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<EmojiReactionsResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const { contractAddress } = params;

    if (!contractAddress) {
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();

    // Validate using original case — Solana base58 is case-sensitive (lowercase 'l' is excluded)
    const isValidAddress =
      isValidContractAddress(contractAddress, 'bsc') ||
      isValidContractAddress(contractAddress, 'sol') ||
      isValidContractAddress(contractAddress, 'rwa') ||
      isValidContractAddress(contractAddress, 'eth');

    if (!isValidAddress) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // Query Supabase for existing reactions
    const { data, error } = await supabase
      .from('token_reactions')
      .select('emoji_1, emoji_2, emoji_3, emoji_4, emoji_5, updated_at')
      .eq('contract_address', addressLower)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected for new tokens)
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reaction data' },
        { status: 500 }
      );
    }

    // If no data exists, return default counts
    if (!data) {
      return NextResponse.json({
        contractAddress,
        reactions: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        },
      });
    }

    return NextResponse.json({
      contractAddress,
      reactions: {
        1: data.emoji_1 || 0,
        2: data.emoji_2 || 0,
        3: data.emoji_3 || 0,
        4: data.emoji_4 || 0,
        5: data.emoji_5 || 0,
      },
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error('Emoji reactions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reactions/[contractAddress]
 * Update emoji reaction counts for a specific token
 * Body: { reactions: { 1: number, 2: number, 3: number, 4: number, 5: number } }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<EmojiReactionsResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const { contractAddress } = params;

    if (!contractAddress) {
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();

    // Validate using original case — Solana base58 is case-sensitive (lowercase 'l' is excluded)
    const isValidAddress =
      isValidContractAddress(contractAddress, 'bsc') ||
      isValidContractAddress(contractAddress, 'sol') ||
      isValidContractAddress(contractAddress, 'rwa') ||
      isValidContractAddress(contractAddress, 'eth');

    if (!isValidAddress) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    const body = await request.json();
    const { reactions } = body;

    if (!reactions || typeof reactions !== 'object') {
      return NextResponse.json(
        { error: 'Invalid reactions data' },
        { status: 400 }
      );
    }

    // Validate reaction counts
    for (let i = 1; i <= 5; i++) {
      if (typeof reactions[i] !== 'number' || reactions[i] < 0) {
        return NextResponse.json(
          { error: `Invalid count for emoji ${i}` },
          { status: 400 }
        );
      }
    }

    // Upsert into Supabase
    const { data, error } = await supabase
      .from('token_reactions')
      .upsert(
        {
          contract_address: addressLower,
          emoji_1: reactions[1] || 0,
          emoji_2: reactions[2] || 0,
          emoji_3: reactions[3] || 0,
          emoji_4: reactions[4] || 0,
          emoji_5: reactions[5] || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'contract_address' }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json(
        { error: 'Failed to update reaction data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contractAddress,
      reactions: {
        1: data.emoji_1 || 0,
        2: data.emoji_2 || 0,
        3: data.emoji_3 || 0,
        4: data.emoji_4 || 0,
        5: data.emoji_5 || 0,
      },
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error('Emoji reactions POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
