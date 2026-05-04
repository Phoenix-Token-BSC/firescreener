import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

type FormattedTransaction = {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  transactionHash: string;
};

// Solana burn address (tokens sent here are considered burned)
const SOLANA_BURN_ADDRESS = '1nc1nerator11111111111111111111111111111111';

const SOLSCAN_API_URL = 'https://public-api.solscan.io';
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;

function formatTimeAgo(timestamp: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];
  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
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

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'BurnTracker/1.0',
    };
    if (SOLSCAN_API_KEY) headers['token'] = SOLSCAN_API_KEY;

    // Query SPL token transfers to the Solana burn address
    const url = `${SOLSCAN_API_URL}/account/token/txs?account=${SOLANA_BURN_ADDRESS}&token=${contractAddress}&offset=0&limit=50`;

    const response = await fetch(url, { headers });

    // If SolScan returns an error or is unavailable, return empty burn history gracefully
    if (!response.ok) {
      const emptyData = {
        contractAddress,
        symbol: tokenMetadata.symbol,
        name: tokenMetadata.name,
        burnHistory: [],
        totalBurnEvents: 0,
        totalBurned: '0',
        lastUpdated: new Date().toISOString(),
      };
      return NextResponse.json(emptyData);
    }

    const data = await response.json();
    const txList: Array<Record<string, unknown>> = Array.isArray(data?.data) ? data.data : [];

    const decimals = tokenMetadata.decimals ?? 9;
    const divisor = Math.pow(10, decimals);

    const transactions: FormattedTransaction[] = txList.map((tx) => {
      const raw = typeof tx.amount === 'number' ? tx.amount : 0;
      const amount = raw / divisor;
      const ts = typeof tx.blockTime === 'number' ? new Date(tx.blockTime * 1000) : new Date();
      return {
        from: (tx.from as string) || '',
        to: SOLANA_BURN_ADDRESS,
        amount,
        timestamp: formatTimeAgo(ts),
        transactionHash: (tx.txHash as string) || '',
      };
    });

    const totalBurned = transactions.reduce((sum, t) => sum + (isFinite(t.amount) ? t.amount : 0), 0);

    return NextResponse.json({
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      burnHistory: transactions,
      totalBurnEvents: transactions.length,
      totalBurned: totalBurned.toString(),
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    const typedError = error as Error;
    console.error('Burn history API error:', typedError.message);
    return NextResponse.json(
      { error: 'Failed to fetch burn history', message: typedError.message },
      { status: 500 }
    );
  }
}
