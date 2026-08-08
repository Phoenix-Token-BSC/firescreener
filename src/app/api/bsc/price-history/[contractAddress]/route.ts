import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

// Configure for BNB Chain
const RPC_URL: string = "https://bsc-mainnet.nodereal.io/v1/d4c10295e10c445d876d1ffd4a78810c";
const DEAD_ADDRESS: string = "0x000000000000000000000000000000000000dEaD";
const LOCKED_ADDRESSES: string[] = process.env.LOCKED_ADDRESSES ? process.env.LOCKED_ADDRESSES.split(',') : [];
const PANCAKESWAP_SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2";

interface RouteParams {
  contractAddress: string;
}

interface PriceDataPoint {
  date: string;
  priceUSD: string;
  volume: string;
}

// ERC-20 ABI for basic token functions
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

/**
 * Fetch price history from PancakeSwap subgraph
 */
async function fetchPriceHistory(tokenAddress: string, days: number = 90): Promise<PriceDataPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - (days * 24 * 60 * 60);

  // GraphQL query to fetch token day data
  const query = `
    {
      tokenDayDatas(
        first: ${days}
        orderBy: date
        orderDirection: desc
        where: {
          token: "${tokenAddress.toLowerCase()}"
          date_gte: ${startTime}
        }
      ) {
        date
        priceUSD
        dailyVolumeUSD
        totalLiquidityUSD
      }
    }
  `;

  try {
    const response = await fetch(PANCAKESWAP_SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    // Transform and sort data (oldest to newest)
    const priceHistory: PriceDataPoint[] = (data.data?.tokenDayDatas || [])
      .map((dayData: any) => ({
        date: new Date(dayData.date * 1000).toISOString().split('T')[0],
        priceUSD: parseFloat(dayData.priceUSD).toFixed(8),
        volume: parseFloat(dayData.dailyVolumeUSD).toFixed(2),
        liquidity: parseFloat(dayData.totalLiquidityUSD).toFixed(2)
      }))
      .reverse(); // Reverse to get chronological order

    return priceHistory;
  } catch (error) {
    console.error('Error fetching price history:', error);
    return [];
  }
}

/**
 * Get current token price from subgraph
 */
async function getCurrentPrice(tokenAddress: string): Promise<string | null> {
  const query = `
    {
      token(id: "${tokenAddress.toLowerCase()}") {
        derivedUSD
        symbol
        name
      }
    }
  `;

  try {
    const response = await fetch(PANCAKESWAP_SUBGRAPH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.errors || !data.data?.token) {
      return null;
    }

    return parseFloat(data.data.token.derivedUSD).toFixed(8);
  } catch (error) {
    console.error('Error fetching current price:', error);
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const { contractAddress } = params;
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const includePriceHistory = searchParams.get('priceHistory') === 'true';
    const days = Math.min(parseInt(searchParams.get('days') || '90'), 90); // Max 90 days
    
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

    // Connect to BSC network
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

    // Get token metrics and price data in parallel
    const [totalSupply, decimals, deadBalance, currentPrice] = await Promise.all([
      tokenContract.totalSupply(),
      tokenContract.decimals(),
      tokenContract.balanceOf(DEAD_ADDRESS),
      getCurrentPrice(addressLower)
    ]);

    // Get locked balances
    let totalLocked = BigInt(0);
    if (LOCKED_ADDRESSES.length > 0) {
      const lockedBalances = await Promise.all(
        LOCKED_ADDRESSES.map(address => tokenContract.balanceOf(address))
      );
      totalLocked = lockedBalances.reduce((sum, balance) => sum + BigInt(balance.toString()), BigInt(0));
    }

    // Calculate metrics
    const totalSupplyBN = BigInt(totalSupply.toString());
    const deadBalanceBN = BigInt(deadBalance.toString());
    const circulatingSupply = totalSupplyBN - deadBalanceBN - totalLocked;

    // Format numbers (convert from wei to token units)
    const divisor = BigInt(10) ** BigInt(decimals);
    
    const metrics: any = {
      totalSupply: (totalSupplyBN / divisor).toString(),
      circulatingSupply: (circulatingSupply / divisor).toString(),
      lockedSupply: (totalLocked / divisor).toString(),
      burnedSupply: (deadBalanceBN / divisor).toString(),
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      decimals: decimals.toString(),
      currentPriceUSD: currentPrice,
      lastUpdated: new Date().toISOString()
    };

    // Add market cap if price is available
    if (currentPrice) {
      const circulatingSupplyNum = Number(circulatingSupply / divisor);
      metrics.marketCap = (circulatingSupplyNum * parseFloat(currentPrice)).toFixed(2);
    }

    // Fetch price history if requested
    if (includePriceHistory) {
      const priceHistory = await fetchPriceHistory(addressLower, days);
      metrics.priceHistory = priceHistory;
      metrics.priceHistoryDays = days;
    }

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Token metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metrics' },
      { status: 500 }
    );
  }
}