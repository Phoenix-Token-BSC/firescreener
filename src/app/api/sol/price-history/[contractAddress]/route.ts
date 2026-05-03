import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

interface PriceDataPoint {
  date: string;
  priceUSD: string;
  volume: string;
}

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function getSolanaTokenSupply(mintAddress: string) {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenSupply',
      params: [mintAddress],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.result?.value ?? null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { contractAddress } = params;

    const searchParams = req.nextUrl.searchParams;
    const includePriceHistory = searchParams.get('priceHistory') === 'true';

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

    // Fetch supply and DexScreener data in parallel
    const [supplyInfo, dsRes] = await Promise.all([
      getSolanaTokenSupply(contractAddress),
      fetch(`${DEXSCREENER_API_URL}/${contractAddress}`),
    ]);

    const metrics: Record<string, unknown> = {
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      totalSupply: supplyInfo?.uiAmountString ?? 'N/A',
      circulatingSupply: supplyInfo?.uiAmountString ?? 'N/A',
      lockedSupply: '0',
      burnedSupply: '0',
      decimals: supplyInfo?.decimals?.toString() ?? '9',
      currentPriceUSD: null as string | null,
      marketCap: null as string | null,
      lastUpdated: new Date().toISOString(),
    };

    let currentPrice: string | null = null;

    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const pair = dsData?.pairs?.[0];
      if (pair) {
        currentPrice = pair.priceUsd ?? null;
        metrics.currentPriceUSD = currentPrice;
        if (pair.marketCap) metrics.marketCap = pair.marketCap.toString();
      }
    }

    if (includePriceHistory && dsRes.ok) {
      // Build a synthetic price history from DexScreener pairs data
      // DexScreener doesn't expose historical OHLCV in the public /tokens endpoint,
      // so we return a single current data point. Pair-specific OHLCV can be
      // obtained from /dex/candles/{pairId} with the chart component directly.
      const priceHistory: PriceDataPoint[] = currentPrice
        ? [{
            date: new Date().toISOString().split('T')[0],
            priceUSD: currentPrice,
            volume: '0',
          }]
        : [];
      metrics.priceHistory = priceHistory;
    }

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Price history API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price history' }, { status: 500 });
  }
}
