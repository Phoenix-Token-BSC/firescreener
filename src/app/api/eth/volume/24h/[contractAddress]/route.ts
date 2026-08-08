import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

interface RouteParams {
  contractAddress: string;
}

interface DexScreenerPair {
  priceUsd?: string;
  volume?: {
    h24?: string;
    h6?: string;
    h1?: string;
  };
  liquidity?: {
    usd?: string;
  };
  fdv?: number;
  marketCap?: number;
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";

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

    const addressLower = contractAddress.toLowerCase();
    
    // Validate contract address format
    if (!isValidContractAddress(addressLower, 'eth')) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // Verify token exists in registry
    const tokenMetadata = await getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    // Verify it's a ETH token
    if (tokenMetadata.chain !== 'eth') {
      return NextResponse.json({ 
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not ETH` 
      }, { status: 400 });
    }

    // Fetch volume data from DexScreener API
    const response = await fetch(`${DEXSCREENER_API_URL}/${contractAddress}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch volume data from DexScreener" },
        { status: response.status }
      );
    }

    const data: DexScreenerResponse = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      return NextResponse.json(
        { error: "No trading pairs found for this token" },
        { status: 404 }
      );
    }

    // Aggregate volume from all pairs
    let totalVolume24h = 0;
    let totalVolume6h = 0;
    let totalVolume1h = 0;

    data.pairs.forEach(pair => {
      if (pair.volume?.h24) {
        totalVolume24h += parseFloat(pair.volume.h24);
      }
      if (pair.volume?.h6) {
        totalVolume6h += parseFloat(pair.volume.h6);
      }
      if (pair.volume?.h1) {
        totalVolume1h += parseFloat(pair.volume.h1);
      }
    });

    const volumeData = {
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      volume24h: totalVolume24h.toString(),
      volume6h: totalVolume6h.toString(),
      volume1h: totalVolume1h.toString(),
      pairCount: data.pairs.length,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(volumeData);

  } catch (error) {
    console.error('24h volume API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 24h volume data' },
      { status: 500 }
    );
  }
}
