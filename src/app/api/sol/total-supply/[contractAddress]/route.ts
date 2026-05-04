import { NextRequest, NextResponse } from 'next/server';
import { getTokenByAddress, isValidContractAddress } from '@/lib/tokenRegistry';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

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

    const res = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenSupply',
        params: [contractAddress],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Solana RPC request failed' }, { status: 500 });
    }

    const data = await res.json();
    const value = data?.result?.value;

    if (!value) {
      return NextResponse.json({ error: 'Token not found on Solana' }, { status: 404 });
    }

    const supplyData = {
      totalSupply: value.uiAmountString as string,
      totalSupplyRaw: value.amount as string,
      contractAddress,
      symbol: tokenMetadata.symbol,
      name: tokenMetadata.name,
      decimals: (value.decimals as number).toString(),
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(supplyData);

  } catch (error) {
    console.error('Total supply API error:', error);
    return NextResponse.json({ error: 'Failed to fetch total supply' }, { status: 500 });
  }
}
