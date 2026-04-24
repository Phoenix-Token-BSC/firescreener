'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import Header from '@/components/Header';
import TokenCard from '@/components/TokenCard';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';

interface Token {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string | number;
  marketCap: string | number;
  volume: string | number;
  liquidity: string | number;
  change24h: string | number;
}

interface PageProps {
  params: Promise<{
    chain: string;
  }>;
}

const REFRESH_INTERVAL = 15_000;

function sortByMarketCap(tokens: Token[]): Token[] {
  return [...tokens].sort((a, b) => {
    const mcA = parseFloat(String(a.marketCap).replace(/[^0-9.-]/g, '')) || 0;
    const mcB = parseFloat(String(b.marketCap).replace(/[^0-9.-]/g, '')) || 0;
    return mcB - mcA;
  });
}

export default function ChainPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chain = resolvedParams.chain.toLowerCase();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTokens = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      }

      const response = await fetch('/api/tokens');
      if (!response.ok) throw new Error('Failed to fetch tokens');
      const data: Token[] = await response.json();

      const filtered = data.filter(t => t.chain.toLowerCase() === chain);

      if (!isBackground && filtered.length === 0) {
        setError(`No tokens found for chain: ${chain.toUpperCase()}`);
      }

      setTokens(prev => {
        if (!isBackground) return sortByMarketCap(filtered);

        // Merge: update changed values then re-sort by market cap.
        // Unchanged tokens keep same object reference → React.memo skips re-render.
        const incoming = new Map(filtered.map(t => [t.address, t]));
        const updated = prev.map(t => {
          const fresh = incoming.get(t.address);
          if (!fresh) return t;
          const changed =
            t.price !== fresh.price ||
            t.marketCap !== fresh.marketCap ||
            t.volume !== fresh.volume ||
            t.liquidity !== fresh.liquidity ||
            t.change24h !== fresh.change24h;
          return changed ? fresh : t;
        });
        return sortByMarketCap(updated);
      });
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching tokens:', err);
        setError('Failed to load tokens. Please try again later.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    fetchTokens(false);

    intervalRef.current = setInterval(() => {
      fetchTokens(true);
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTokens]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTokens(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchTokens]);

  return (
    <div className="container mx-auto">
      <Header />
      <div className="px-4 pt-8">
        {loading ? (
          <TokenLoadingSkeleton />
        ) : error ? (
          <div className="text-center py-10 text-red-400">{error}</div>
        ) : (
          <div className="flex flex-col">
            {tokens.map((token: Token) => (
              <TokenCard key={token.address} token={token} />
            ))}
          </div>
        )}

        {/* Back to all tokens link */}
        {/* {!loading && !error && (
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-orange-500 hover:text-orange-400 transition-colors duration-200 font-medium"
            >
              ← View all chains
            </Link>
          </div>
        )} */}
      </div>
    </div>
  );
}
