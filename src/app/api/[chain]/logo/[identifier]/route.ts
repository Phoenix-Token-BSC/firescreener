import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTokenByAddress, getTokenBySymbol, isValidContractAddress } from "@/lib/tokenRegistry";

type CacheHit = { buffer: ArrayBuffer; contentType: string; expiry: number };
type CacheEntry = CacheHit; // ✅ Removed CacheMiss — misses are never cached now

const globalForCache = global as unknown as {
  logoCache: Map<string, CacheEntry>;
};

if (!globalForCache.logoCache) {
  globalForCache.logoCache = new Map();
}

const localCache = globalForCache.logoCache;

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for successful fetches only

function isCacheHit(entry: CacheEntry): entry is CacheHit {
  return "buffer" in entry;
}

function getContentTypeFromPath(path: string): string {
  const lastDotIndex = path.lastIndexOf(".");
  if (lastDotIndex === -1) return "image/png";
  const ext = path.slice(lastDotIndex + 1).toLowerCase();

  switch (ext) {
    case "png":  return "image/png";
    case "jpg":  return "image/jpeg";
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    default:     return "image/png";
  }
}

async function fetchFromSupabaseStorage(
  chain: string,
  address: string,
  originalCaseAddress?: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const normalizedAddr = address.toLowerCase();
  const bucketName = "token-logos";
  const extensions = ["png", "webp", "jpg", "jpeg"];
  
  // Try with original case first (files uploaded with mixed case), then lowercase
  const addressVariants = originalCaseAddress 
    ? [originalCaseAddress, normalizedAddr]
    : [normalizedAddr];
  
  const pathVariants: string[] = [];
  for (const addr of addressVariants) {
    for (const ext of extensions) {
      pathVariants.push(`${chain}/${addr}.${ext}`);
    }
  }

  for (const path of pathVariants) {
    try {
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

      if (!publicUrlData?.publicUrl) {
        console.debug(`[Supabase] No public URL generated for ${path}`);
        continue;
      }

      const response = await fetch(publicUrlData.publicUrl, {
        headers: { "Cache-Control": "no-cache" },
      });

      if (response.status === 400 || response.status === 404) {
        console.debug(`[Supabase] ${response.status} — not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        console.warn(`[Supabase] Unexpected ${response.status} for ${path}`);
        continue;
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength === 0) {
        console.warn(`[Supabase] 0-byte response for ${path}`);
        continue;
      }

      const contentType =
        response.headers.get("content-type")?.split(";")[0].trim() ||
        getContentTypeFromPath(path);

      console.log(`[Supabase] ✅ ${path} (${buffer.byteLength} bytes, ${contentType})`);
      return { buffer, contentType };
    } catch (err) {
      console.debug(`[Supabase] Fetch exception for ${path}:`, err);
    }
  }

  console.warn(`[Supabase] ❌ No logo found for ${chain}/${normalizedAddr} (original: ${originalCaseAddress || 'none'})`);
  return null;
}

async function getLogoBuffer(chain: string, address: string, originalCaseAddress?: string): Promise<CacheHit | null> {
  const cacheKey = `logo:${chain}:${address.toLowerCase()}`;
  const now = Date.now();

  const cached = localCache.get(cacheKey);
  if (cached && cached.expiry > now) {
    // ✅ Only cache hits are stored now, so this is always a valid logo
    console.log(`[CACHE HIT] ${chain}/${address}`);
    return cached;
  }

  // Expired or never cached — always try Supabase (covers newly uploaded logos too)
  if (cached) localCache.delete(cacheKey);

  const fetched = await fetchFromSupabaseStorage(chain, address, originalCaseAddress);

  if (fetched) {
    const entry: CacheHit = {
      buffer: fetched.buffer,
      contentType: fetched.contentType,
      expiry: now + CACHE_TTL,
    };
    localCache.set(cacheKey, entry);
    console.log(`[CACHE MISS] Stored ${chain}/${address}`);
    return entry;
  }

  // ✅ Not found — do NOT cache, so next request retries Supabase immediately
  console.log(`[CACHE MISS] Not found ${chain}/${address} — will retry on next request`);
  return null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ chain: string; identifier: string }> }
) {

  const params = await context.params;
  console.log("🔥 Route hit — raw params:", params);
  console.log("🔥 Full URL:", _req.url);
  try {
    const { chain, identifier } = await context.params;

    if (!chain || !identifier) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const chainLower = chain.toLowerCase() as "bsc" | "sol" | "rwa" | "eth";
    const identifierLower = identifier.toLowerCase();

    let tokenMetadata = null;

    if (isValidContractAddress(identifierLower, chainLower)) {
      tokenMetadata = getTokenByAddress(identifierLower);
    } else {
      tokenMetadata = getTokenBySymbol(identifierLower, chainLower);
    }

    if (!tokenMetadata) {
      if (!isValidContractAddress(identifierLower, chainLower)) {
        return NextResponse.json({ error: "Token not found" }, { status: 404 });
      }
    } else if (tokenMetadata.chain !== chainLower) {
      return NextResponse.json(
        { error: `Token exists on ${tokenMetadata.chain.toUpperCase()}` },
        { status: 400 }
      );
    }

    const contractAddress = (tokenMetadata?.address ?? identifierLower).toLowerCase();
    const originalCaseAddress = tokenMetadata?.address || undefined;
    const logoData = await getLogoBuffer(chainLower, contractAddress, originalCaseAddress);

    if (logoData) {
      return new NextResponse(logoData.buffer, {
        headers: {
          "Content-Type": logoData.contentType,
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }

    return NextResponse.json({ error: "Logo not found" }, { status: 404 });
  } catch (error) {
    console.error("Logo API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}