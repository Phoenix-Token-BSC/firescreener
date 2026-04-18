'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';
// import { getTokenBySymbol } from '@/lib/tokenRegistry';

interface Token {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string | number;
  marketCap: string | number;
  volume: string | number;
  liquidity: string | number;
  change24h?: string | number;
}

interface TokenWithFlash extends Token {
  _flashFields?: Set<string>;
}

const REFRESH_INTERVAL = 15_000;


function useFlashOnChange(value: string | number, flashDuration = 600) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), flashDuration);
      return () => clearTimeout(t);
    }
  }, [value, flashDuration]);

  return flashing;
}


function formatCompactNumber(value: number | string): string {
  if (typeof value === 'string') {
    value = parseFloat(value.replace(/[^0-9.-]+/g, ''));
  }

  if (isNaN(value) || value === 0) {
    return 'N/A';
  }

  if (value >= 1e12) {
    return (value / 1e12).toFixed(1) + 'T';
  }
  if (value >= 1e9) {
    return (value / 1e9).toFixed(1) + 'B';
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(1) + 'M';
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(0) + 'K';
  }
  return value.toFixed(1);
}

function formatPrice(price: number | string): { display: string; isExponential: boolean; zeros?: number; rest?: string } {
  // Handle N/A or invalid values
  if (price === 'N/A' || price === null || price === undefined || price === '') {
    return {
      display: 'N/A',
      isExponential: false,
    };
  }

  // Convert to number if it's a string
  let priceNum: number;
  if (typeof price === 'string') {
    // Remove any non-numeric characters except decimal point and minus sign
    const cleanedPrice = price.replace(/[^0-9.-]/g, '');
    priceNum = parseFloat(cleanedPrice);
  } else {
    priceNum = price;
  }

  // Check if conversion failed
  if (isNaN(priceNum)) {
    return {
      display: 'N/A',
      isExponential: false,
    };
  }

  // Force decimal notation to check for leading zeros (prevents scientific notation issues)
  const priceStr = priceNum.toFixed(20);

  // Check for very small numbers with many leading zeros (more than 4 zeros)
  if (priceStr.includes('.')) {
    const decimalPart = priceStr.split('.')[1];
    if (decimalPart) {
      const leadingZeros = decimalPart.match(/^0+/)?.[0].length || 0;
      // Use exponential formatting if more than 4 leading zeros
      if (leadingZeros > 4) {
        const restOfNumber = decimalPart.substring(leadingZeros).substring(0, 6); // Limit to 6 digits
        return {
          display: '$0.',
          isExponential: true,
          zeros: leadingZeros,
          rest: restOfNumber,
        };
      }
    }
  }

  // For regular numbers, format with appropriate decimal places
  let formattedPrice: string;
  if (priceNum >= 1) {
    formattedPrice = priceNum.toFixed(2);
  } else if (priceNum >= 0.01) {
    formattedPrice = priceNum.toFixed(6);
  } else {
    formattedPrice = priceNum.toFixed(8);
  }

  return {
    display: '$' + formattedPrice,
    isExponential: false,
  };
}

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

// Memoized mobile card too
const TokenCard = React.memo(function TokenCard({ token }: { token: Token }) {
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
    <Link
      href={`/${token.chain}/${token.address}`}
      className="rounded-lg p-2 hover:border-orange-500 border-b border-orange-500 transition-all hover:shadow-lg hover:shadow-orange-500/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src={`/api/${token.chain}/logo/${token.address}`}
              alt={token.symbol}
              width={36}
              height={36}
              className="rounded-md"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
            />
            <img
              src={`/${token.chain}-logo.png`}
              alt={token.chain}
              width={16}
              height={16}
              className="absolute -bottom-1 rounded-sm border-2 border-black"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-white font-bold text-lg whitespace-nowrap truncate">{token.symbol.toUpperCase()}</span>
            <span className="text-neutral-200 text-xs whitespace-nowrap truncate">{token.name}</span>
          </div>
        </div>

        <div className="flex flex-col ml-3 gap-2">
          <div className="flex flex-col items-end">
            <div className="flex flex-row items-center gap-2 text-right flex-shrink-0">
              <span
                className="text-white font-semibold text-md whitespace-nowrap transition-opacity duration-300"
                style={{ opacity: priceFlash ? 0.4 : 1 }}
              >
                {priceDisplay}
              </span>
              {token.change24h !== 'N/A' && token.change24h !== undefined && (() => {
                const change = parseFloat(String(token.change24h));
                const isPositive = change >= 0;
                return (
                  <span
                    className={`text-sm transition-opacity duration-300 ${isPositive ? 'text-green-500' : 'text-red-500'}`}
                    style={{ opacity: changeFlash ? 0.4 : 1 }}
                  >
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="flex gap-2 justify-between">
            <div className="flex flex-row gap-1 items-center">
              <div className="text-orange-500 text-xs font-medium">VOL</div>
              <div
                className="text-white text-xs font-semibold transition-opacity duration-300"
                style={{ opacity: volFlash ? 0.4 : 1 }}
              >
                ${formatCompactNumber(token.volume)}
              </div>
            </div>
            <div className="flex flex-row gap-1 items-center">
              <div className="text-orange-500 text-xs font-medium">LIQ.</div>
              <div
                className="text-white text-xs font-semibold transition-opacity duration-300"
                style={{ opacity: liqFlash ? 0.4 : 1 }}
              >
                ${formatCompactNumber(token.liquidity)}
              </div>
            </div>
            <div className="flex flex-row gap-1 items-center">
              <div className="text-orange-500 text-xs font-medium">MC</div>
              <div
                className="text-white text-xs font-semibold transition-opacity duration-300"
                style={{ opacity: mcFlash ? 0.4 : 1 }}
              >
                ${formatCompactNumber(token.marketCap)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
});

export default function Home() {
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

        const phtToken = data.find(t => t.symbol.toLowerCase() === 'pht');
        const otherTokens = data.filter(t => t.symbol.toLowerCase() !== 'pht');
        const sortedData = phtToken ? [phtToken, ...otherTokens] : data;

        setTokens(prev => {
          if (!isBackground) return sortedData;

          // Merge: preserve order from prev, only update changed values.
          // This means React only re-renders rows whose props actually changed
          // (React.memo handles the bailout).
          const incoming = new Map(sortedData.map(t => [t.address, t]));
          return prev.map(t => {
            const fresh = incoming.get(t.address);
            if (!fresh) return t;
            // Return same object reference if nothing changed → React.memo skips re-render
            const changed =
              t.price !== fresh.price ||
              t.marketCap !== fresh.marketCap ||
              t.volume !== fresh.volume ||
              t.liquidity !== fresh.liquidity ||
              t.change24h !== fresh.change24h;
            return changed ? fresh : t;
          });
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
      fetchTokens(false);

      intervalRef.current = setInterval(() => {
        fetchTokens(true);
      }, REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [fetchTokens]);

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
        <Header />
        <div className="p-2">
          {loading ? (
            <TokenLoadingSkeleton count={6} />
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