import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from '@/lib/tokenRegistry';

const CHAIN_ID_MAP: Record<string, string> = {
    'bsc': '56',
    'sol': 'solana',
    'rwa': '56',
    'eth': '1',
};

const MORALIS_CHAIN_MAP: Record<string, string | null> = {
    bsc: '0x38',
    eth: '0x1',
    sol: 'mainnet',
    rwa: null,
};

interface RouteParams {
    chain: string;
    idenitifer: string;
}

// Helius getTokenAccounts — paginates through all holder accounts for a Solana mint.
// Uses showZeroBalance:false so only wallets with a positive balance are counted.
async function fetchHoldersFromHelius(mintAddress: string, apiKey: string): Promise<number | null> {
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    const limit = 1000;
    let page = 1;
    let total = 0;

    while (true) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: `getTokenAccounts-${page}`,
                method: 'getTokenAccounts',
                params: {
                    mint: mintAddress,
                    page,
                    limit,
                    options: { showZeroBalance: false },
                },
            }),
        });

        if (!res.ok) throw new Error(`Helius ${res.status}: ${await res.text()}`);

        const json = await res.json();

        if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`);

        const accounts: unknown[] = json?.result?.token_accounts ?? [];

        if (accounts.length === 0) break;

        total += accounts.length;

        // If the response includes a grand total, trust it and skip further pages
        const grandTotal: unknown = json?.result?.total;
        if (typeof grandTotal === 'number' && grandTotal > accounts.length && page === 1) {
            return grandTotal;
        }

        if (accounts.length < limit) break;

        page++;
        if (page > 50) break; // safety cap at 50 000 holders
    }

    return total > 0 ? total : null;
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

        // 1) Helius — primary source for Solana
        if (chainLower === 'sol') {
            const heliusKey = process.env.HELIUS_API_KEY;
            if (heliusKey) {
                try {
                    const count = await fetchHoldersFromHelius(contractAddress, heliusKey);
                    if (typeof count === 'number' && count > 0) {
                        return NextResponse.json({ holder_count: count });
                    }
                    console.warn(`Helius returned count=${count} for ${contractAddress}`);
                } catch (err) {
                    console.warn('Helius holders lookup failed:', err);
                }
            }

            // 2) Moralis Solana gateway fallback
            const moralisKey = process.env.MORALIS_API_KEY;
            if (moralisKey) {
                try {
                    const moralisUrl = `https://solana-gateway.moralis.io/token/mainnet/holders/${contractAddress}/stats`;
                    const moralisRes = await fetch(moralisUrl, {
                        headers: { accept: 'application/json', 'X-API-Key': moralisKey },
                    });
                    if (moralisRes.ok) {
                        const moralisData = await moralisRes.json();
                        const count =
                            moralisData?.total ??
                            moralisData?.totalHolders ??
                            moralisData?.result?.totalHolders ??
                            null;
                        if (typeof count === 'number' && count > 0) {
                            return NextResponse.json({ holder_count: count });
                        }
                    }
                } catch (err) {
                    console.warn('Moralis Solana holders lookup failed:', err);
                }
            }

            return NextResponse.json({ holder_count: null });
        }

        const moralisKey = process.env.MORALIS_API_KEY;
        const moralisChain = MORALIS_CHAIN_MAP[chainLower];

        // 1) Moralis for EVM chains
        if (moralisKey && moralisChain) {
            try {
                const moralisUrl = `https://deep-index.moralis.io/api/v2.2/erc20/${contractAddress}/holders?chain=${moralisChain}`;
                const moralisRes = await fetch(moralisUrl, {
                    headers: { accept: 'application/json', 'X-API-Key': moralisKey },
                });

                if (moralisRes.ok) {
                    const moralisData = await moralisRes.json();
                    const count =
                        moralisData?.total ??
                        moralisData?.totalHolders ??
                        moralisData?.result?.totalHolders ??
                        null;
                    if (typeof count === 'number' && count > 0) {
                        return NextResponse.json({ holder_count: count });
                    }
                    console.warn(`Moralis returned count=${count} for ${contractAddress}, falling back to GoPlus`);
                } else {
                    console.warn(`Moralis returned ${moralisRes.status}:`, await moralisRes.text());
                }
            } catch (err) {
                console.warn('Moralis holders lookup failed, falling back to GoPlus:', err);
            }
        }

        // 2) GoPlus fallback for EVM / RWA
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
