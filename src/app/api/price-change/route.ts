import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_REGISTRY, TokenMetadata } from '@/lib/tokenRegistry';

// ── Types ──────────────────────────────────────────────────────────────

interface DexScreenerPair {
  baseToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  chainId?: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  volume?: { h24?: string };
  priceChange?: {
    h24?: string;
    h6?: string;
    h3?: string;
    h1?: string;
  };
  liquidity?: { usd?: string };
}

interface DexScreenerResponse {
  pairs?: DexScreenerPair[];
}

export interface PriceChangeToken {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  price: string;
  change1h: string;
  change3h: string;
  change6h: string;
  change24h: string;
  volume24h: string;
  marketCap: string;
  liquidity: string;
}

interface PriceChangeResponse {
  tokens: PriceChangeToken[];
  updatedAt: string;
}

// ── In‑memory cache ────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds
let cachedResponse: PriceChangeResponse | null = null;
let cacheTimestamp = 0;

// ── Constants ──────────────────────────────────────────────────────────

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const BATCH_SIZE = 30; // DexScreener supports up to 30 comma-separated addresses

// ── Helpers ────────────────────────────────────────────────────────────

/** Split an array into chunks of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch-fetch token pairs from DexScreener.
 * DexScreener allows comma-separated addresses in the URL:
 *   /latest/dex/tokens/addr1,addr2,...,addrN  (max 30)
 */
async function fetchDexScreenerBatch(
  addresses: string[]
): Promise<DexScreenerPair[]> {
  try {
    const joined = addresses.join(',');
    const res = await fetch(`${DEXSCREENER_API_URL}/${joined}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      console.error(`DexScreener batch error: ${res.status} ${res.statusText}`);
      return [];
    }
    const data: DexScreenerResponse = await res.json();
    return data.pairs ?? [];
  } catch (err) {
    console.error('DexScreener batch fetch failed:', err);
    return [];
  }
}

/**
 * Find the best pair for a token address from the DexScreener pairs array.
 * "Best" = highest liquidity USD value (most reliable price).
 */
function bestPairForAddress(
  pairs: DexScreenerPair[],
  address: string
): DexScreenerPair | null {
  const matching = pairs.filter(
    (p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase()
  );
  if (matching.length === 0) return null;
  // Sort by liquidity descending, pick the top one
  matching.sort((a, b) => {
    const liqA = parseFloat(a.liquidity?.usd ?? '0');
    const liqB = parseFloat(b.liquidity?.usd ?? '0');
    return liqB - liqA;
  });
  return matching[0];
}

/** Build a PriceChangeToken from registry metadata + a DexScreener pair. */
function buildTokenEntry(
  meta: TokenMetadata,
  pair: DexScreenerPair | null
): PriceChangeToken {
  return {
    symbol: meta.symbol.toUpperCase(),
    name: meta.name,
    chain: meta.chain,
    address: meta.address,
    price: pair?.priceUsd ?? '0',
    change1h: pair?.priceChange?.h1 ?? '0',
    change3h: pair?.priceChange?.h3 ?? '0',
    change6h: pair?.priceChange?.h6 ?? '0',
    change24h: pair?.priceChange?.h24 ?? '0',
    volume24h: pair?.volume?.h24 ?? '0',
    marketCap: pair?.marketCap?.toString() ?? '0',
    liquidity: pair?.liquidity?.usd ?? '0',
  };
}

// ── Sort helper ────────────────────────────────────────────────────────

type SortField = 'change24h' | 'change6h' | 'change3h' | 'change1h' | 'volume';

function sortTokens(tokens: PriceChangeToken[], sortBy: SortField): PriceChangeToken[] {
  return [...tokens].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortBy) {
      case 'change1h':
        aVal = parseFloat(a.change1h) || 0;
        bVal = parseFloat(b.change1h) || 0;
        break;
      case 'change3h':
        aVal = parseFloat(a.change3h) || 0;
        bVal = parseFloat(b.change3h) || 0;
        break;
      case 'change6h':
        aVal = parseFloat(a.change6h) || 0;
        bVal = parseFloat(b.change6h) || 0;
        break;
      case 'volume':
        aVal = parseFloat(a.volume24h) || 0;
        bVal = parseFloat(b.volume24h) || 0;
        break;
      case 'change24h':
      default:
        aVal = parseFloat(a.change24h) || 0;
        bVal = parseFloat(b.change24h) || 0;
        break;
    }
    return bVal - aVal; // descending
  });
}

// ── Core data fetcher ──────────────────────────────────────────────────

async function fetchAllTokenPriceChanges(): Promise<PriceChangeResponse> {
  // Use DexScreener for BSC, ETH tokens (they all have EVM addresses)
  // RWA tokens also go through DexScreener if they have an address
  const allTokens = TOKEN_REGISTRY.filter(
    (t) => ['bsc', 'eth', 'rwa'].includes(t.chain)
  );

  const addresses = allTokens.map((t) => t.address);
  const batches = chunk(addresses, BATCH_SIZE);

  console.log(
    `[price-change] Fetching ${allTokens.length} tokens in ${batches.length} batches`
  );

  // Fetch all batches in parallel
  const batchResults = await Promise.all(batches.map(fetchDexScreenerBatch));

  // Flatten all pairs
  const allPairs = batchResults.flat();
  console.log(`[price-change] Got ${allPairs.length} total pairs from DexScreener`);

  // Map each registered token to its best pair
  const tokens: PriceChangeToken[] = allTokens.map((meta) => {
    const pair = bestPairForAddress(allPairs, meta.address);
    return buildTokenEntry(meta, pair);
  });

  // Filter out tokens with no meaningful data (price is 0 and no change data)
  const validTokens = tokens.filter(
    (t) => t.price !== '0' || parseFloat(t.change24h) !== 0
  );

  return {
    tokens: validTokens,
    updatedAt: new Date().toISOString(),
  };
}

// ── Route handler ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = (searchParams.get('sortBy') as SortField) || 'change24h';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Check in-memory cache
    const now = Date.now();
    if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
      console.log('[price-change] Serving from cache');
      const sorted = sortTokens(cachedResponse.tokens, sortBy).slice(0, limit);
      return NextResponse.json(
        { tokens: sorted, updatedAt: cachedResponse.updatedAt },
        {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    // Fetch fresh data
    console.log('[price-change] Fetching fresh data...');
    const freshData = await fetchAllTokenPriceChanges();

    // Update cache
    cachedResponse = freshData;
    cacheTimestamp = now;

    const sorted = sortTokens(freshData.tokens, sortBy).slice(0, limit);

    return NextResponse.json(
      { tokens: sorted, updatedAt: freshData.updatedAt },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('[price-change] Route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
