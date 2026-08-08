'use client';

// Client-side access to the token registry.
//
// Client components cannot import tokenRegistry.server (it touches Supabase/Redis), so
// they read the same data over GET /api/registry instead.
//
// The static TOKEN_REGISTRY seeds the initial state, so components render a full list on
// first paint with no loading flash — the fetched list swaps in once it arrives. That
// keeps behaviour identical to the pre-migration build even if /api/registry is slow or
// down; the only cost is that a brand-new listing appears a moment late.

import { useEffect, useState } from 'react';
import { TOKEN_REGISTRY, type TokenMetadata } from '@/lib/tokenRegistry';

// Module-level cache so every component using this hook shares one fetch per page load
// rather than each mounting its own.
let cached: TokenMetadata[] | null = null;
let inflight: Promise<TokenMetadata[]> | null = null;

async function fetchRegistry(): Promise<TokenMetadata[]> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch('/api/registry')
      .then((res) => {
        if (!res.ok) throw new Error(`registry ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const tokens = Array.isArray(data?.tokens) ? (data.tokens as TokenMetadata[]) : [];
        if (tokens.length === 0) throw new Error('empty registry');
        cached = tokens;
        return tokens;
      })
      .catch((err) => {
        console.error('[useRegistry] falling back to static registry:', err);
        return TOKEN_REGISTRY;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * The live registry, seeded from the static list so there is no loading flash.
 *
 * `ready` is false until the live list has actually arrived. Anything that renders a
 * filtered view can ignore it, but callers that make an irreversible decision from a
 * miss — "this token does not exist, redirect to /error" — MUST wait for it. The seed
 * list does not contain database-added tokens, so acting on a miss too early sends a
 * perfectly valid new listing to the error page.
 */
export function useRegistryState(): { tokens: TokenMetadata[]; ready: boolean } {
  const [tokens, setTokens] = useState<TokenMetadata[]>(cached ?? TOKEN_REGISTRY);
  const [ready, setReady] = useState<boolean>(cached !== null);

  useEffect(() => {
    let active = true;
    fetchRegistry().then((fresh) => {
      if (!active) return;
      setTokens(fresh);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return { tokens, ready };
}

export function useRegistry(): TokenMetadata[] {
  return useRegistryState().tokens;
}

/** Same BSC-preferring tie-break as the server registry. */
export function findBySymbol(
  tokens: TokenMetadata[],
  symbol: string,
  chain?: 'bsc' | 'sol' | 'rwa' | 'eth'
): TokenMetadata | undefined {
  const target = symbol.toLowerCase();
  const matches = tokens.filter(
    (t) => t.symbol.toLowerCase() === target && (chain ? t.chain === chain : true)
  );
  if (matches.length > 1) return matches.find((t) => t.chain === 'bsc') || matches[0];
  return matches[0];
}

export function findByAddress(
  tokens: TokenMetadata[],
  address: string
): TokenMetadata | undefined {
  const target = address.toLowerCase();
  return tokens.find((t) => t.address.toLowerCase() === target);
}
