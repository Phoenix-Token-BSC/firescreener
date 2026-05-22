import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { publishPriceUpdate } from '@/lib/ably-publisher';
// import { getTokenByAddress } from '@/lib/tokenRegistry';

const DEXSCREENER_API_URL = "https://api.dexscreener.com/latest/dex/tokens";
const ASSETCHAIN_LIQUIDITY_API = "https://liquidity-pool-api.assetchain.org/tokens";
const CACHE_TTL = 60;

/**
 * Priority worker - refreshes only actively viewed tokens
 * Should run frequently (every 30 seconds via cron)
 */
export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  let processed = 0;
  let successful = 0;
  let failed = 0;

  try {
    // Get active tokens from last 5 minutes
    const activeKey = 'active-tokens';
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const activeTokensData = await redis.zrange(activeKey, 0, -1, { withScores: true });
    
    const activeTokens: string[] = [];
    if (Array.isArray(activeTokensData)) {
      for (let i = 0; i < activeTokensData.length; i += 2) {
        const token = activeTokensData[i];
        const score = activeTokensData[i + 1];
        if (typeof score === 'number' && score >= fiveMinutesAgo) {
          activeTokens.push(token as string);
        }
      }
    }

    if (activeTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active tokens to refresh',
        stats: {
          processed: 0,
          successful: 0,
          failed: 0,
          duration: Date.now() - startTime,
        },
      });
    }

   // console.log(`🔄 Refreshing ${activeTokens.length} active tokens...`);

    // Refresh each active token
    await Promise.allSettled(
      activeTokens.map(async (tokenKey) => {
        try {
          processed++;
          const [chain, address] = tokenKey.split(':');

          const result = chain === 'rwa'
            ? await refreshAssetChainData(address)
            : await refreshDexScreenerData(address);

          // Push real-time price update to Ably so client-side alerts can fire
          await publishPriceUpdate(chain, address, {
            price: String(result.price),
            marketCap: String(result.marketCap),
            volume: String(result.volume),
            change24h: String(result.change24h ?? 'N/A'),
            liquidity: String(result.liquidity ?? 'N/A'),
          });

          successful++;
        } catch (error) {
          failed++;
          console.error(`Failed to refresh ${tokenKey}:`, error);
        }
      })
    );

    const duration = Date.now() - startTime;

   // console.log(`✅ Refreshed ${successful}/${processed} active tokens in ${duration}ms`);

    return NextResponse.json({
      success: true,
      stats: {
        processed,
        successful,
        failed,
        duration,
      },
    });
  } catch (error) {
    console.error('Priority worker error:', error);
    return NextResponse.json(
      { error: 'Worker failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function refreshDexScreenerData(tokenAddress: string) {
  const cacheKey = `dexscreener:${tokenAddress.toLowerCase()}`;

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

  await redis.setex(cacheKey, CACHE_TTL, result);
  return result;
}

async function refreshAssetChainData(tokenAddress: string) {
  const cacheKey = `assetchain:${tokenAddress.toLowerCase()}`;

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
    change24h: "N/A",
    liquidity: tokenData.currentTvl || "N/A",
    decimals: tokenData.decimals,
    name: tokenData.name,
    isVerified: tokenData.isVerified,
    iconUrl: tokenData.iconUrl,
  };

  await redis.setex(cacheKey, CACHE_TTL, result);
  return result;
}
