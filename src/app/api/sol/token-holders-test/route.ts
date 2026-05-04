// src/app/api/sol/token-holders-test/route.ts

import { NextRequest, NextResponse } from 'next/server';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

interface SuccessResponse {
  tokenAddress: string;
  totalHolders: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export async function GET(req: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  const { searchParams } = new URL(req.url);
  const tokenAddress = searchParams.get('tokenAddress');

  if (!tokenAddress || !isValidSolanaAddress(tokenAddress)) {
    return NextResponse.json(
      {
        error: 'Invalid or missing token address',
        details: 'Token address must be a valid Solana base58 address',
      },
      { status: 400 }
    );
  }

  if (!MORALIS_API_KEY) {
    return NextResponse.json(
      { error: 'Moralis API key not configured' },
      { status: 500 }
    );
  }

  try {
    const moralisUrl = `https://solana-gateway.moralis.io/token/mainnet/holders/${tokenAddress}/stats`;

    const res = await fetch(moralisUrl, {
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: 'Failed to fetch holder count from Moralis', details: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    const totalHolders: number = data?.totalHolders ?? data?.total ?? 0;

    return NextResponse.json({ tokenAddress, totalHolders });
  } catch (error) {
    console.error('Error fetching Solana token holders:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch token holders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
