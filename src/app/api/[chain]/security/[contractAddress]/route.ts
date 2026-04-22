import { NextRequest, NextResponse } from 'next/server';
import { GoPlus } from '@goplus/sdk-node';
import { isValidContractAddress } from '@/lib/tokenRegistry';

// Map internal chain names to GoPlus Chain IDs
// BSC: 56
// Solana: solana
// RWA (assuming Base or similar, but GoPlus supports 56 for BSC)
const CHAIN_ID_MAP: Record<string, string> = {
    'bsc': '56',
    'sol': 'solana',
    'rwa': '56', 
    'eth': '1',
};

interface RouteParams {
    chain: string;
    contractAddress: string;
}

export async function GET(
    _req: NextRequest,
    context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
    try {
        const { chain, contractAddress } = await context.params;

        if (!chain || !contractAddress) {
            return NextResponse.json({ error: 'Missing chain or contract address' }, { status: 400 });
        }

        const chainLower = chain.toLowerCase();
        const goPlusChainId = CHAIN_ID_MAP[chainLower];

        if (!goPlusChainId) {
            return NextResponse.json({ error: `Chain ${chain} not supported by GoPlus integration` }, { status: 400 });
        }

        // Validate address format
        if (!isValidContractAddress(contractAddress, chainLower as 'bsc' | 'sol' | 'rwa' | 'eth')) {
            return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
        }

        // Call GoPlus SDK with a 10s timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GoPlus API timed out after 10s')), 10_000)
        );
        const res = await Promise.race([
            GoPlus.tokenSecurity(goPlusChainId, [contractAddress]),
            timeoutPromise,
        ]);

        if (res.code !== 1) {
            return NextResponse.json({ error: res.message || 'GoPlus API error' }, { status: 502 });
        }

        // The SDK returns a record where the key is the lowercase address
        const securityData = res.result[contractAddress.toLowerCase()] ?? res.result[contractAddress];

        if (!securityData) {
            return NextResponse.json({ error: 'No security data found for this token' }, { status: 404 });
        }

        return NextResponse.json(securityData);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GoPlus Security API error:', message);
        return NextResponse.json(
            { error: `Failed to fetch security data: ${message}` },
            { status: 500 }
        );
    }
}
