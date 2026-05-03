import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_REGISTRY } from '@/lib/tokenRegistry';
import { redis } from '@/lib/redis';

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";
const ASSETCHAIN_LIQUIDITY_API = "https://liquidity-pool-api.assetchain.org/tokens";
const CACHE_TTL = 60; // 1 minute

interface JobStats {
  startTime: string;
  endTime?: string;
  totalTokens: number;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
  duration?: number;
}

/**
 * Background worker to refresh token data cache
 * This should be called by a cron job (e.g., every minute)
 * 
 * Vercel Cron: https://vercel.com/docs/cron-jobs
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/workers/refresh-cache",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron or authorized
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats: JobStats = {
    startTime: new Date().toISOString(),
    totalTokens: TOKEN_REGISTRY.length,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

 // console.log(`🔄 Starting cache refresh for ${stats.totalTokens} tokens...`);

  // Process tokens in batches to avoid overwhelming APIs
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second

  for (let i = 0; i < TOKEN_REGISTRY.length; i += BATCH_SIZE) {
    const batch = TOKEN_REGISTRY.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(
      batch.map(async (token) => {
        try {
          stats.processed++;
          
          // Fetch data based on chain
          if (token.chain === 'rwa') {
            // AssetChain for RWA tokens
            await refreshAssetChainData(token.address);
          } else {
            // DexScreener for BSC/SOL tokens
            await refreshDexScreenerData(token.address);
          }
          
          stats.successful++;
         // console.log(`✓ Refreshed: ${token.symbol} (${token.chain})`);
        } catch (error) {
          stats.failed++;
          const errorMsg = `Failed: ${token.symbol} - ${error}`;
          stats.errors.push(errorMsg);
          console.error(`✗ ${errorMsg}`);
        }
      })
    );

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < TOKEN_REGISTRY.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  stats.endTime = new Date().toISOString();
  stats.duration = new Date(stats.endTime).getTime() - new Date(stats.startTime).getTime();

  //console.log(`✅ Cache refresh complete: ${stats.successful}/${stats.totalTokens} successful`);

  return NextResponse.json({
    success: true,
    stats,
  });
}

/**
 * Refresh DexScreener data for a token
 */
async function refreshDexScreenerData(tokenAddress: string): Promise<void> {
  const cacheKey = `dexscreener:${tokenAddress.toLowerCase()}`;

  try {
    const url = `${DEXSCREENER_API_URL}/${tokenAddress}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('No pairs found');
    }

    const pair = data.pairs[0];

    const result = {
      token: tokenAddress,
      price: pair.priceUsd || "N/A",
      marketCap: pair.marketCap?.toString() || "N/A",
      volume: pair.volume?.h24 || "N/A",
      change24h: pair.priceChange?.h24 || "N/A",
      liquidity: pair.liquidity?.usd || "N/A",
    };

    // Cache with extended TTL since this is background refresh
    await redis.setex(cacheKey, CACHE_TTL * 2, result);
  } catch (error) {
    // Don't throw, just log - we don't want one failure to stop the batch
    console.error(`DexScreener refresh error for ${tokenAddress}:`, error);
  }
}

/**
 * Refresh AssetChain data for a token
 */
async function refreshAssetChainData(tokenAddress: string): Promise<void> {
  const cacheKey = `assetchain:${tokenAddress.toLowerCase()}`;

  try {
    const url = `${ASSETCHAIN_LIQUIDITY_API}?address=${tokenAddress}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('No items found');
    }

    const tokenData = data.items[0];

    const result = {
      token: tokenData.address,
      price: tokenData.usdPrice || "N/A",
      marketCap: tokenData.marketCap || "N/A",
      volume: tokenData.pastDayVolume || "N/A",
      liquidity: tokenData.currentTvl || "N/A",
      decimals: tokenData.decimals,
      name: tokenData.name,
      isVerified: tokenData.isVerified,
      iconUrl: tokenData.iconUrl,
    };

    // Cache with extended TTL since this is background refresh
    await redis.setex(cacheKey, CACHE_TTL * 2, result);
  } catch (error) {
    // Don't throw, just log
    console.error(`AssetChain refresh error for ${tokenAddress}:`, error);
  }
}
