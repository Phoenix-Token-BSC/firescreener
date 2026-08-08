import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

interface RouteParams {
  contractAddress: string;
}

interface AssetChainTokenResponse {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  totalSupply: string;
  exchange_rate?: string;  // Sometimes used instead of coin_price
  coin_price?: string;
  holders: string;
  type: string;
}

interface TokenMetricsResponse {
  token: string;
  contractAddress: string;
  totalSupply: string;
  holders: string;
  decimals: string;
  name: string;
  type: string;
  circulatingSupply: string;
}

interface ErrorResponse {
  error: string;
}

const ASSETCHAIN_API_BASE = "https://liquidity-pool-api.assetchain.org";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<TokenMetricsResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const { contractAddress } = params;
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();
    
    // Validate contract address format
    if (!isValidContractAddress(addressLower, 'rwa')) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    // Verify token exists in registry
    const tokenMetadata = await getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    // Verify it's an AssetChain token
    if (tokenMetadata.chain !== 'rwa') {
      return NextResponse.json({ 
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not AssetChain` 
      }, { status: 400 });
    }

    const tokenAddress = tokenMetadata.address;

    // Fetch token data from AssetChain API
    const tokenResponse = await fetch(
      `${ASSETCHAIN_API_BASE}/tokens/${tokenAddress}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!tokenResponse.ok) {
      if (tokenResponse.status === 404) {
        return NextResponse.json(
          { error: "Token not found on AssetChain" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch token data from AssetChain" },
        { status: tokenResponse.status }
      );
    }

    const tokenData: AssetChainTokenResponse = await tokenResponse.json();
 
    const tokenMetricsData: TokenMetricsResponse = {
      token: tokenData.symbol?.toUpperCase() || tokenMetadata.symbol.toUpperCase(),
      contractAddress: tokenAddress,

      totalSupply: tokenData.totalSupply || "0",
      holders: tokenData.holders || "0",
      decimals: tokenData.decimals || "18",
      name: tokenData.name || tokenMetadata.name,
      type: tokenData.type || "ERC-20",
      circulatingSupply: tokenData.totalSupply,
    };

    return NextResponse.json(tokenMetricsData);

  } catch (error) {
    console.error("Token price API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
