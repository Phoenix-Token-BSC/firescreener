'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';
import TokenCard from '@/components/TokenCard';
import { useFlashOnChange, formatCompactNumber, formatPrice, Token } from '@/lib/tokenFormatting';
import { useScrollRestoration, useSessionStorage, useShouldSkipInitialFetch } from '@/hooks/useScrollRestoration';

const REFRESH_INTERVAL = 15_000;

// Memoized row so only changed tokens re-render
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
      <td className="px-5 py-2 text-sm sticky left-0 z-10 min-w-[150px]">
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

      <td className="px-5 py-2 text-sm min-w-[120px]">
        <span
          className="text-white text-sm whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: priceFlash ? 0.4 : 1 }}
        >
          {priceDisplay}
        </span>
      </td>

      <td className="px-5 py-2 text-xs min-w-[120px]">
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

      <td className="px-5 py-2 text-sm min-w-[120px]">
        <span
          className="text-white whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: mcFlash ? 0.4 : 1 }}
        >
          ${formatCompactNumber(token.marketCap)}
        </span>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px]">
        <span
          className="text-white whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: liqFlash ? 0.4 : 1 }}
        >
          {token.liquidity === 'N/A' ? 'N/A' : `$${formatCompactNumber(token.liquidity)}`}
        </span>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px]">
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

function sortTokens(tokens: Token[]): Token[] {
  const pht = tokens.find(t => t.symbol.toLowerCase() === 'pht');
  const rest = tokens.filter(t => t.symbol.toLowerCase() !== 'pht');
  const sortedRest = [...rest].sort((a, b) => {
    const mcA = parseFloat(String(a.marketCap).replace(/[^0-9.-]/g, '')) || 0;
    const mcB = parseFloat(String(b.marketCap).replace(/[^0-9.-]/g, '')) || 0;
    return mcB - mcA;
  });
  return pht ? [pht, ...sortedRest] : sortedRest;
}

export default function Home() {
    const [tokens, setTokens] = useSessionStorage<Token[]>('homePageTokens', []);
    const [loading, setLoading] = useState(true);
    const shouldSkipFetch = useShouldSkipInitialFetch('homePage');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    
    // Restore scroll position when user navigates back
    useScrollRestoration('homePageScroll');

    const fetchTokens = useCallback(async (isBackground = false) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch('/api/tokens', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch tokens: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const data: Token[] = await response.json();

        const sortedData = sortTokens(data);

        setTokens(prev => {
          if (!isBackground) {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('homePage-data', 'true');
            }
            return sortedData;
          }

          // Merge: update changed values, then re-sort by market cap.
          // Unchanged tokens keep the same object reference → React.memo skips re-render.
          const incoming = new Map(sortedData.map(t => [t.address, t]));
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
          return sortTokens(updated);
        });
      } catch (error) {
        // Background failure: keep stale data, no UI impact
        if (!isBackground) {
          console.error('Error fetching tokens:', error);
          // Still set loading to false so we show empty state instead of loading forever
          setLoading(false);
        }
      } finally {
        if (!isBackground) setLoading(false);
      }
    }, []);

    useEffect(() => {
      // If we should skip initial fetch (returning visit with cached data), just restore scroll
      if (shouldSkipFetch && tokens.length > 0) {
        setLoading(false);
      } else {
        // First visit or no cached data, fetch tokens
        fetchTokens(false);
      }

      intervalRef.current = setInterval(() => {
        fetchTokens(true);
      }, REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [fetchTokens, shouldSkipFetch, tokens.length]);

    // Refresh on tab becoming visible again
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
            <TokenLoadingSkeleton count={15} />
          ) : tokens.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-white text-lg mb-2">No tokens available</p>
                <p className="text-gray-400">Failed to load token data. Please try refreshing the page.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden flex flex-col gap-2">
                {tokens.map(token => (
                  <TokenCard key={token.address} token={token} />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-orange-500">
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left sticky left-0 bg-orange-500 z-20 min-w-[150px]">Token</th>
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">Price</th>
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">24H Change</th>
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">Market Cap</th>
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">Liquidity</th>
                        <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">24H Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map(token => (
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