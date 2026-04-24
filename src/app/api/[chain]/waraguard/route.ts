import { NextRequest, NextResponse } from 'next/server';
import { isValidContractAddress } from '@/lib/tokenRegistry';

interface RouteParams {
    chain: string;
}

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 60_000;

async function fetchWaraGuard(address: string, chain: string, apiKey: string): Promise<unknown> {
    const url = `https://api.waraguard.app/api/scan?token=${address}&chain=${chain}&key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`WaraGuard API error: ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<RouteParams> }
): Promise<NextResponse> {
    try {
        const { chain } = await context.params;
        const { searchParams } = new URL(req.url);
        const address = searchParams.get('address');

        if (!chain || !address) {
            return NextResponse.json({ error: 'Missing chain or address' }, { status: 400 });
        }

        const chainLower = chain.toLowerCase();

        if (!isValidContractAddress(address, chainLower as 'bsc' | 'sol' | 'rwa' | 'eth')) {
            return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 });
        }

        const apiKey = process.env.WARAGUARD_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'WaraGuard API key not configured' }, { status: 500 });
        }

        const cacheKey = `${chainLower}:${address.toLowerCase()}`;

        const cached = cache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return NextResponse.json(cached.data);
        }

        let pending = inflight.get(cacheKey);
        if (!pending) {
            pending = fetchWaraGuard(address, chainLower, apiKey).finally(() => {
                inflight.delete(cacheKey);
            });
            inflight.set(cacheKey, pending);
        }

        const data = await pending;
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
        return NextResponse.json(data);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('WaraGuard API error:', message);
        return NextResponse.json(
            { error: `Failed to fetch WaraGuard data: ${message}` },
            { status: 500 }
        );
    }
}
