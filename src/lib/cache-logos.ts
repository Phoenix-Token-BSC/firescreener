import { redis } from './redis';
import { supabase } from './supabase';
import { TOKEN_REGISTRY } from './tokenRegistry';

/**
 * Cache all token logos in Redis from Supabase Storage
 * This can be run as a cron job or manually to warm up the cache
 */
export async function cacheAllLogos() {
  console.log('Starting logo caching process from Supabase Storage...');
  let foundCount = 0;
  let missingCount = 0;
  let skipCount = 0;

  const fileExtensions = ['png', 'jpg', 'jpeg', 'webp'];

  for (const token of TOKEN_REGISTRY) {
    const { address, chain, symbol } = token;
    const redisKey = `logo:${chain}:${address.toLowerCase()}`;

    try {
      // Check if already cached
      try {
        const cached = await redis.get(redisKey);
        if (cached) {
          console.log(`✓ Already cached: ${symbol} (${chain})`);
          skipCount++;
          // Optional: uncomment to force refresh
          // continue; 
        }
      } catch (e) {
        // ignore redis get error
      }

      // Try to fetch the logo from Supabase Storage
      let buffer: Buffer | null = null;
      let contentType = 'image/png';
      const normalizedAddr = address.toLowerCase();
      const bucketName = 'token-logos'; // Single bucket with subdirectories

      // Try original case first, then lowercase (files may be stored with mixed case)
      const addressVariants = [address, normalizedAddr];

      for (const addr of addressVariants) {
        for (const ext of fileExtensions) {
          const filePath = `${chain}/${addr}.${ext}`; // token-logos/bsc/0x... (original case or lowercase)

          try {
            const { data, error } = await supabase.storage
              .from(bucketName)
              .download(filePath);

            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
              contentType = `image/${ext}`;
              break;
            }
          } catch (e) {
            // continue to next extension/variant
          }
        }
        
        if (buffer) break; // Found it, stop trying variants
      }

      if (buffer) {
        // Store in Redis (TTL: 7 days)
        try {
          const base64Buffer = buffer.toString('base64');
          await redis.setex(redisKey, 604800, {
            buffer: base64Buffer,
            contentType: contentType,
          });
          console.log(`✓ Found in Supabase Storage: ${symbol} (${chain}) - ${buffer.length} bytes`);
          foundCount++;
        } catch (error) {
          console.error(`✗ Error caching ${symbol} (${chain}):`, error);
        }
      } else {
        console.log(`✗ Missing in Supabase Storage: ${symbol} (${chain})`);
        missingCount++;
      }
    } catch (error) {
      console.error(`✗ Error checking ${symbol} (${chain}):`, error);
      missingCount++;
    }
  }

  console.log('\n=== Supabase Storage Cache Check Complete ===');
  console.log(`✓ Found/Cached: ${foundCount}`);
  console.log(`→ Skipped (Already Cached): ${skipCount}`);
  console.log(`✗ Missing: ${missingCount}`);
  console.log(`Total tokens: ${TOKEN_REGISTRY.length}`);

  return {
    found: foundCount,
    skipped: skipCount,
    missing: missingCount,
    total: TOKEN_REGISTRY.length,
  };
}

/**
 * Clear all logo cache entries from Redis
 */
export async function clearLogoCache() {
  console.log('Clearing logo cache from Redis...');
  let count = 0;

  for (const token of TOKEN_REGISTRY) {
    const { address, chain } = token;
    const redisKey = `logo:${chain}:${address.toLowerCase()}`;

    try {
      await redis.del(redisKey);
      count++;
    } catch (error) {
      console.error(`Error deleting ${redisKey}:`, error);
    }
  }

  console.log(`Cleared ${count} cache entries from Redis`);
  return count;
}

/**
 * Get cache statistics from Redis
 */
export async function getLogoCacheStats() {
  let cachedCount = 0;
  let uncachedCount = 0;

  for (const token of TOKEN_REGISTRY) {
    const { address, chain } = token;
    const redisKey = `logo:${chain}:${address.toLowerCase()}`;

    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        cachedCount++;
      } else {
        uncachedCount++;
      }
    } catch (error) {
      console.error(`Error checking ${redisKey}:`, error);
      uncachedCount++;
    }
  }

  return {
    total: TOKEN_REGISTRY.length,
    cached: cachedCount,
    uncached: uncachedCount,
    cacheRate: ((cachedCount / TOKEN_REGISTRY.length) * 100).toFixed(2) + '%',
  };
}
