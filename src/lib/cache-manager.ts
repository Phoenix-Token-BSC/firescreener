import { redis } from './redis';

/**
 * Cache Statistics Interface
 */
// interface CacheStats {
//   totalKeys: number;
//   keysByType: {
//     logos: number;
//     dexscreener: number;
//     assetchain: number;
//     tokenData: number;
//     other: number;
//   };
//   estimatedSize: string;
// }

/**
 * Get all cache keys
 */
// async function getAllCacheKeys(): Promise<string[]> {
//   try {
//     // Note: Upstash Redis doesn't support SCAN in REST API
//     // We'll need to track keys manually or use a different approach
//     // For now, we'll return empty array and recommend using specific clear functions
//     console.warn('Getting all keys is not supported in Upstash REST API');
//     return [];
//   } catch (error) {
//     console.error('Error getting cache keys:', error);
//     return [];
//   }
// }

/**
 * Clear all DexScreener cache
 */
export async function clearDexScreenerCache(): Promise<number> {
  //console.log('Clearing DexScreener cache...');
  const count = 0;
  
  // Since we can't scan keys, we'll need to clear based on known tokens
  // This would require importing TOKEN_REGISTRY, but to avoid circular deps,
  // we'll provide a function that takes addresses
  
  return count;
}

/**
 * Clear all AssetChain cache
 */
export async function clearAssetChainCache(): Promise<number> {
  //console.log('Clearing AssetChain cache...');
  const count = 0;
  
  return count;
}

/**
 * Clear cache for a specific token
 */
export async function clearTokenCache(tokenAddress: string): Promise<void> {
  const addressLower = tokenAddress.toLowerCase();
  
  const keys = [
    `dexscreener:${addressLower}`,
    `assetchain:${addressLower}`,
    `token:${addressLower}`,
  ];

  for (const key of keys) {
    try {
      await redis.del(key);
     // console.log(`Deleted cache key: ${key}`);
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
    }
  }
}

/**
 * Clear cache for multiple tokens
 */
export async function clearMultipleTokensCache(tokenAddresses: string[]): Promise<number> {
  let count = 0;
  
  for (const address of tokenAddresses) {
    try {
      await clearTokenCache(address);
      count++;
    } catch (error) {
      console.error(`Error clearing cache for ${address}:`, error);
    }
  }
  
  return count;
}

/**
 * Get cache info for a specific token
 */
export async function getTokenCacheInfo(tokenAddress: string) {
  const addressLower = tokenAddress.toLowerCase();
  
  const keys = {
    dexscreener: `dexscreener:${addressLower}`,
    assetchain: `assetchain:${addressLower}`,
    token: `token:${addressLower}`,
  };

  const results: Record<string, boolean> = {};

  for (const [source, key] of Object.entries(keys)) {
    try {
      const cached = await redis.get(key);
      results[source] = !!cached;
    } catch {
      results[source] = false;
    }
  }

  return results;
}

/**
 * Warm up cache for specific tokens
 * This should be called from an API route with token fetching logic
 */
export async function warmUpTokenCache(
  tokenAddress: string,
  data: any,
  source: 'dexscreener' | 'assetchain',
  ttl: number = 60
): Promise<void> {
  const cacheKey = `${source}:${tokenAddress.toLowerCase()}`;
  
  try {
    await redis.setex(cacheKey, ttl, data);
   // console.log(`✓ Warmed cache: ${cacheKey}`);
  } catch (error) {
    console.error(`Error warming cache for ${cacheKey}:`, error);
  }
}

/**
 * Get cache health metrics
 */
export async function getCacheHealth() {
  // This is a simplified version since Upstash REST doesn't support all Redis commands
  return {
    status: 'operational',
    message: 'Cache is operational. Individual cache hits/misses are logged in console.',
    recommendation: 'Monitor application logs for cache performance metrics.',
  };
}

/**
 * Invalidate old cache entries (manual trigger)
 * In production, this would be handled by TTL automatically
 */
export async function invalidateOldCache(addresses: string[]): Promise<number> {
  return await clearMultipleTokensCache(addresses);
}
