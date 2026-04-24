import { NextRequest, NextResponse } from 'next/server';
import { GoPlus } from '@goplus/sdk-node';
import { isValidContractAddress } from '@/lib/tokenRegistry';

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

// In-memory cache — prevents duplicate concurrent SDK calls from GoPlus + Honeypot
// components hitting the same endpoint at the same time.
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 60_000; // 1 minute

async function fetchGoPlus(goPlusChainId: string, contractAddress: string): Promise<unknown> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GoPlus API timed out after 10s')), 10_000)
    );
    const res = await Promise.race([
        GoPlus.tokenSecurity(goPlusChainId, [contractAddress]),
        timeoutPromise,
    ]);

    if (res.code !== 1) {
        throw new Error(res.message || 'GoPlus API error');
    }

    const data = res.result[contractAddress.toLowerCase()] ?? res.result[contractAddress];
    if (!data) {
        throw new Error('no_data');
    }
    return data;
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
            return NextResponse.json({ error: `Chain ${chain} not supported by GoPlus` }, { status: 400 });
        }

        if (!isValidContractAddress(contractAddress, chainLower as 'bsc' | 'sol' | 'rwa' | 'eth')) {
            return NextResponse.json({ error: 'Invalid contract address format' }, { status: 400 });
        }

        const cacheKey = `${chainLower}:${contractAddress.toLowerCase()}`;

        // Return cached result if fresh
        const cached = cache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return NextResponse.json(cached.data);
        }

        // Deduplicate concurrent in-flight requests (GoPlus + Honeypot mount simultaneously)
        let pending = inflight.get(cacheKey);
        if (!pending) {
            pending = fetchGoPlus(goPlusChainId, contractAddress).finally(() => {
                inflight.delete(cacheKey);
            });
            inflight.set(cacheKey, pending);
        }

        const data = await pending;
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
        return NextResponse.json(data);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message === 'no_data') {
            return NextResponse.json({ error: 'No security data found for this token' }, { status: 404 });
        }
        console.error('GoPlus Security API error:', message);
        return NextResponse.json(
            { error: `Failed to fetch security data: ${message}` },
            { status: 500 }
        );
    }
}
