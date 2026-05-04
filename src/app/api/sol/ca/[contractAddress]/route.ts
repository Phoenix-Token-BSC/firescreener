import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
  contractAddress: string;
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

    const contractData = {
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      chain: 'sol',
      network: 'Solana',
      solscanUrl: `https://solscan.io/token/${contractAddress}`,
      jupiterUrl: `https://jup.ag/swap/SOL-${contractAddress}`,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(contractData);

  } catch (error) {
    console.error('Contract address API error:', error);
    return NextResponse.json({ error: 'Failed to fetch contract data' }, { status: 500 });
  }
}
