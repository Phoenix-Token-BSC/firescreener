'use client';

import React, { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import TokenCard from '@/components/TokenCard';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';
import { useFlashOnChange, formatCompactNumber, formatPrice } from '@/lib/tokenFormatting';

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

const TokenRow = React.memo(function TokenRow({ token }: { token: Token }) {
  const priceFlash = useFlashOnChange(token.price);
  const changeFlash = useFlashOnChange(token.change24h ?? 'N/A');
  const mcFlash = useFlashOnChange(token.marketCap);
  const volFlash = useFlashOnChange(token.volume);
  const liqFlash = useFlashOnChange(token.liquidity);

  const { display, isExponential, zeros, rest } = formatPrice(token.price);
  const priceDisplay = display === 'N/A' ? (
    <span className="text-neutral-400">N/A</span>
  ) : isExponential ? (
    <>{display}0<sub>{zeros}</sub>{rest}</>
  ) : display;

  return (
    <tr className="border-b border-orange-500 hover:bg-orange-600 transition-colors">
      <td className="px-5 py-2 text-sm sticky left-0 z-10 min-w-[150px] border-l border-orange-800 border-r border-orange-800">
        <Link href={`/${token.chain}/${token.address}`} className="flex items-center hover:opacity-80">
          <div className="relative flex-shrink-0 mr-3">
            <img
              src={`/api/${token.chain}/logo/${token.address}`}
              alt={token.symbol}
              width={24}
              height={24}
              className="rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
            />
            <img
              src={`/${token.chain}-logo.png`}
              alt={token.chain}
              width={10}
              height={10}
              className="absolute -bottom-1 -right-1 rounded-sm border-2 border-black"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-white whitespace-nowrap font-medium text-sm">{token.symbol.toUpperCase()}</span>
            <span className="text-gray-400 text-xs whitespace-nowrap">{token.name}</span>
          </div>
        </Link>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span
          className="text-white text-sm whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: priceFlash ? 0.4 : 1 }}
        >
          {priceDisplay}
        </span>
      </td>

      <td className="px-5 py-2 text-xs min-w-[120px] border-r border-orange-800">
        {token.change24h === 'N/A' || token.change24h === undefined ? (
          <span className="text-white whitespace-nowrap">N/A</span>
        ) : (() => {
          const change = parseFloat(String(token.change24h));
          const isPositive = change >= 0;
          return (
            <span
              className={`whitespace-nowrap font-medium transition-opacity duration-300 ${isPositive ? 'text-green-500' : 'text-red-500'}`}
              style={{ opacity: changeFlash ? 0.4 : 1 }}
            >
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          );
        })()}
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span
          className="text-white whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: mcFlash ? 0.4 : 1 }}
        >
          ${formatCompactNumber(token.marketCap)}
        </span>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span
          className="text-white whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: liqFlash ? 0.4 : 1 }}
        >
          {token.liquidity === 'N/A' ? 'N/A' : `$${formatCompactNumber(token.liquidity)}`}
        </span>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span
          className="text-white whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: volFlash ? 0.4 : 1 }}
        >
          {token.volume === 'N/A' ? 'N/A' : `$${formatCompactNumber(token.volume)}`}
        </span>
      </td>
    </tr>
  );
});

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
      <div className="p-2">
        {loading ? (
          <TokenLoadingSkeleton />
        ) : error ? (
          <div className="text-center py-10 text-red-400">{error}</div>
        ) : (
          <>
            {/* Mobile: Card Layout */}
            <div className="md:hidden flex flex-col gap-2">
              {tokens.map((token: Token) => (
                <TokenCard key={token.address} token={token} />
              ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden md:block shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-orange-500 border-b border-orange-800">
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left sticky left-0 bg-orange-500 z-20 min-w-[150px] border-l border-orange-800 border-r border-orange-800">Token</th>
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Price</th>
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">24H Change</th>
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Market Cap</th>
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Liquidity</th>
                      <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">24H Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <TokenRow key={token.address} token={token} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
