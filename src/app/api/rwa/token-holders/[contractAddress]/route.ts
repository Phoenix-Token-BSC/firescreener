import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

const MORALIS_API_URL = 'https://deep-index.moralis.io/api/v2.2/erc20';
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;

interface RouteParams {
  contractAddress: string;
}

// interface MoralisHoldersResponse {
//   totalHolders: number;
//   holders: Array<{
//     address: string;
//     balance: string;
//     percentage: number;
//   }>;
// }

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
    if (!isValidContractAddress(addressLower, 'bsc')) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // Verify token exists in registry
    const tokenMetadata = await getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    // Verify it's a BSC token
    if (tokenMetadata.chain !== 'bsc') {
      return NextResponse.json({ 
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not BSC` 
      }, { status: 400 });
    }

    if (!MORALIS_API_KEY) {
      return NextResponse.json({ error: 'Moralis API key not configured' }, { status: 500 });
    }

    // Fetch token holders from Moralis
    const moralisUrl = `${MORALIS_API_URL}/${contractAddress}/owners?chain=bsc&limit=100`;
    
    const response = await fetch(moralisUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': MORALIS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Moralis API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch token holders data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform the response to match expected format
    const holdersData = {
      totalHolders: data.total || 0,
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      holders: data.result?.slice(0, 10).map((holder: any) => ({
        address: holder.owner_address,
        balance: holder.balance,
        percentage: holder.percentage_relative_to_total_supply || 0
      })) || [],
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(holdersData);

  } catch (error) {
    console.error('Token holders API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token holders' },
      { status: 500 }
    );
  }
}
