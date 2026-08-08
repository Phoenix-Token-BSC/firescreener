import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { adminClient } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const DEXSCREENER_API_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const ASSETCHAIN_LIQUIDITY_API = 'https://liquidity-pool-api.assetchain.org/tokens';

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 168; // a week, so the page can offer a wider view later
const PRICE_CACHE_TTL = 60;

interface NewListing {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  isBurn: boolean;
  /** When the token became publicly visible — what this page sorts by. */
  listedAt: string;
  price: string;
  marketCap: string;
  volume: string | number;
  change24h: string | number;
  liquidity: string | number;
}

interface TokenRow {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  is_burn: boolean | null;
  status?: string | null;
  created_at: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

/**
 * When a token became public — not when its row was first written.
 *
 * A submission that needed review was not visible to anyone until an admin approved it,
 * so `reviewed_at` is its real debut. One that passed the automated checks went live on
 * submission. `created_at` covers rows that predate the listing columns.
 */
function listedAt(row: TokenRow): string {
  return row.reviewed_at || row.submitted_at || row.created_at;
}

async function fetchWithTimeout(url: string, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Price/liquidity for one token. Shares the same per-token Redis keys the rest of the
 * site uses, so this page costs almost nothing even though it never caches its own list.
 */
async function priceFor(address: string, chain: string) {
  const key = chain === 'rwa' ? `assetchain:${address.toLowerCase()}` : `dexscreener:${address.toLowerCase()}`;

  try {
    const cached = await redis.get(key);
    if (cached) return cached as Partial<NewListing>;
  } catch {
    /* cache is an optimisation, not a dependency */
  }

  try {
    if (chain === 'rwa') {
      const res = await fetchWithTimeout(`${ASSETCHAIN_LIQUIDITY_API}?address=${address}`);
      if (!res.ok) return null;
      const data = await res.json();
      const item = data?.items?.[0];
      if (!item) return null;
      const result = {
        price: item.usdPrice || 'N/A',
        marketCap: item.marketCap || 'N/A',
        volume: item.pastDayVolume || 'N/A',
        liquidity: item.currentTvl || 'N/A',
        change24h: 'N/A',
      };
      redis.setex(key, PRICE_CACHE_TTL, result).catch(() => {});
      return result;
    }

    const res = await fetchWithTimeout(`${DEXSCREENER_API_URL}/${address}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Judge the token's own side of the deepest pair — reading baseToken blindly
    // reports the counterparty for anything that trades as the quote asset.
    const target = address.toLowerCase();
    const pairs = (data?.pairs ?? []).filter(
      (p: { baseToken?: { address?: string }; quoteToken?: { address?: string } }) =>
        p.baseToken?.address?.toLowerCase() === target ||
        p.quoteToken?.address?.toLowerCase() === target
    );
    if (pairs.length === 0) return null;

    const pair = [...pairs].sort((a, b) => {
      const aBase = a.baseToken?.address?.toLowerCase() === target ? 1 : 0;
      const bBase = b.baseToken?.address?.toLowerCase() === target ? 1 : 0;
      if (aBase !== bBase) return bBase - aBase;
      return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
    })[0];

    const result = {
      price: pair.priceUsd || 'N/A',
      marketCap: pair.marketCap?.toString() || pair.fdv?.toString() || 'N/A',
      volume: pair.volume?.h24 ?? 'N/A',
      change24h: pair.priceChange?.h24 ?? 'N/A',
      liquidity: pair.liquidity?.usd ?? 'N/A',
    };
    redis.setex(key, PRICE_CACHE_TTL, result).catch(() => {});
    return result;
  } catch {
    return null;
  }
}

/**
 * Tokens listed in the last N hours, newest first.
 *
 * Deliberately has NO list-level cache. /api/tokens serves a shared `tokens:all:*` blob
 * with stale-while-revalidate, which is right for a 130-row board that changes slowly —
 * but it means a brand new token can be absent from the first response after it is
 * added. The whole point of this page is that a listing shows up the moment it exists,
 * so the list is assembled per request straight from the database. Only the per-token
 * price lookups are cached, and those are shared with the rest of the site.
 */
export async function GET(request: NextRequest) {
  try {
    const hoursParam = Number(new URL(request.url).searchParams.get('hours'));
    const hours =
      Number.isFinite(hoursParam) && hoursParam > 0
        ? Math.min(hoursParam, MAX_WINDOW_HOURS)
        : DEFAULT_WINDOW_HOURS;

    const since = new Date(Date.now() - hours * 3600_000);

    // select('*') so this works before and after the listing columns are added.
    const { data, error } = await adminClient()
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[api/tokens/new]', error.message);
      return NextResponse.json({ error: 'Failed to load new listings' }, { status: 500 });
    }

    const recent = (data as TokenRow[])
      .filter((row) => (row.status ?? 'live') === 'live')
      .filter((row) => new Date(listedAt(row)) >= since)
      .sort((a, b) => new Date(listedAt(b)).getTime() - new Date(listedAt(a)).getTime());

    const listings: NewListing[] = await Promise.all(
      recent.map(async (row) => {
        const price = await priceFor(row.address, row.chain);
        return {
          symbol: row.symbol,
          name: row.name,
          address: row.address,
          chain: row.chain,
          isBurn: row.is_burn ?? false,
          listedAt: listedAt(row),
          price: (price?.price as string) ?? 'N/A',
          marketCap: (price?.marketCap as string) ?? 'N/A',
          volume: price?.volume ?? 'N/A',
          change24h: price?.change24h ?? 'N/A',
          liquidity: price?.liquidity ?? 'N/A',
        };
      })
    );

    return NextResponse.json(
      { hours, count: listings.length, tokens: listings },
      {
        headers: {
          // No shared cache — a new listing must be visible immediately. The short
          // client hint just stops a refresh storm.
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error) {
    console.error('[api/tokens/new] failed:', error);
    return NextResponse.json({ error: 'Failed to load new listings' }, { status: 500 });
  }
}
