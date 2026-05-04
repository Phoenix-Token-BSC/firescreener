import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
}

interface DexScreenerPair {
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  quoteToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  priceUsd?: string;
  volume?: {
    h24?: string;
    h6?: string;
    h1?: string;
  };
  liquidity?: {
    usd?: string;
  };
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

    // Fetch DEX data from DexScreener API
    const response = await fetch(`${DEXSCREENER_API_URL}/${contractAddress}`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch DEX data from DexScreener" },
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

    // Group pairs by DEX and calculate volumes
    const dexVolumes: Record<string, {
      dexId: string;
      volume24h: number;
      volume6h: number;
      volume1h: number;
      liquidity: number;
      pairCount: number;
      pairs: Array<{
        pairAddress: string;
        baseToken: string;
        quoteToken: string;
        volume24h: string;
        liquidity: string;
        url?: string;
      }>;
    }> = {};

    data.pairs.forEach(pair => {
      const dexId = pair.dexId || 'unknown';
      
      if (!dexVolumes[dexId]) {
        dexVolumes[dexId] = {
          dexId,
          volume24h: 0,
          volume6h: 0,
          volume1h: 0,
          liquidity: 0,
          pairCount: 0,
          pairs: []
        };
      }

      // Add volumes
      if (pair.volume?.h24) {
        dexVolumes[dexId].volume24h += parseFloat(pair.volume.h24);
      }
      if (pair.volume?.h6) {
        dexVolumes[dexId].volume6h += parseFloat(pair.volume.h6);
      }
      if (pair.volume?.h1) {
        dexVolumes[dexId].volume1h += parseFloat(pair.volume.h1);
      }
      if (pair.liquidity?.usd) {
        dexVolumes[dexId].liquidity += parseFloat(pair.liquidity.usd);
      }

      dexVolumes[dexId].pairCount++;
      dexVolumes[dexId].pairs.push({
        pairAddress: pair.pairAddress || '',
        baseToken: pair.baseToken?.symbol || '',
        quoteToken: pair.quoteToken?.symbol || '',
        volume24h: pair.volume?.h24 || '0',
        liquidity: pair.liquidity?.usd || '0',
        url: pair.url
      });
    });

    const dexData = {
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      totalPairs: data.pairs.length,
      dexes: Object.values(dexVolumes).map(dex => ({
        ...dex,
        volume24h: dex.volume24h.toString(),
        volume6h: dex.volume6h.toString(),
        volume1h: dex.volume1h.toString(),
        liquidity: dex.liquidity.toString()
      })),
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(dexData);

  } catch (error) {
    console.error('DEX volume API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DEX volume data' },
      { status: 500 }
    );
  }
}
