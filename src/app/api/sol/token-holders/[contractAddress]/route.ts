import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

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

    if (!MORALIS_API_KEY) {
      return NextResponse.json({ error: 'Moralis API key not configured' }, { status: 500 });
    }

    // Solana uses a separate Moralis gateway
    const moralisUrl = `https://solana-gateway.moralis.io/token/mainnet/holders/${contractAddress}/stats`;

    const response = await fetch(moralisUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Moralis Solana API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch token holders data' },
        { status: response.status }
      );
    }

    const data = await response.json();

    const holdersData = {
      totalHolders: data?.totalHolders ?? data?.total ?? 0,
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
