"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import { TOKEN_REGISTRY, TokenMetadata } from '@/lib/tokenRegistry';

const MULTIPLIERS = [2, 5, 10, 20, 50, 100] as const;
type Multiplier = typeof MULTIPLIERS[number];

const MULTIPLIER_STYLES: Record<Multiplier, { gradient: string; border: string; accent: string; badge: string }> = {
  2:   { gradient: 'from-white/10 to-white/3',          border: 'border-white/20',          accent: 'text-white',          badge: 'bg-white/15 text-white/80' },
  5:   { gradient: 'from-orange-200/15 to-orange-200/4', border: 'border-orange-200/25',    accent: 'text-orange-200',     badge: 'bg-orange-200/15 text-orange-200' },
  10:  { gradient: 'from-orange-300/15 to-orange-300/4', border: 'border-orange-300/25',    accent: 'text-orange-300',     badge: 'bg-orange-300/15 text-orange-300' },
  20:  { gradient: 'from-orange-400/15 to-orange-400/4', border: 'border-orange-400/25',    accent: 'text-orange-400',     badge: 'bg-orange-400/15 text-orange-400' },
  50:  { gradient: 'from-orange-500/15 to-orange-500/4', border: 'border-orange-500/25',    accent: 'text-orange-500',     badge: 'bg-orange-500/15 text-orange-500' },
  100: { gradient: 'from-orange-600/20 to-orange-600/5', border: 'border-orange-600/30',    accent: 'text-orange-600',     badge: 'bg-orange-600/20 text-orange-400' },
};

const CHAIN_STYLES: Record<string, { label: string; color: string }> = {
  bsc:  { label: 'BSC',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  sol:  { label: 'SOL',  color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  eth:  { label: 'ETH',  color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  rwa:  { label: 'RWA',  color: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

interface PriceData {
  token: string;
  price: string;
  marketCap: string;
  fdv: string;
  change24h: string;
  change1h: string;
  volume: string;
}

type PriceFormat = { zeros: number; sig: string } | { plain: string };

function parsePriceFormat(price: number): PriceFormat {
  if (price <= 0) return { plain: '$0.00' };
  if (price >= 1) return { plain: `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
  if (price >= 0.001) return { plain: `$${price.toFixed(6)}` };

  const s = price.toFixed(20);
  const dec = s.split('.')[1] ?? '';
  const zeros = dec.match(/^0+/)?.[0].length ?? 0;
  if (zeros >= 4) {
    return { zeros, sig: dec.substring(zeros, zeros + 5) };
  }
  return { plain: `$${price.toFixed(8)}` };
}

function PriceDisplay({ price, className = '' }: { price: number; className?: string }) {
  const fmt = parsePriceFormat(price);
  if ('plain' in fmt) return <span className={className}>{fmt.plain}</span>;
  return (
    <span className={className}>
      $0.0<sub style={{ fontSize: '0.65em', verticalAlign: 'sub' }}>{fmt.zeros}</sub>{fmt.sig}
    </span>
  );
}

function formatMC(val: number): string {
  if (!val || val <= 0) return '$—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toFixed(0)}`;
}

function formatUSD(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const DEFAULT_TOKEN = TOKEN_REGISTRY.find(t => t.symbol.toLowerCase() === 'pht' && t.chain === 'bsc') ?? TOKEN_REGISTRY[0];

export default function MultiplierPage() {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<TokenMetadata>(DEFAULT_TOKEN);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchPrice = useCallback(async (token: TokenMetadata, signal?: AbortSignal) => {
    setFetching(true);
    setFetchError(null);
    setPriceData(null);
    try {
      const res = await fetch(`/api/${token.chain}/token-price/${token.address}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: PriceData = await res.json();
      setPriceData(data);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setFetchError((e as Error).message ?? 'Failed to fetch price');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPrice(selected, ctrl.signal);
    return () => ctrl.abort();
  }, [selected, fetchPrice]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = TOKEN_REGISTRY.filter(t => {
    if (!t.symbol?.trim()) return false;
    const q = search.toLowerCase();
    return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  const grouped = filtered.reduce<Record<string, TokenMetadata[]>>((acc, t) => {
    (acc[t.chain] ??= []).push(t);
    return acc;
  }, {});

  const currentPrice = parseFloat(priceData?.price ?? '0');
  const currentMC = parseFloat(priceData?.marketCap ?? '0');
  const investAmount = parseFloat(amount) || 0;
  const tokensOwned = currentPrice > 0 && investAmount > 0 ? investAmount / currentPrice : 0;
  const change24h = parseFloat(priceData?.change24h ?? '0');

  return (
    <div className="min-h-screen text-white">
      {/* Title — scrolls away */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold uppercase mb-1" style={{ color: '#FF7F27' }}>
          Multiplier
        </h1>
        <p className="text-white/50 text-sm">
          Enter an amount and see your returns at each price multiplier
        </p>
      </div>

      {/* Sticky controls — sticks just below the app header (41px) */}
      <div className="sticky top-[41px] z-20 bg-[#360606] border-b border-white/8 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">

          {/* Token picker + amount row */}
          <div className="flex gap-3">
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                className="w-full flex items-center gap-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl px-4 py-2.5 transition-colors text-left"
                onClick={() => {
                  setShowDropdown(v => !v);
                  if (!showDropdown) {
                    setSearch('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white truncate">{selected.symbol.toUpperCase()}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${CHAIN_STYLES[selected.chain]?.color ?? 'bg-white/10 text-white/60 border-white/20'}`}>
                      {CHAIN_STYLES[selected.chain]?.label ?? selected.chain.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white/50 text-xs truncate block">{selected.name}</span>
                </div>
                <svg className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute z-30 mt-1 w-full bg-[#1a0404] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Search tokens..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 outline-none"
                    />
                  </div>
                  <div className="overflow-y-auto max-h-64">
                    {Object.entries(grouped).map(([chain, tokens]) => (
                      <div key={chain}>
                        <div className="px-3 py-1.5 text-xs font-semibold text-white/40 uppercase tracking-wider bg-white/3">
                          {CHAIN_STYLES[chain]?.label ?? chain.toUpperCase()}
                        </div>
                        {tokens.map(t => (
                          <button
                            key={t.address}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/8 transition-colors text-left ${selected.address === t.address ? 'bg-white/10' : ''}`}
                            onMouseDown={e => {
                              e.preventDefault();
                              setSelected(t);
                              setShowDropdown(false);
                              setSearch('');
                            }}
                          >
                            <span className="font-semibold text-white text-sm">{t.symbol.toUpperCase()}</span>
                            <span className="text-white/50 text-xs truncate">{t.name}</span>
                            {selected.address === t.address && (
                              <svg className="w-3.5 h-3.5 text-[#FF7F27] ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-4 py-6 text-white/40 text-sm text-center">No tokens found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Amount input */}
            <div className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-1">
              <span className="text-white/40 text-sm">$</span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="100"
                className="flex-1 bg-transparent text-white text-sm font-semibold outline-none w-full placeholder-white/30"
              />
            </div>
          </div>

          {/* Current price band */}
          <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-2.5">
            {fetching ? (
              <div className="flex items-center gap-4 animate-pulse">
                <div className="h-6 w-28 bg-white/10 rounded" />
                <div className="h-5 w-20 bg-white/10 rounded" />
                <div className="h-5 w-16 bg-white/10 rounded" />
              </div>
            ) : fetchError ? (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {fetchError}
              </div>
            ) : priceData ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Price</p>
                  <PriceDisplay price={currentPrice} className="text-base font-bold text-white" />
                </div>
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">Market Cap</p>
                  <p className="text-base font-semibold text-white">{formatMC(currentMC)}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">24h</p>
                  <p className={`text-base font-semibold ${change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                  </p>
                </div>
                {investAmount > 0 && currentPrice > 0 && (
                  <div>
                    <p className="text-white/40 text-[10px] uppercase tracking-wide mb-0.5">You Get</p>
                    <p className="text-base font-semibold text-white">
                      {tokensOwned < 0.001
                        ? tokensOwned.toExponential(3)
                        : tokensOwned.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      } {selected.symbol.toUpperCase()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/30 text-sm">Waiting for price data…</p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable multiplier cards */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
        {priceData && currentPrice > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MULTIPLIERS.map(mult => {
              const styles = MULTIPLIER_STYLES[mult];
              const targetPrice = currentPrice * mult;
              const targetMC = currentMC * mult;
              const portfolioValue = investAmount * mult;
              const profit = portfolioValue - investAmount;

              return (
                <div
                  key={mult}
                  className={`relative rounded-2xl border ${styles.border} bg-gradient-to-br ${styles.gradient} p-4 overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.99]`}
                >
                  {/* Multiplier badge */}
                  <div className="flex items-start justify-between mb-3">
                    <span className={`text-2xl font-black ${styles.accent}`}>{mult}x</span>
                    {investAmount > 0 && (
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles.badge}`}>
                        +{((mult - 1) * 100).toLocaleString()}%
                      </span>
                    )}
                  </div>

                  {/* Price + MC row */}
                  <div className="flex justify-between items-end gap-2 mb-2">
                    <div>
                      <p className="text-white/40 text-xs mb-0.5">Target Price</p>
                      <PriceDisplay price={targetPrice} className={`text-lg font-bold ${styles.accent}`} />
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs mb-0.5">Market Cap</p>
                      <p className="text-white font-semibold text-sm">{formatMC(targetMC)}</p>
                    </div>
                  </div>

                  {/* Investment */}
                  {investAmount > 0 && (
                    <div className="pt-2 border-t border-white/10 flex justify-between items-end">
                      <div>
                        <p className="text-white/40 text-xs mb-0.5">Your Value</p>
                        <p className="text-white font-bold text-sm">{formatUSD(portfolioValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-xs mb-0.5">Profit</p>
                        <p className={`font-bold text-sm ${styles.accent}`}>+{formatUSD(profit)}</p>
                      </div>
                    </div>
                  )}

                  {/* Glow accent */}
                  <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 blur-2xl bg-current pointer-events-none ${styles.accent}`} />
                </div>
              );
            })}
          </div>
        ) : !fetching && !fetchError ? (
          <div className="text-center py-12 text-white/30 text-sm">Loading token data…</div>
        ) : null}

        {/* Skeleton while fetching */}
        {fetching && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
            {MULTIPLIERS.map(m => (
              <div key={m} className="rounded-2xl border border-white/8 bg-white/4 p-4 h-32" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
