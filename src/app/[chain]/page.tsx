'use client';

import React, { useState, useEffect, use } from 'react';
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


export default function ChainPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const chain = resolvedParams.chain.toLowerCase();

  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTokens() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all tokens
        const response = await fetch('/api/tokens');
        if (!response.ok) {
          throw new Error('Failed to fetch tokens');
        }
        const data: Token[] = await response.json();

        // Filter tokens by chain
        const filteredTokens = data.filter((token) => token.chain.toLowerCase() === chain);

        if (filteredTokens.length === 0) {
          setError(`No tokens found for chain: ${chain.toUpperCase()}`);
        }

        setTokens(filteredTokens);
      } catch (error) {
        console.error('Error fetching tokens:', error);
        setError('Failed to load tokens. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();
  }, [chain]);

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
