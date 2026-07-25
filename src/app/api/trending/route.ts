import { TOKEN_REGISTRY } from '@/lib/tokenRegistry';
import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { createClient } from '@supabase/supabase-js';

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  addedAt: string;
  daysActive: number;
  expiresAt: string;
}

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";
const ASSETCHAIN_LIQUIDITY_API = "https://liquidity-pool-api.assetchain.org/tokens";
const DEXSCREENER_BATCH_SIZE = 30; // DexScreener accepts up to 30 comma-separated addresses
const CACHE_KEY = 'trending:all:v3'; // v3: batched fetch + acceleration-based scoring
const CACHE_TTL = 30;

interface TokenMetrics {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string | number;
  volume: number;
  liquidity: number;
  marketCap: number;
  change24h: number;
  trendScore: number;
  volumeScore: number;
  liquidityScore: number;
  momentumScore: number;
  accelerationScore: number;
  communityScore: number;
  communityVotes: number;
  isFeatured?: boolean;
}

interface RawMetrics {
  price: string | number;
  volume: number;
  volumeH1: number;
  liquidity: number;
  marketCap: number;
  change24h: number;
}

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function parseNumericValue(value: string | number | undefined): number {
  if (!value || value === 'N/A') return 0;
  const str = String(value).replace(/[^0-9.-]/g, '');
  return parseFloat(str) || 0;
}

// Fetch metrics for many tokens at once. For each token, the pair with the
// highest liquidity wins (DexScreener's pair order is not guaranteed).
async function fetchDexScreenerMetrics(addresses: string[]): Promise<Map<string, RawMetrics>> {
  const metrics = new Map<string, RawMetrics>();
  const bestLiquidity = new Map<string, number>();

  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += DEXSCREENER_BATCH_SIZE) {
    chunks.push(addresses.slice(i, i + DEXSCREENER_BATCH_SIZE));
  }

  await Promise.all(chunks.map(async (chunk) => {
    try {
      const response = await fetchWithTimeout(`${DEXSCREENER_API_URL}/${chunk.join(',')}`, 8000);
      if (!response.ok) return;

      const data = await response.json();
      for (const pair of data.pairs ?? []) {
        const base = pair.baseToken?.address?.toLowerCase();
        if (!base) continue;

        const liquidity = parseNumericValue(pair.liquidity?.usd);
        if (metrics.has(base) && liquidity <= (bestLiquidity.get(base) ?? 0)) continue;

        bestLiquidity.set(base, liquidity);
        metrics.set(base, {
          price: pair.priceUsd || "N/A",
          volume: parseNumericValue(pair.volume?.h24),
          volumeH1: parseNumericValue(pair.volume?.h1),
          liquidity,
          marketCap: parseNumericValue(pair.marketCap ?? pair.fdv),
          change24h: parseNumericValue(pair.priceChange?.h24),
        });
      }
    } catch (error) {
      console.error('DexScreener batch fetch failed:', error);
    }
  }));

  return metrics;
}

// AssetChain (rwa) tokens are not on DexScreener; its API has no 1h volume or
// 24h change, so those components simply score 0 for rwa tokens.
async function fetchAssetChainMetrics(addresses: string[]): Promise<Map<string, RawMetrics>> {
  const metrics = new Map<string, RawMetrics>();

  await Promise.all(addresses.map(async (address) => {
    try {
      const response = await fetchWithTimeout(`${ASSETCHAIN_LIQUIDITY_API}?address=${address}`, 5000);
      if (!response.ok) return;

      const data = await response.json();
      const item = data.items?.[0];
      if (!item) return;

      metrics.set(address.toLowerCase(), {
        price: item.usdPrice || "N/A",
        volume: parseNumericValue(item.pastDayVolume),
        volumeH1: 0,
        liquidity: parseNumericValue(item.currentTvl),
        marketCap: parseNumericValue(item.marketCap),
        change24h: 0,
      });
    } catch (error) {
      console.error(`AssetChain fetch failed for ${address}:`, error);
    }
  }));

  return metrics;
}

// Positive reactions (🔥 + 🚀 + ❤️‍🔥) for all tokens in one query.
async function fetchCommunityVotes(addresses: string[]): Promise<Map<string, number>> {
  const votes = new Map<string, number>();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabase
      .from('token_reactions')
      .select('contract_address,emoji_1,emoji_2,emoji_3')
      .in('contract_address', addresses);

    if (error || !data) return votes;

    for (const row of data) {
      votes.set(
        String(row.contract_address).toLowerCase(),
        (row.emoji_1 || 0) + (row.emoji_2 || 0) + (row.emoji_3 || 0)
      );
    }
  } catch (error) {
    console.error('Failed to fetch community votes:', error);
  }

  return votes;
}

// Score components (max 100 total):
//   volume       0..30  — 24h volume / market cap, log-scaled
//   liquidity    0..15  — liquidity / market cap, log-scaled
//   momentum   -15..15  — signed 24h price change
//   acceleration 0..20  — last-hour trading pace vs. the 24h average
//   community    0..20  — positive reactions, log-scaled
function calculateScores(raw: RawMetrics, communityVotes: number) {
  const { volume, volumeH1, liquidity, marketCap, change24h } = raw;

  // Thin-volume damp: below $5k/24h, ratio-based components scale down so a
  // handful of tiny trades on a micro-cap can't dominate the ranking
  const confidence = Math.min(1, volume / 5000);

  // Tracked tokens typically turn over 0.01%–5% of market cap daily; the ×1000
  // shift centers the log curve on that range (caps out near 3% turnover)
  const volumeScore = (marketCap > 0 ? Math.min(30, Math.log1p((volume / marketCap) * 1000) * 8.7) : 0) * confidence;
  const liquidityScore = marketCap > 0 ? Math.min(15, Math.log1p(liquidity / marketCap) * 25) : 0;
  const momentumScore = Math.min(15, Math.max(-15, change24h * 0.5));

  // pace of 1 = trading at its 24h average rate; 2 = last hour ran at double pace
  const pace = volume > 0 ? (volumeH1 * 24) / volume : 0;
  const accelerationScore = Math.min(20, Math.max(0, (pace - 1) * 10)) * confidence;

  const communityScore = Math.min(20, Math.log1p(communityVotes) * 4);

  const trendScore = Math.max(0, volumeScore + liquidityScore + momentumScore + accelerationScore + communityScore);

  return {
    trendScore: parseFloat(trendScore.toFixed(2)),
    volumeScore: parseFloat(volumeScore.toFixed(2)),
    liquidityScore: parseFloat(liquidityScore.toFixed(2)),
    momentumScore: parseFloat(momentumScore.toFixed(2)),
    accelerationScore: parseFloat(accelerationScore.toFixed(2)),
    communityScore: parseFloat(communityScore.toFixed(2)),
  };
}

async function getFeaturedTokens(): Promise<FeaturedToken[]> {
  try {
    const stored = await redis.get('featured:tokens');
    const tokens = (stored as FeaturedToken[]) || [];

    const now = new Date();
    const validChains = ['sol', 'eth', 'bsc', 'rwa'];

    return tokens.filter(token => {
      const isActive = new Date(token.expiresAt) > now;
      const hasValidChain = validChains.includes(String(token.chain).toLowerCase());
      const hasAddress = token.address && String(token.address).length > 0;

      if (!isActive || !hasValidChain || !hasAddress) {
        console.warn(`Filtering out invalid featured token: ${token.address}, chain: ${token.chain}`);
      }

      return isActive && hasValidChain && hasAddress;
    });
  } catch (error) {
    console.error('Error fetching featured tokens:', error);
    return [];
  }
}

async function fetchTrendingTokens(): Promise<TokenMetrics[]> {
  const featured = await getFeaturedTokens();
  const featuredAddresses = new Set(featured.map(f => String(f.address).toLowerCase()));

  // Registry tokens + featured tokens, deduped, routed by chain
  interface Candidate { address: string; symbol: string; name: string; chain: string; isFeatured: boolean }
  const candidates = new Map<string, Candidate>();

  for (const token of TOKEN_REGISTRY) {
    candidates.set(token.address.toLowerCase(), {
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      chain: token.chain,
      isFeatured: featuredAddresses.has(token.address.toLowerCase()),
    });
  }
  for (const token of featured) {
    const key = String(token.address).toLowerCase();
    if (!candidates.has(key)) {
      candidates.set(key, {
        address: String(token.address),
        symbol: String(token.symbol),
        name: String(token.name),
        chain: String(token.chain).toLowerCase(),
        isFeatured: true,
      });
    }
  }

  const all = [...candidates.values()];
  const rwaAddresses = all.filter(c => c.chain === 'rwa').map(c => c.address);
  const dexAddresses = all.filter(c => c.chain !== 'rwa').map(c => c.address);
  const lowercased = all.map(c => c.address.toLowerCase());

  const [dexMetrics, rwaMetrics, votes] = await Promise.all([
    fetchDexScreenerMetrics(dexAddresses),
    fetchAssetChainMetrics(rwaAddresses),
    fetchCommunityVotes(lowercased),
  ]);

  const scored: TokenMetrics[] = [];
  for (const candidate of all) {
    const key = candidate.address.toLowerCase();
    const raw = dexMetrics.get(key) ?? rwaMetrics.get(key);
    if (!raw) continue;

    const communityVotes = votes.get(key) ?? 0;
    scored.push({
      symbol: candidate.symbol.toUpperCase(),
      name: candidate.name,
      address: candidate.address,
      chain: candidate.chain,
      price: raw.price,
      volume: raw.volume,
      liquidity: raw.liquidity,
      marketCap: raw.marketCap,
      change24h: raw.change24h,
      communityVotes,
      isFeatured: candidate.isFeatured,
      ...calculateScores(raw, communityVotes),
    });
  }

  // Featured tokens are pinned on top (ranked among themselves by score),
  // followed by the top 25 organic tokens.
  const featuredTokens = scored
    .filter(t => t.isFeatured)
    .sort((a, b) => b.trendScore - a.trendScore);
  const organicTokens = scored
    .filter(t => !t.isFeatured)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 25);

  return [...featuredTokens, ...organicTokens];
}

export async function GET() {
  try {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
        });
      }
    } catch {}

    const trending = await fetchTrendingTokens();

    await redis.setex(CACHE_KEY, CACHE_TTL, trending).catch(() => {});

    return NextResponse.json(trending, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error in trending API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
