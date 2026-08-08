import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from "@/lib/tokenRegistry";
import { getToken as getTokenByAddress } from "@/lib/tokenRegistry.server";

// Configure for BNB Chain
const RPC_URL: string = "https://bsc-dataseed.binance.org/";
const DEAD_ADDRESS: string = "0x000000000000000000000000000000000000dEaD";
const LOCKED_ADDRESSES: string[] = process.env.LOCKED_ADDRESSES ? process.env.LOCKED_ADDRESSES.split(',') : [];

interface RouteParams {
  contractAddress: string;
}

// ERC-20 ABI for basic token functions
const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

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

    // Connect to BSC network
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tokenContract = new ethers.Contract(contractAddress, ERC20_ABI, provider);

    // Get token metrics
    const [totalSupply, decimals, deadBalance] = await Promise.all([
      tokenContract.totalSupply(),
      tokenContract.decimals(),
      tokenContract.balanceOf(DEAD_ADDRESS)
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
    
    const metrics = {
      totalSupply: (totalSupplyBN / divisor).toString(),
      circulatingSupply: (circulatingSupply / divisor).toString(),
      lockedSupply: (totalLocked / divisor).toString(),
      burnedSupply: (deadBalanceBN / divisor).toString(),
      contractAddress: contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      decimals: decimals.toString(),
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json(metrics);

  } catch (error) {
    console.error('Token metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token metrics' },
      { status: 500 }
    );
  }
}
