import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

interface RouteParams {
  contractAddress: string;
}

// Token profile data mapping - maps contract addresses to profile image URLs
const TOKEN_PROFILE_MAP: Record<string, string> = {
  "0x885c99a787be6b41cbf964174c771a9f7ec48e04": "https://example.com/pht-profile.png", // PHT
  "0x6ec90334d89dbc89e08a133271be3d104128edb": "https://example.com/wkc-profile.png", // WKC
  "0x57bfe2af99aeb7a3de3bc0c42c22353742bfd20d": "https://example.com/war-profile.png", // WAR
  // Add more profile URLs as needed
};

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

    // Get profile image URL (fallback to a default if not found)
    const profileImageUrl = TOKEN_PROFILE_MAP[addressLower] || 
                           `https://via.placeholder.com/200x200?text=${tokenMetadata.symbol.toUpperCase()}`;

    const profileData = {
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      profileImage: profileImageUrl,
      logoUrl: `/api/eth/logo/${contractAddress}`,
      etherscanUrl: `https://etherscan.io/token/${contractAddress}`,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(profileData);

  } catch (error) {
    console.error('Token profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token profile' },
      { status: 500 }
    );
  }
}
