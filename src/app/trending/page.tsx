'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';
import TokenCard from '@/components/TokenCard';
import { useFlashOnChange, formatCompactNumber, formatPrice, Token } from '@/lib/tokenFormatting';
import { useScrollRestoration, useSessionStorage } from '@/hooks/useScrollRestoration';

const REFRESH_INTERVAL = 30_000;

interface TrendingToken extends Token {
  trendScore: number;
  isFeatured?: boolean;
}

function TrendingRow({ token }: { token: TrendingToken }) {
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
    <tr className="border-b border-orange-800 hover:bg-orange-800 transition-colors">
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
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">
                {token.symbol.toUpperCase()}
              </span>
              {(token as any).isFeatured && (
                <span className="text-lg leading-none">🔥</span>
              )}
            </div>
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
}

export default function TrendingPage() {
  const [tokens, setTokens] = useSessionStorage<TrendingToken[]>('trendingTokens', []);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useScrollRestoration('trendingScroll');

  const fetchTrending = useCallback(async (isBackground = false) => {
    try {
      const response = await fetch('/api/trending', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Failed to fetch trending: ${response.status}`);

      const data: TrendingToken[] = await response.json();

      // Debug log
      const featuredCount = data.filter((t: any) => t.isFeatured).length;
      console.log(`[Trending Page] Received ${data.length} tokens, ${featuredCount} are featured`);
      if (featuredCount > 0) {
        console.log(`[Trending Page] Featured tokens:`, data.filter((t: any) => t.isFeatured).map(t => ({ symbol: t.symbol, isFeatured: (t as any).isFeatured })));
      }

      setTokens(data);
    } catch (error) {
      if (!isBackground) {
        console.error('Error fetching trending:', error);
        setLoading(false);
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [setTokens]);

  useEffect(() => {
    fetchTrending(false);
    intervalRef.current = setInterval(() => fetchTrending(true), REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTrending]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTrending(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchTrending]);

  return (
    <div className="container mx-auto">
      <div className="p-2">
        <div className="mb-4">
          <h1 className="text-orange-500 text-2xl font-bold">Trending Tokens</h1>
          {/* <p className="text-gray-400 text-sm">Most active tokens by volume, liquidity, and momentum</p> */}
        </div>

        {loading ? (
          <TokenLoadingSkeleton count={15} />
        ) : tokens.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-white text-lg mb-2">No trending tokens available</p>
              <p className="text-gray-400">Check back soon for active tokens.</p>
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
                    {tokens.map((token, idx) => {
                      if (idx === 0) {
                        console.log(`[Trending Table] First token:`, token);
                        console.log(`[Trending Table] Tokens array:`, tokens.filter((t: any) => t.isFeatured));
                      }
                      return <TrendingRow key={token.address} token={token} />;
                    })}
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
