import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';

interface RouteParams {
  contractAddress: string;
}

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

    // Fetch supply from Solana RPC and price from DexScreener in parallel
    const [supplyInfo, dsRes] = await Promise.all([
      getSolanaTokenSupply(contractAddress),
      fetch(`${DEXSCREENER_API_URL}/${contractAddress}`),
    ]);

    if (!supplyInfo) {
      return NextResponse.json(
        { error: 'Failed to fetch token supply from Solana RPC' },
        { status: 500 }
      );
    }

    // In Solana, burned tokens are removed from total supply, so circulating ≈ total supply
    const totalSupply = supplyInfo.uiAmountString as string;
    const decimals = supplyInfo.decimals as number;

    const metrics: Record<string, unknown> = {
      totalSupply,
      circulatingSupply: totalSupply,
      lockedSupply: '0',
      burnedSupply: '0',
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      decimals: decimals.toString(),
      lastUpdated: new Date().toISOString(),
    };

    if (dsRes.ok) {
      const dsData = await dsRes.json();
      const pair = dsData?.pairs?.[0];
      if (pair?.priceUsd) {
        metrics.currentPriceUSD = pair.priceUsd;
        if (pair.marketCap) metrics.marketCap = pair.marketCap.toString();
      }
    }

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Token metrics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch token metrics' }, { status: 500 });
  }
}
