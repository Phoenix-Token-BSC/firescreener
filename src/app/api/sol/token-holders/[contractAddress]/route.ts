import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const PAGE_LIMIT = 1000;
// Safety cap: 50 pages = 50k token accounts, well above any token in the registry
const MAX_PAGES = 50;

// Holder counts change slowly, but the frontend polls every 15s and each count
// requires paginating through all token accounts on Helius — cache per mint.
const CACHE_TTL_MS = 5 * 60 * 1000;
const holderCountCache = new Map<string, { count: number; expiresAt: number }>();

interface HeliusTokenAccount {
  owner: string;
  amount: number;
}

interface RouteParams {
  contractAddress: string;
}

async function fetchHolderCount(mint: string): Promise<number> {
  const cached = holderCountCache.get(mint);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.count;
  }

  const owners = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'token-holders',
        method: 'getTokenAccounts',
        params: {
          mint,
          page,
          limit: PAGE_LIMIT,
          options: { showZeroBalance: false },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius RPC error: ${data.error.message ?? JSON.stringify(data.error)}`);
    }

    const accounts: HeliusTokenAccount[] = data?.result?.token_accounts ?? [];
    for (const account of accounts) {
      if (account.amount > 0) {
        owners.add(account.owner);
      }
    }

    if (accounts.length < PAGE_LIMIT) break;
  }

  const count = owners.size;
  holderCountCache.set(mint, { count, expiresAt: Date.now() + CACHE_TTL_MS });
  return count;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { contractAddress } = params;

    if (!contractAddress) {
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    if (!isValidContractAddress(contractAddress, 'sol')) {
      return NextResponse.json({ error: 'Invalid Solana address format' }, { status: 400 });
    }

    const tokenMetadata = getTokenByAddress(contractAddress);
    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    if (tokenMetadata.chain !== 'sol') {
      return NextResponse.json({
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not SOL`
      }, { status: 400 });
    }

    if (!HELIUS_API_KEY) {
      return NextResponse.json({ error: 'Helius API key not configured' }, { status: 500 });
    }

    const totalHolders = await fetchHolderCount(contractAddress);

    const holdersData = {
      totalHolders,
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      holders: [],
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(holdersData);

  } catch (error) {
    console.error('Token holders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch token holders' }, { status: 500 });
  }
}
