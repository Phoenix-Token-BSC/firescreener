'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import TokenLoadingSkeleton from '@/components/TokenLoadingSkeleton';
import { useFlashOnChange, formatCompactNumber, formatPrice } from '@/lib/tokenFormatting';
import { Flame, Clock } from 'lucide-react';

interface NewListing {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  isBurn: boolean;
  listedAt: string;
  price: string | number;
  marketCap: string | number;
  volume: string | number;
  change24h?: string | number;
  liquidity: string | number;
}

const REFRESH_INTERVAL = 15_000;

const WINDOWS = [
  { hours: 24, label: '24 hours' },
];

/** "just now", "14m ago", "3h ago" — precision the market cap board doesn't need. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Newest listings glow briefly so they stand out in a list that reorders. */
function isFresh(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 60 * 60 * 1000;
}

const ListingRow = React.memo(function ListingRow({ token }: { token: NewListing }) {
  const priceFlash = useFlashOnChange(token.price);
  const changeFlash = useFlashOnChange(token.change24h ?? 'N/A');

  const { display, isExponential, zeros, rest } = formatPrice(token.price);
  const priceDisplay =
    display === 'N/A' ? (
      <span className="text-neutral-400">N/A</span>
    ) : isExponential ? (
      <>
        {display}0<sub>{zeros}</sub>
        {rest}
      </>
    ) : (
      display
    );

  const change = token.change24h === 'N/A' || token.change24h === undefined
    ? null
    : parseFloat(String(token.change24h));

  return (
    <tr className="border-b border-orange-800 hover:bg-black/50 transition-colors">
      <td className="px-5 py-2 text-sm sticky left-0 z-10 min-w-[190px] border-l border-r border-orange-800 bg-inherit">
        <Link href={`/${token.chain}/${token.address}`} className="flex items-center hover:opacity-80">
          <div className="relative flex-shrink-0 mr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/${token.chain}/logo/${token.address}`}
              alt={token.symbol}
              width={24}
              height={24}
              className="rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png'; }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/${token.chain}-logo.png`}
              alt={token.chain}
              width={10}
              height={10}
              className="absolute -bottom-1 -right-1 rounded-sm border-2 border-black"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-white whitespace-nowrap font-medium text-sm flex items-center gap-1.5">
              {token.symbol.toUpperCase()}
              {token.isBurn && <Flame size={12} className="text-orange-500" />}
              {isFresh(token.listedAt) && (
                <span className="text-[9px] uppercase tracking-wider font-bold px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                  New
                </span>
              )}
            </span>
            <span className="text-gray-400 text-xs truncate">{token.name}</span>
          </div>
        </Link>
      </td>

      <td className="px-5 py-2 text-sm min-w-[110px] border-r border-orange-800">
        <span className="text-orange-300 whitespace-nowrap text-xs font-medium">
          {timeAgo(token.listedAt)}
        </span>
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span
          className="text-white text-sm whitespace-nowrap transition-opacity duration-300"
          style={{ opacity: priceFlash ? 0.4 : 1 }}
        >
          {priceDisplay}
        </span>
      </td>

      <td className="px-5 py-2 text-xs min-w-[110px] border-r border-orange-800">
        {change === null || Number.isNaN(change) ? (
          <span className="text-white whitespace-nowrap">N/A</span>
        ) : (
          <span
            className={`whitespace-nowrap font-medium transition-opacity duration-300 ${
              change >= 0 ? 'text-green-500' : 'text-red-500'
            }`}
            style={{ opacity: changeFlash ? 0.4 : 1 }}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </span>
        )}
      </td>

      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span className="text-white whitespace-nowrap">{formatCompactNumber(token.marketCap)}</span>
      </td>
      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span className="text-white whitespace-nowrap">{formatCompactNumber(token.liquidity)}</span>
      </td>
      <td className="px-5 py-2 text-sm min-w-[120px] border-r border-orange-800">
        <span className="text-white whitespace-nowrap">{formatCompactNumber(token.volume)}</span>
      </td>
    </tr>
  );
});

export default function ListingsPage() {
  const [tokens, setTokens] = useState<NewListing[]>([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await fetch(`/api/tokens/new?hours=${hours}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load new listings');
      const data = await res.json();
      setTokens(data.tokens ?? []);
      setError(null);
    } catch (err) {
      // A failed background poll should not wipe a list that is already on screen.
      if (!background) setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!background) setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen px-3 md:px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Clock className="text-orange-500" size={26} />
              New Listings
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Newest first, by the moment each token went live — not by market cap.
            </p>
          </div>

          <div className="flex gap-2">
            {WINDOWS.map((w) => (
              <button
                key={w.hours}
                onClick={() => setHours(w.hours)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  hours === w.hours
                    ? 'bg-orange-500 text-white'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <TokenLoadingSkeleton />
        ) : error ? (
          <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-6 text-red-300">{error}</div>
        ) : tokens.length === 0 ? (
          <div className="border border-orange-500/30 bg-orange-500/5 rounded-xl p-10 text-center">
            <Clock className="mx-auto mb-3 text-orange-500" size={28} />
            <h2 className="text-lg font-semibold mb-1">Nothing listed in the last {WINDOWS.find(w => w.hours === hours)?.label}</h2>
            <p className="text-neutral-400 mb-6">
              Try a wider window, or list your own token — it appears here the moment it goes live.
            </p>
            <Link
              href="/list-your-token"
              className="inline-block bg-orange-500 px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              List a token
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-500 mb-3">
              {tokens.length} token{tokens.length === 1 ? '' : 's'} listed in the last{' '}
              {WINDOWS.find((w) => w.hours === hours)?.label} · refreshes every 15s
            </p>

            <div className="shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="bg-orange-500 border-b border-orange-800">
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left sticky left-0 bg-orange-500 z-20 min-w-[190px] border-l border-r border-orange-800">Token</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[110px] border-r border-orange-800">Listed</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Price</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[110px] border-r border-orange-800">24H</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Market Cap</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">Liquidity</th>
                      <th className="text-sm font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px] border-r border-orange-800">24H Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <ListingRow key={`${token.chain}-${token.address}`} token={token} />
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
