import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from '@/lib/tokenRegistry';

const CHAIN_ID_MAP: Record<string, string> = {
    'bsc': '56',
    'sol': 'solana',
    'rwa': '56',
    'eth': '1',
};

// Moralis uses hex chain IDs for EVM, separate gateway for Solana
const MORALIS_CHAIN_MAP: Record<string, string | null> = {
    bsc: '0x38',
    eth: '0x1',
    sol: 'mainnet', // uses separate Solana gateway
    rwa: null,      // custom chain, not supported
};

interface RouteParams {
    chain: string;
    idenitifer: string;
}

export async function GET(
    _req: NextRequest,
    context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
    try {
        const { chain, idenitifer: contractAddress } = await context.params;

        if (!chain || !contractAddress) {
            return NextResponse.json({ error: 'Missing chain or contract address' }, { status: 400 });
        }

        const chainLower = chain.toLowerCase();
        const goPlusChainId = CHAIN_ID_MAP[chainLower];

        if (!goPlusChainId) {
            return NextResponse.json({ error: `Chain ${chain} not supported` }, { status: 400 });
        }

        if (!isValidContractAddress(contractAddress, chainLower as 'bsc' | 'sol' | 'rwa' | 'eth')) {
            return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 });
        }

        const moralisKey = process.env.MORALIS_API_KEY;
        const moralisChain = MORALIS_CHAIN_MAP[chainLower];

        // 1) Try Moralis
        if (moralisKey && moralisChain) {
            try {
                let moralisUrl: string;

                if (chainLower === 'sol') {
                    // Solana uses a different Moralis gateway and endpoint
                    moralisUrl = `https://solana-gateway.moralis.io/token/${moralisChain}/holders/${contractAddress}/stats`;
                } else {
                    // EVM chains (ETH, BSC)
                    moralisUrl = `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/holders?chain=${moralisChain}`;
                }

                const moralisRes = await fetch(moralisUrl, {
                    headers: {
                        accept: 'application/json',
                        'X-API-Key': moralisKey,
                    },
                });

                if (moralisRes.ok) {
                    const moralisData = await moralisRes.json();

                    // /holders returns: { total: number, result: [...] }
                    const count =
                        moralisData?.total ??
                        moralisData?.totalHolders ??
                        moralisData?.result?.totalHolders ??
                        null;

                    if (typeof count === 'number' && count > 0) {
                        return NextResponse.json({ holder_count: count });
                    }

                    console.warn(`Moralis returned count=${count} for ${contractAddress}, falling back to GoPlus`);
                }
                else {
                    const errBody = await moralisRes.text();
                    console.warn(`Moralis returned ${moralisRes.status}:`, errBody);
                }
            } catch (err) {
                console.warn('Moralis holders lookup failed, falling back to GoPlus:', err);
            }
        }

        // 2) Fallback: GoPlus Token Security API (v1)
        //    Handles all chains including RWA, and covers gaps from Moralis
        const apiUrl = `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${contractAddress}`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.code !== 1) {
            console.error('GoPlus API Error Response:', data);
            return NextResponse.json({ error: data.message || 'GoPlus API error', details: data }, { status: 500 });
        }

        const tokenData = data.result?.[contractAddress.toLowerCase()];
        const holder_count = tokenData?.holder_count ?? null;

        return NextResponse.json({ holder_count });

    } catch (error) {
        console.error('Holder count API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch holder count' },
            { status: 500 }
        );
    }
}