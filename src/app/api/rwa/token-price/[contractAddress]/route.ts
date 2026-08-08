import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

interface RouteParams {
  contractAddress: string;
}

interface LiquidityPoolTokenItem {
  symbol: string;
  address: string;
  usdPrice: string;
  marketCap: string;
  pastDayVolume: string;
  iconUrl: string;
  description: string;
  currentTvl: string;
}

interface LiquidityPoolApiResponse {
  items: LiquidityPoolTokenItem[];
}

interface TokenPriceResponse {
  token: string;
  contractAddress: string;
  price: string;
  marketCap: string;
  priceChangePercentage: string;
  liquidity: string;
  volume: string;
  fdv: string;
}

interface ErrorResponse {
  error: string;
}

const LIQUIDITY_POOL_API = "https://liquidity-pool-api.assetchain.org";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<TokenPriceResponse | ErrorResponse>> {
  try {
    const params = await context.params;
    const { contractAddress } = params;
    
    if (!contractAddress) {
      return NextResponse.json({ error: 'Missing contract address' }, { status: 400 });
    }

    const addressLower = contractAddress.toLowerCase();
    
    if (!isValidContractAddress(addressLower, 'rwa')) {
      return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
    }

    const tokenMetadata = await getTokenByAddress(addressLower);
    if (!tokenMetadata) {
      return NextResponse.json({ error: 'Token not found in registry' }, { status: 404 });
    }

    if (tokenMetadata.chain !== 'rwa') {
      return NextResponse.json({ 
        error: `Token is on ${tokenMetadata.chain.toUpperCase()}, not AssetChain` 
      }, { status: 400 });
    }

    const tokenAddress = tokenMetadata.address;

    // Fetch token data from Liquidity Pool API
    const apiResponse = await fetch(
      `${LIQUIDITY_POOL_API}/tokens?address=${tokenAddress}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch token data" },
        { status: apiResponse.status }
      );
    }

    const data: LiquidityPoolApiResponse = await apiResponse.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: "Token not found in Liquidity Pool" },
        { status: 404 }
      );
    }

    const tokenData = data.items[0];

    const tokenPriceData: TokenPriceResponse = {
      token: tokenData.symbol.toUpperCase(),
      contractAddress: tokenData.address,
      price: tokenData.usdPrice,
      marketCap: tokenData.marketCap,
      priceChangePercentage: "0", // Not directly available - needs historical tracking
      liquidity: tokenData.currentTvl,
      volume: tokenData.pastDayVolume,
      fdv: tokenData.marketCap,
    };

    return NextResponse.json(tokenPriceData);

  } catch (error) {
    console.error("Token price API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}