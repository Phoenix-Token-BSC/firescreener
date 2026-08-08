// Server-side, database-backed token registry.
//
// Read path:  Redis blob (`registry:v1`) -> Supabase `tokens` -> static fallback
//
// The whole registry is cached as ONE JSON blob rather than per-token keys. Upstash's
// REST API has no SCAN (see cache-manager.ts), so a single known key is the only shape
// we can reliably invalidate. It also keeps this to one round-trip for the ~120 tokens
// instead of a fan-out.
//
// The static TOKEN_REGISTRY in ./tokenRegistry stays as a bootstrap fallback: if both
// Redis and Supabase are unreachable on a cold start we serve the last-known-good list
// rather than blanking the home page.
//
// Client components cannot import this module (it touches Supabase/Redis) — they go
// through GET /api/registry via the useRegistry() hook instead.

import { redis } from './redis';
import { supabase } from './supabase';
import { TOKEN_REGISTRY, type TokenMetadata, type SocialLinks } from './tokenRegistry';

export type { TokenMetadata, SocialLinks };

export type Chain = 'bsc' | 'sol' | 'rwa' | 'eth';

const REGISTRY_CACHE_KEY = 'registry:v1';
const REGISTRY_TTL = 60; // seconds — new listings appear within a minute without a deploy

// Per-invocation memo so a single request that hits getToken() a dozen times pays for
// at most one Redis round-trip. Lambdas are reused, so we also bound it by wall clock.
const MEMO_TTL_MS = 30_000;
let memo: { tokens: TokenMetadata[]; at: number } | null = null;
let inflight: Promise<TokenMetadata[]> | null = null;

interface DbToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  decimals: number | null;
  is_burn: boolean | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  scan: string | null;
  // Added by migrations/add_listing_submissions.sql. Absent before that runs, which is
  // why it is optional and why a missing value is treated as live below.
  status?: 'pending' | 'live' | 'rejected' | null;
}

// Canonical address casing, keyed by lowercase address.
//
// A BEFORE trigger on `tokens` lowercases address on write, which breaks two things
// that the static registry's mixed-case addresses were silently carrying:
//
//   1. Solana RPC — base58 is case-sensitive, so every Helius call (total-supply,
//      token-holders, token-metrics) fails against a lowercased address.
//   2. Logo storage — roughly half the files in the `token-logos` bucket are named
//      with the mixed-case address (`bsc/0x000Ae314…A.jpg`). The logo route matches
//      the filename against this address, so lowercasing it 404s the logo.
//
// EVM *RPC* calls are unaffected either way — hex is case-insensitive. This map only
// matters for base58 correctness and for storage filename matching.
//
// Recovered from the static registry until the data is fixed; a no-op afterwards.
// See migrations/fix_solana_address_casing.sql (sol) and the logo-filename note in
// migrations/normalize_logo_filenames.md (evm).
const CANONICAL_ADDRESSES = new Map(
  TOKEN_REGISTRY.map((t) => [t.address.toLowerCase(), t.address])
);

function canonicalizeAddress(address: string): string {
  return CANONICAL_ADDRESSES.get(address.toLowerCase()) ?? address;
}

function dbTokenToMetadata(row: DbToken): TokenMetadata {
  const socials: SocialLinks = {};
  if (row.website) socials.website = row.website;
  if (row.twitter) socials.twitter = row.twitter;
  if (row.telegram) socials.telegram = row.telegram;
  if (row.scan) socials.bscscan = row.scan;

  return {
    address: canonicalizeAddress(row.address),
    symbol: row.symbol,
    name: row.name,
    chain: row.chain as Chain,
    decimals: row.decimals ?? 18,
    socials: Object.keys(socials).length > 0 ? socials : undefined,
    isBurn: row.is_burn ?? false,
  };
}

async function fetchFromSupabase(): Promise<TokenMetadata[] | null> {
  // `select('*')` rather than a column list so this keeps working both before and after
  // migrations/add_listing_submissions.sql adds `status` — naming a column that does not
  // exist yet would fail the whole query.
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[registry] Supabase read failed:', error.message);
    return null;
  }
  if (!data || data.length === 0) {
    // An empty table is almost certainly a misconfiguration rather than a real state.
    // Treat it as a miss so we fall back instead of serving an empty site.
    console.error('[registry] Supabase returned no tokens — falling back to static registry');
    return null;
  }

  // Only live tokens are public. Rows written before the status column existed have no
  // status and are all pre-existing listings, so they are live.
  const live = (data as DbToken[]).filter((row) => (row.status ?? 'live') === 'live');

  if (live.length === 0) {
    console.error('[registry] no live tokens — falling back to static registry');
    return null;
  }

  return live.map(dbTokenToMetadata);
}

async function loadRegistry(): Promise<TokenMetadata[]> {
  // 1. Redis blob
  try {
    const cached = await redis.get(REGISTRY_CACHE_KEY);
    if (cached) {
      const tokens = (typeof cached === 'string' ? JSON.parse(cached) : cached) as TokenMetadata[];
      if (Array.isArray(tokens) && tokens.length > 0) return tokens;
    }
  } catch (err) {
    console.error('[registry] Redis read failed, falling through to Supabase:', err);
  }

  // 2. Supabase
  const fresh = await fetchFromSupabase();
  if (fresh) {
    redis.setex(REGISTRY_CACHE_KEY, REGISTRY_TTL, JSON.stringify(fresh)).catch(() => {});
    return fresh;
  }

  // 3. Static bootstrap fallback
  return TOKEN_REGISTRY;
}

/**
 * All tokens, from cache where possible. Never rejects — worst case it returns the
 * static bootstrap list.
 */
export async function getAllTokens(): Promise<TokenMetadata[]> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.tokens;

  // Collapse concurrent callers onto one load.
  if (!inflight) {
    inflight = loadRegistry()
      .then((tokens) => {
        memo = { tokens, at: Date.now() };
        return tokens;
      })
      .catch((err) => {
        console.error('[registry] load failed entirely, using static registry:', err);
        return TOKEN_REGISTRY;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export async function getToken(address: string): Promise<TokenMetadata | undefined> {
  const target = address.toLowerCase();
  const tokens = await getAllTokens();
  return tokens.find((t) => t.address.toLowerCase() === target);
}

export async function getTokenBySymbol(
  symbol: string,
  chain?: Chain
): Promise<TokenMetadata | undefined> {
  const target = symbol.toLowerCase();
  const tokens = await getAllTokens();
  const matches = tokens.filter(
    (t) => t.symbol.toLowerCase() === target && (chain ? t.chain === chain : true)
  );

  // Same tie-break as the static registry: prefer BSC on duplicate symbols.
  if (matches.length > 1) return matches.find((t) => t.chain === 'bsc') || matches[0];
  return matches[0];
}

export async function getTokensBySymbol(symbol: string): Promise<TokenMetadata[]> {
  const target = symbol.toLowerCase();
  const tokens = await getAllTokens();
  return tokens.filter((t) => t.symbol.toLowerCase() === target);
}

export async function getTokensByChain(chain: Chain): Promise<TokenMetadata[]> {
  const tokens = await getAllTokens();
  return tokens.filter((t) => t.chain === chain);
}

/**
 * Symbol -> address, preferring BSC on duplicates. Mirrors the legacy TOKEN_MAP.
 */
export async function getTokenMap(): Promise<Record<string, { address: string }>> {
  const tokens = await getAllTokens();
  const map: Record<string, { address: string }> = {};
  for (const token of tokens) {
    const existing = map[token.symbol];
    if (!existing) {
      map[token.symbol] = { address: token.address };
      continue;
    }
    if (token.chain === 'bsc') {
      const existingIsBsc = tokens.find(
        (t) => t.address.toLowerCase() === existing.address.toLowerCase()
      )?.chain === 'bsc';
      if (!existingIsBsc) map[token.symbol] = { address: token.address };
    }
  }
  return map;
}

/**
 * Drop the cached registry. Call after any write to the `tokens` table, otherwise a new
 * listing is invisible for up to REGISTRY_TTL seconds.
 *
 * Note this does NOT clear the assembled home-page lists (`tokens:all:<sortBy>`) — see
 * invalidateTokenListCaches() in ./cache-manager for that.
 */
export async function invalidateRegistryCache(): Promise<void> {
  memo = null;
  try {
    await redis.del(REGISTRY_CACHE_KEY);
  } catch (err) {
    console.error('[registry] cache invalidation failed:', err);
  }
}
