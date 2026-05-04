import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';

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

    const res = await fetch(`${DEXSCREENER_API_URL}/${contractAddress}`);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch price data from DexScreener' },
        { status: res.status }
      );
    }

    const data = await res.json();
    const pair = data?.pairs?.[0];

    if (!pair) {
      return NextResponse.json({ error: 'No trading pairs found for this token' }, { status: 404 });
    }

    return NextResponse.json({
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      currentPriceUSD: pair.priceUsd ?? null,
      marketCap: pair.marketCap?.toString() ?? null,
      fdv: pair.fdv?.toString() ?? null,
      liquidity: pair.liquidity?.usd ?? null,
      volume24h: pair.volume?.h24 ?? null,
      priceChange24h: pair.priceChange?.h24 ?? null,
      priceChange6h: pair.priceChange?.h6 ?? null,
      priceChange1h: pair.priceChange?.h1 ?? null,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Price data API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price data' }, { status: 500 });
  }
}
