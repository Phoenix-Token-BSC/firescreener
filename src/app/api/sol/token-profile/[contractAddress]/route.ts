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

    const profileImageUrl = `https://via.placeholder.com/200x200?text=${tokenMetadata.symbol.toUpperCase()}`;

    const profileData = {
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      profileImage: profileImageUrl,
      logoUrl: `/api/sol/logo/${contractAddress}`,
      solscanUrl: `https://solscan.io/token/${contractAddress}`,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(profileData);

  } catch (error) {
    console.error('Token profile API error:', error);
    return NextResponse.json({ error: 'Failed to fetch token profile' }, { status: 500 });
  }
}
