import { TOKEN_REGISTRY } from '@/lib/tokenRegistry';
import { NextRequest, NextResponse } from 'next/server';
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
  communityVotes?: number;
  communityScore?: number;
  isFeatured?: boolean;
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

async function getCommunityVotes(tokenAddress: string): Promise<number> {
  const cacheKey = `votes:${tokenAddress.toLowerCase()}`;

  try {
    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) return parseInt(cached as string);
  } catch {}

  try {
    // Fetch from Supabase token-reactions table
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabase
      .from('token_reactions')
      .select('emoji_1,emoji_2,emoji_3,emoji_4,emoji_5')
      .eq('contract_address', tokenAddress.toLowerCase())
      .single();

    if (error || !data) {
      // Token reactions don't exist yet, return 0
      return 0;
    }

    // Calculate positive score (emoji_1: 🔥 + emoji_2: 🚀 + emoji_3: ❤️‍🔥)
    const positiveVotes = (data.emoji_1 || 0) + (data.emoji_2 || 0) + (data.emoji_3 || 0);

    // Cache the result for 5 minutes
    await redis.setex(cacheKey, 300, positiveVotes).catch(() => {});

    return positiveVotes;
  } catch (error) {
    console.error(`Failed to get community votes for ${tokenAddress}:`, error);
    return 0;
  }
}

async function getTokenMetrics(address: string): Promise<Partial<TokenMetrics> | null> {
  const cacheKey = `trending:${address.toLowerCase()}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached as Partial<TokenMetrics>;
  } catch {}

  try {
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);

    // Try DexScreener for all tokens
    const dexUrl = `${DEXSCREENER_API_URL}/${address}`;
    const dexResponse = await fetchWithTimeout(dexUrl, 5000);

    if (!dexResponse.ok) return null;

    const dexData = await dexResponse.json();
    if (!dexData.pairs || dexData.pairs.length === 0) return null;

    const pair = dexData.pairs[0];

    const metrics: Partial<TokenMetrics> = {
      address,
      price: pair.priceUsd || "N/A",
      volume: parseNumericValue(pair.volume?.h24),
      liquidity: parseNumericValue(pair.liquidity?.usd),
      marketCap: parseNumericValue(pair.marketCap),
      change24h: parseNumericValue(pair.priceChange?.h24),
    };

    await redis.setex(cacheKey, 60, metrics).catch(() => {});
    return metrics;
  } catch (error) {
    console.error(`Failed to fetch metrics for ${address}:`, error);
    return null;
  }
}

function calculateTrendScore(metrics: Partial<TokenMetrics>): TokenMetrics | null {
  const volume = metrics.volume || 0;
  const liquidity = metrics.liquidity || 0;
  const marketCap = metrics.marketCap || 1; // Default to 1 to avoid division by zero
  const change24h = metrics.change24h || 0;
  const communityVotes = metrics.communityVotes || 0;

  if (marketCap === 0) return null;

  // Volume Score (0-35): High volume normalized by market cap
  // Tokens with high volume relative to market cap are more active
  const volumeToMcRatio = volume / marketCap;
  const volumeScore = Math.min(35, volumeToMcRatio * 100); // Normalized scale

  // Liquidity Score (0-20): High liquidity ratio is good for trading
  const liquidityToMcRatio = liquidity / marketCap;
  const liquidityScore = Math.min(20, liquidityToMcRatio * 100); // Higher liquidity = better trading

  // Momentum Score (0-20): Price change indicates market sentiment
  const momentumScore = Math.min(20, Math.max(-20, change24h * 1)); // Positive or negative momentum

  // Community Score (0-25): Community engagement and interest
  // Votes are log-scaled to prevent one token from dominating
  const communityScore = Math.min(25, Math.log(communityVotes + 1) * 5); // Log scale for community votes

  // Base score from volume + liquidity + momentum + community
  const trendScore = Math.max(1, volumeScore + liquidityScore + Math.abs(momentumScore) + communityScore);

  return {
    ...metrics,
    trendScore: parseFloat(trendScore.toFixed(2)),
    volumeScore: parseFloat(volumeScore.toFixed(2)),
    liquidityScore: parseFloat(liquidityScore.toFixed(2)),
    momentumScore: parseFloat(momentumScore.toFixed(2)),
    communityScore: parseFloat(communityScore.toFixed(2)),
  } as TokenMetrics;
}

async function getFeaturedTokens(): Promise<FeaturedToken[]> {
  try {
    const stored = await redis.get('featured:tokens');
    const tokens = (stored as FeaturedToken[]) || [];

    const now = new Date();
    const validChains = ['sol', 'eth', 'bsc', 'rwa'];

    // Filter: only active tokens with valid data
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
  const metricsPromises = TOKEN_REGISTRY.map(async (token) => {
    try {
      const metrics = await getTokenMetrics(token.address);
      if (!metrics) return null;

      // Fetch community votes from Supabase
      const communityVotes = await getCommunityVotes(token.address);

      return calculateTrendScore({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        chain: token.chain,
        communityVotes,
        ...metrics,
      });
    } catch {
      return null;
    }
  });

  const allMetrics = await Promise.all(metricsPromises);

  const trendingTokens = allMetrics
    .filter((m): m is TokenMetrics => m !== null)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 25); // Top 25 trending

  // Get featured tokens
  const featured = await getFeaturedTokens();

  console.log(`[Trending API] Found ${featured.length} featured tokens`);
  if (featured.length > 0) {
    console.log(`[Trending API] Featured tokens:`, featured.map(f => ({ symbol: f.symbol, address: f.address, chain: f.chain })));
  }

  // Create featured token metrics
  const featuredMetrics: TokenMetrics[] = [];
  for (const featuredToken of featured) {
    try {
      const normalizedChain = String(featuredToken.chain).toLowerCase();

      // Try to fetch real market data for featured token
      let marketData: any = null;
      try {
        const metrics = await getTokenMetrics(featuredToken.address);
        if (metrics) {
          marketData = metrics;
        }
      } catch (error) {
        console.warn(`Could not fetch metrics for featured token ${featuredToken.address}:`, error);
      }

      // Fetch community votes from Supabase for featured token
      const communityVotes = await getCommunityVotes(featuredToken.address);

      const token: TokenMetrics = {
        symbol: String(featuredToken.symbol).toUpperCase(),
        name: String(featuredToken.name),
        address: String(featuredToken.address).toLowerCase(),
        chain: normalizedChain,
        price: marketData?.price || 'N/A',
        volume: marketData?.volume || 0,
        liquidity: marketData?.liquidity || 0,
        marketCap: marketData?.marketCap || 0,
        change24h: marketData?.change24h || 0,
        trendScore: 100, // Featured tokens get a boost
        volumeScore: 0,
        liquidityScore: 0,
        momentumScore: 0,
        communityVotes,
        communityScore: 0,
        isFeatured: true,
      };
      featuredMetrics.push(token);
    } catch (error) {
      console.error(`Error processing featured token ${featuredToken.address}:`, error);
    }
  }

  // Remove any trending tokens that are also featured (to avoid duplicates)
  const featuredAddresses = new Set(featuredMetrics.map(f => f.address.toLowerCase()));
  const filteredTrending = trendingTokens.filter(t => !featuredAddresses.has(t.address.toLowerCase()));

  // Combine: featured tokens first, then trending tokens
  const result = [...featuredMetrics, ...filteredTrending];

  console.log(`[Trending API] Returning ${result.length} tokens (${featuredMetrics.length} featured, ${filteredTrending.length} trending)`);
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const cacheKey = 'trending:all:v2'; // v2 includes isFeatured flag

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          status: 200,
          headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
        });
      }
    } catch {}

    // Fetch fresh data
    const trending = await fetchTrendingTokens();

    // Cache the result
    await redis.setex(cacheKey, 30, trending).catch(() => {});

    return NextResponse.json(trending, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Error in trending API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
