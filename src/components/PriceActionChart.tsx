"use client";

import { useEffect, useRef, useState } from "react";
import Chart from 'chart.js/auto';

type SupportedChain = "bsc" | "sol" | "eth" | "rwa";

interface PriceActionChartProps {
  chain: SupportedChain;
  contractAddress: string;
  tokenSymbol: string;
}

interface MarketChartResponse {
  prices: [number, number][]; // [timestamp(ms), price]
  total_volumes: [number, number][]; // [timestamp(ms), volume]
  market_caps: [number, number][]; // [timestamp(ms), market_cap]
}

interface CryptoCompareResponse {
  Data: {
    Data: Array<{
      time: number; // timestamp in seconds
      close: number; // price
      high: number;
      low: number;
      open: number;
      volumefrom: number;
      volumeto: number;
    }>;
  };
  Response?: string;
  Message?: string;
}

interface SupabaseAnalysisResponse {
  priceChart: {
    candles: Array<{
      time: number; // timestamp in seconds
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  };
}

const TIMEFRAMES = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

// type DataSource = "coingecko" | "cryptocompare" | "rwa" | null;

function getPlatformId(chain: SupportedChain): string {
  if (chain === "bsc") return "binance-smart-chain";
  if (chain === "eth") return "ethereum";
  return "solana";
}

function getSymbolFromChain(chain: SupportedChain): string {
  // Simplified mapping - adjust as needed
  if (chain === "bsc") return "BNB";
  if (chain === "eth") return "ETH";
  return "SOL";
}

function getHistoEndpoint(days: number): string {
  if (days <= 1) return "histominute";
  if (days <= 7) return "histohour";
  return "histoday";
}

function getHistoLimit(days: number): number {
  if (days <= 1) return 1440; // 24 hours * 60 minutes
  if (days <= 7) return 168; // 7 days * 24 hours
  if (days <= 30) return 30;
  return 90;
}

export default function PriceActionChart({
  chain,
  contractAddress,
  tokenSymbol
}: PriceActionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const cacheRef = useRef<Map<string, { prices: number[]; labels: string[]; ts: number }>>(new Map());
  const dataMaxRef = useRef<number>(0);
  const [data, setData] = useState<{ prices: number[]; labels: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isChartReady = true;
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<number>(1);
  // const [dataSource, setDataSource] = useState<DataSource>(null);

  // Get CryptoCompare API key from environment variable
  // const cryptocompareApiKey = process.env.CRYPTOCOMPARE_API_KEY || "a2908b51095ddf69552f5dd2caabe3f9a12d2507f8ed32987008c936c1caff61";

  // const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${getPlatformId(chain)}/contract/${encodeURIComponent(
  //   contractAddress
  // )}/market_chart?vs_currency=usd&days=${selectedTimeframe}`;

  // Chart.js is available via ESM import

  // Fetch data with fallback logic, retries, and abort handling
  useEffect(() => {
    // Fetch from internal RWA price-data route (proxies to external AssetChain API)
    // Map selectedTimeframe -> selector: D=24h, W=weekly, Y=90d
    async function fetchFromRWA(signal: AbortSignal): Promise<{ prices: number[]; labels: string[] }> {
      const selector = selectedTimeframe <= 1 ? 'D' : selectedTimeframe <= 7 ? 'W' : 'Y';
      const url = `/api/rwa/price-data/${encodeURIComponent(contractAddress)}?selector=${encodeURIComponent(selector)}`;
      console.log('Fetching from RWA internal API:', url);

      const resp = await fetch(url, { signal });
      if (!resp.ok) {
        throw new Error(`RWA price API failed: ${resp.status}`);
      }

      const json = await resp.json();

      // Helper to coerce different time formats into milliseconds since epoch
      function toMs(value: any): number | null {
        if (value == null) return null;
        // number already
        if (typeof value === 'number' && !Number.isNaN(value)) {
          // heuristics: > 1e12 -> ms, > 1e9 -> seconds
          if (value > 1e12) return value;
          if (value > 1e9) return value * 1000;
          // small numbers unlikely, return as-is
          return value;
        }
        // numeric string
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (/^\d+$/.test(trimmed)) {
            const n = Number(trimmed);
            if (trimmed.length >= 13) return n;
            if (trimmed.length === 10) return n * 1000;
            if (n > 1e12) return n;
            if (n > 1e9) return n * 1000;
            return n;
          }
          // try parsing ISO date string
          const parsed = Date.parse(trimmed);
          if (!Number.isNaN(parsed)) return parsed;
        }
        return null;
      }

      // Try to normalize several common shapes
      // 1) { prices: [ [timestamp_ms, price], ... ] }
      if (Array.isArray(json.prices) && json.prices.length > 0 && Array.isArray(json.prices[0])) {
        const prices: number[] = [];
        const labels: string[] = [];
        json.prices.forEach((p: any) => {
          const ms = toMs(p[0]);
          if (ms == null) return;
          const price = Number(p[1]);
          if (Number.isNaN(price)) return;
          prices.push(price);
          const date = new Date(ms);
          labels.push(selectedTimeframe <= 1 ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' }));
        });
        return { prices, labels };
      }

      // 2) { data: [{ time, close }, ...] }
      if (Array.isArray(json.data) && json.data.length > 0 && (json.data[0].time || json.data[0].timestamp) && (json.data[0].close || json.data[0].price)) {
        const prices: number[] = [];
        const labels: string[] = [];
        json.data.forEach((d: any) => {
          const ms = toMs(d.time ?? d.timestamp);
          if (ms == null) return;
          const price = Number(d.close ?? d.price ?? 0);
          if (Number.isNaN(price)) return;
          prices.push(price);
          const date = new Date(ms);
          labels.push(selectedTimeframe <= 1 ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' }));
        });
        return { prices, labels };
      }

      // 3) If the API returns an array at top-level of points { timestamp, price }
      if (Array.isArray(json) && json.length > 0 && (json[0].timestamp || json[0].time) && (json[0].price || json[0].close)) {
        const prices: number[] = [];
        const labels: string[] = [];
        json.forEach((d: any) => {
          const ms = toMs(d.timestamp ?? d.time);
          if (ms == null) return;
          const price = Number(d.price ?? d.close ?? 0);
          if (Number.isNaN(price)) return;
          prices.push(price);
          const date = new Date(ms);
          labels.push(selectedTimeframe <= 1 ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { month: 'short', day: 'numeric' }));
        });
        return { prices, labels };
      }

      // Otherwise, can't parse
      throw new Error('Unrecognized RWA price data format');
    }

    // Fetch from Supabase Token Analysis API
    async function fetchFromSupabase(signal: AbortSignal): Promise<{ prices: number[]; labels: string[] }> {
      let timeframeParam = '1y'; // Default
      if (selectedTimeframe <= 1) timeframeParam = '1d';
      else if (selectedTimeframe <= 7) timeframeParam = '7d';
      else if (selectedTimeframe <= 30) timeframeParam = '30d';
      else if (selectedTimeframe <= 90) timeframeParam = '3m';

  // Use the explicit Supabase Functions host directly (no env variables)
  const supabaseBase = 'https://enpdzndcjxlzupmxpmms.supabase.co';

  // Construct the function URL and encode parameters
  const url = `${supabaseBase}/functions/v1/token-analysis-api?chain=${encodeURIComponent(
    chain
  )}&token=${encodeURIComponent(contractAddress)}&timeframe=${encodeURIComponent(timeframeParam)}`;
  console.log('Fetching from Supabase (direct):', url);

  // Fetch directly from the hardcoded function URL. Do not include env-based headers here.
  const resp = await fetch(url, { signal, cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`Supabase API failed: ${resp.status}`);
      }

      const json = (await resp.json()) as SupabaseAnalysisResponse;
      if (!json.priceChart?.candles || json.priceChart.candles.length === 0) {
        throw new Error('No price data from Supabase');
      }

      const prices: number[] = [];
      const labels: string[] = [];

      // Normalize, validate, sort and deduplicate candles
      const raw = json.priceChart.candles || [];
      const normalized = raw
        .map((candle) => {
          const time = Number(candle.time);
          // convert seconds -> ms if value looks like seconds
          const timeMs = time > 1e12 ? time : time * 1000;
          const close = Number((candle as any).close ?? (candle as any).price ?? (candle as any).close);
          return { timeMs, close };
        })
        .filter((c) => Number.isFinite(c.timeMs) && Number.isFinite(c.close));

      // sort by time ascending
      normalized.sort((a, b) => a.timeMs - b.timeMs);

      // dedupe by time (keep last value for duplicate timestamps)
      const deduped: { timeMs: number; close: number }[] = [];
      for (const p of normalized) {
        const last = deduped[deduped.length - 1];
        if (last && last.timeMs === p.timeMs) {
          // replace
          deduped[deduped.length - 1] = p;
        } else {
          deduped.push(p);
        }
      }

      deduped.forEach((candle) => {
        prices.push(candle.close);
        const date = new Date(candle.timeMs);
        let timeLabel: string;
        if (selectedTimeframe <= 1) {
          timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
        labels.push(timeLabel);
      });

      // store max for formatting
      dataMaxRef.current = prices.length ? Math.max(...prices) : 0;

      return { prices, labels };
    }

    // Fetch from CoinGecko
    // async function fetchFromCoinGecko(signal: AbortSignal): Promise<{ prices: number[]; labels: string[] }> {
    //   console.log('Fetching from CoinGecko:', coingeckoUrl);

    //   // Retry with simple backoff for 429/5xx
    //   const maxAttempts = 3;
    //   let lastErr: any = null;
    //   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    //     try {
    //       const resp = await fetch(coingeckoUrl, { cache: 'no-store', signal });
    //       if (!resp.ok) {
    //         if ([429, 500, 502, 503, 504].includes(resp.status) && attempt < maxAttempts) {
    //           const delay = 300 * attempt;
    //           await new Promise((r) => setTimeout(r, delay));
    //           continue;
    //         }
    //         throw new Error(`CoinGecko API failed: ${resp.status}`);
    //       }
    //       const json = (await resp.json()) as MarketChartResponse;
    //       if (!json.prices || json.prices.length === 0) {
    //         throw new Error('No price data from CoinGecko');
    //       }

    //       const prices: number[] = [];
    //       const labels: string[] = [];

    //       json.prices.forEach(([timestamp, price]) => {
    //         prices.push(price);
    //         const date = new Date(timestamp);
    //         let timeLabel: string;
    //         if (selectedTimeframe <= 1) {
    //           timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    //         } else {
    //           timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    //         }
    //         labels.push(timeLabel);
    //       });
    //       return { prices, labels };
    //     } catch (err: any) {
    //       if (signal.aborted) throw err;
    //       lastErr = err;
    //       if (attempt === maxAttempts) throw err;
    //     }
    //   }
    //   throw lastErr || new Error('CoinGecko failed');
    // }

    // Fetch from CryptoCompare as fallback
    // async function fetchFromCryptoCompare(signal: AbortSignal): Promise<{ prices: number[]; labels: string[] }> {
    //   const symbol = getSymbolFromChain(chain);
    //   const endpoint = getHistoEndpoint(selectedTimeframe);
    //   const limit = getHistoLimit(selectedTimeframe);

    //   // Build URL with API key if provided
    //   let url = `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}`;

    //   if (cryptocompareApiKey) {
    //     url += `&api_key=${cryptocompareApiKey}`;
    //   }

    //   console.log('Fetching from CryptoCompare:', url.replace(cryptocompareApiKey || '', '***'));
    //   // Retry with backoff for 429/5xx
    //   const maxAttempts = 2;
    //   let resp: Response | null = null;
    //   for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    //     try {
    //       resp = await fetch(url, { signal });
    //       if (!resp.ok) {
    //         if ([429, 500, 502, 503, 504].includes(resp.status) && attempt < maxAttempts) {
    //           const delay = 300 * attempt;
    //           await new Promise((r) => setTimeout(r, delay));
    //           continue;
    //         }
    //         throw new Error(`CryptoCompare API failed: ${resp.status}`);
    //       }
    //       break;
    //     } catch (err) {
    //       if (signal.aborted) throw err;
    //       if (attempt === maxAttempts) throw err;
    //     }
    //   }
    //   if (!resp) throw new Error('CryptoCompare: no response');
    //   const json = (await resp.json()) as CryptoCompareResponse;

    //   // Check for API error response
    //   if (json.Response === 'Error') {
    //     throw new Error(json.Message || 'CryptoCompare API error');
    //   }

    //   if (!json.Data?.Data || json.Data.Data.length === 0) {
    //     throw new Error('No data from CryptoCompare');
    //   }

    //   const prices: number[] = [];
    //   const labels: string[] = [];

    //   json.Data.Data.forEach((dataPoint) => {
    //     prices.push(dataPoint.close);

    //     const date = new Date(dataPoint.time * 1000); // Convert seconds to milliseconds
    //     let timeLabel: string;

    //     if (selectedTimeframe <= 1) {
    //       timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    //     } else if (selectedTimeframe <= 7) {
    //       timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    //     } else {
    //       timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    //     }

    //     labels.push(timeLabel);
    //   });

    //   return { prices, labels };
    // }

    const abortController = new AbortController();
    const { signal } = abortController;
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        // setDataSource(null);
        const key = `${chain}:${contractAddress}:${selectedTimeframe}`;
        // Serve stale cache immediately if present
        const cached = cacheRef.current.get(key);
        if (cached && !cancelled) {
          setData({ prices: cached.prices, labels: cached.labels });
        }

        // If this is an RWA token, use internal RWA price-data route first
        if (chain === 'rwa') {
          try {
            const rwaData = await fetchFromRWA(signal);
            console.log('RWA data loaded:', rwaData.prices.length, 'points');
            setData(rwaData);
            // setDataSource('rwa');
            cacheRef.current.set(key, { ...rwaData, ts: Date.now() });
            return;
          } catch (rwaErr) {
            console.warn('RWA data failed, falling back to other providers:', rwaErr);
            // fallthrough to other providers
          }
        }

        // Use Supabase Token Analysis API for BSC and ETH
        if (chain === 'bsc' || chain === 'eth') {
          try {
            const supabaseData = await fetchFromSupabase(signal);
            console.log('Supabase data loaded:', supabaseData.prices.length, 'points');
            setData(supabaseData);
            cacheRef.current.set(key, { ...supabaseData, ts: Date.now() });
            return;
          } catch (sbError) {
            console.warn('Supabase API failed for chain', chain, sbError);
            throw sbError; // let outer catch handle display
          }
        }

        // If chain is not supported by Supabase and not RWA, show unsupported
        if (chain !== 'rwa') {
          throw new Error(`Unsupported chain for price data: ${chain}`);
        }

        // Otherwise (chain === 'rwa') we already attempted RWA above; fallthrough to error
        try {
          // const coinGeckoData = await fetchFromCoinGecko(signal);
          // console.log('CoinGecko data loaded:', coinGeckoData.prices.length, 'points');
          // setData(coinGeckoData);
          // setDataSource("coingecko");
          // cacheRef.current.set(key, { ...coinGeckoData, ts: Date.now() });
          // return;
        } catch (cgError) {
          console.warn('CoinGecko failed, trying CryptoCompare:', cgError);

          // // Fallback to CryptoCompare if API key is provided
          // if (!cryptocompareApiKey) {
          //   throw new Error('CoinGecko failed and no CryptoCompare API key provided. Get a free key at https://www.cryptocompare.com/cryptopian/api-keys');
          // }

          // const cryptoCompareData = await fetchFromCryptoCompare(signal);
          // console.log('CryptoCompare data loaded:', cryptoCompareData.prices.length, 'points');
          // setData(cryptoCompareData);
          // // setDataSource("cryptocompare");
          // cacheRef.current.set(key, { ...cryptoCompareData, ts: Date.now() });
        }
      } catch (e) {
        console.error('All data sources failed:', e);
        setError(e instanceof Error ? e.message : "Failed to fetch price data from all sources");
      } finally {
        setLoading(false);
      }
    }

    if (contractAddress) {
      loadData();
    }
    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [ contractAddress, selectedTimeframe, chain]);

  // Create chart
  useEffect(() => {
    if (!isChartReady || !data || !canvasRef.current) {
      console.log('Chart not ready:', { isChartReady, hasData: !!data, hasCanvas: !!canvasRef.current });
      return;
    }

    console.log('Creating chart with', data.prices.length, 'data points');

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      console.log('No canvas context');
      return;
    }

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    try {
      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.labels,
          datasets: [
            {
              label: "Price",
              data: data.prices,
              borderColor: "#f97316",
              backgroundColor: "rgba(249, 115, 22, 0.1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              display: true,
              ticks: {
                maxTicksLimit: 8,
                color: "#9ca3af",
              },
              grid: {
                color: "rgba(255,255,255,0.06)",
              },
            },
            y: {
              display: true,
              ticks: {
                callback: (val: any) => {
                  const price = Number(val);
                  if (!Number.isFinite(price)) return '';
                  const max = dataMaxRef.current || Math.abs(price);
                  if (price === 0) return '$0';
                  if (max >= 1000) return `$${price.toFixed(2)}`;
                  if (max >= 1) return `$${price.toFixed(4)}`;
                  if (max >= 0.01) return `$${price.toFixed(4)}`;
                  // For very small prices, use exponential with 2 decimals
                  return `$${price.toExponential(2)}`;
                },
                color: "#9ca3af",
              },
              grid: {
                color: "rgba(255,255,255,0.06)",
              },
            },
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const value = Number(ctx.parsed.y);
                  if (!Number.isFinite(value)) return '';
                  const max = dataMaxRef.current || Math.abs(value);
                  if (max >= 1) {
                    return `Price: $${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
                  }
                  // small prices -> exponential
                  return `Price: $${value.toExponential(6)}`;
                },
              },
            },
          },
        },
      });

      console.log('Chart created successfully');
    } catch (chartError) {
      console.error('Chart creation failed:', chartError);
      setError('Failed to create chart');
    }
    return () => {
      try {
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }
      } catch { }
    };
  }, [isChartReady, data]);

  return (
    <div className="mt-4 rounded-md p-4">
      {/* Chart.js is loaded dynamically in a useEffect */}

      {/* Header */}
      {/* <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold"> {tokenSymbol} Price Action</h3>
        <span className="text-xs text-gray-400">
          Source: {dataSource === "coingecko" ? "CoinGecko" : dataSource === "cryptocompare" ? "CryptoCompare" : dataSource === 'rwa' ? 'AssetChain (RWA)' : "..."}
        </span>
      </div> */}

      {/* Chart or status */}
      {loading ? (
        <div className="text-center text-sm text-white py-8">Loading price data…</div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="text-sm text-red-500 mb-2">{error}</div>
          {/* {!cryptocompareApiKey && error.includes('CryptoCompare') && (
            <a
              href="https://www.cryptocompare.com/cryptopian/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Get a free CryptoCompare API key →
            </a>
          )} */}
        </div>
      ) : data && data.prices.length > 0 ? (
        <div className="h-64 md:h-80">
          <canvas ref={canvasRef} />
        </div>
      ) : (
        <div className="text-center text-sm text-gray-400 py-8">No price data available.</div>
      )}

      {/* Timeframe selector */}
      <div className="flex justify-between items-center gap-2 mb-4">
        {TIMEFRAMES.map((timeframe) => (
          <button
            key={timeframe.days}
            onClick={() => setSelectedTimeframe(timeframe.days)}
            className={`flex-1 px-3 py-1 text-xs rounded ${selectedTimeframe === timeframe.days
              ? "bg-orange-500 text-white"
              : "bg-neutral-200 text-black hover:bg-neutral-600"
              }`}
          >
            {timeframe.label}
          </button>
        ))}
      </div>

    </div>
  );
}