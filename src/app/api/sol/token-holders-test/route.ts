// src/app/api/sol/token-holders-test/route.ts

import { NextRequest, NextResponse } from 'next/server';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const PAGE_LIMIT = 1000;
const MAX_PAGES = 50;

interface SuccessResponse {
  tokenAddress: string;
  totalHolders: number;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface HeliusTokenAccount {
  owner: string;
  amount: number;
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

  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { error: 'Helius API key not configured' },
      { status: 500 }
    );
  }

  try {
    const owners = new Set<string>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-holders-test',
          method: 'getTokenAccounts',
          params: {
            mint: tokenAddress,
            page,
            limit: PAGE_LIMIT,
            options: { showZeroBalance: false },
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: 'Failed to fetch holder count from Helius', details: errText },
          { status: res.status }
        );
      }

      const data = await res.json();
      if (data.error) {
        return NextResponse.json(
          { error: 'Helius RPC error', details: data.error.message ?? JSON.stringify(data.error) },
          { status: 502 }
        );
      }

      const accounts: HeliusTokenAccount[] = data?.result?.token_accounts ?? [];
      for (const account of accounts) {
        if (account.amount > 0) {
          owners.add(account.owner);
        }
      }

      if (accounts.length < PAGE_LIMIT) break;
    }

    return NextResponse.json({ tokenAddress, totalHolders: owners.size });
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
