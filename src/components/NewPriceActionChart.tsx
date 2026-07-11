"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, Time, ISeriesApi, AreaSeries, CrosshairMode } from 'lightweight-charts';

type SupportedChain = "bsc" | "sol" | "rwa" | "eth";

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

interface CandlestickData {
    time: number; // Unix timestamp in seconds
    open: number;
    high: number;
    low: number;
    close: number;
}

interface PriceTick {
    y: number;
    price: number;
}

interface CrosshairPrice {
    y: number;
    price: number;
}

const MAX_TIMEFRAME_DAYS = 365; // Always fetch 1 year of data

function getPlatformId(chain: SupportedChain): string {
    return chain === "bsc" ? "binance-smart-chain" : "ethereum" ;
}

const SUBSCRIPT_NUMBERS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(num: number): string {
    return num.toString().split('').map(d => SUBSCRIPT_NUMBERS[parseInt(d)]).join('');
}

function formatChartPrice(price: number): string {
    if (price === 0) return '0.0000';
    if (!price || !Number.isFinite(price)) return '';

    // Force decimal notation to avoid scientific notation parsing issues
    const priceStr = price.toFixed(20);

    if (priceStr.includes('.')) {
        const parts = priceStr.split('.');
        const decimalPart = parts[1];
        if (decimalPart) {
            // Count leading zeros
            const leadingZerosMatch = decimalPart.match(/^0+/);
            const leadingZeros = leadingZerosMatch ? leadingZerosMatch[0].length : 0;

            // If more than 4 zeros, use subscript notation: 0.0{zeros}1234
            if (leadingZeros > 4) {
                const rest = decimalPart.substring(leadingZeros).substring(0, 4);
                return `0.0${toSubscript(leadingZeros)}${rest}`;
            }
        }
    }

    const absPrice = Math.abs(price);

    // Minimum 4 decimal places for normal numbers
    if (absPrice >= 1) {
        return price.toFixed(4);
    }

    // For small numbers between 0.00001 and 1, use 8 decimals to capture precision
    return price.toFixed(8);
}

export default function PriceActionChart({
    chain,
    contractAddress,
    tokenSymbol
}: PriceActionChartProps) {
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<any>(null);
    const cacheRef = useRef<Map<string, { data: CandlestickData[]; ts: number }>>(new Map());
    const coinIdCache = useRef<Map<string, string>>(new Map());
    const dataRef = useRef<CandlestickData[] | null>(null);
    const hourlyDataRef = useRef<CandlestickData[] | null>(null);
    const activeDataTypeRef = useRef<'daily' | 'hourly'>('daily');
    const [data, setData] = useState<CandlestickData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [priceTicks, setPriceTicks] = useState<PriceTick[]>([]);
    const [chartHeight, setChartHeight] = useState<number>(360);
    const [hourlyData, setHourlyData] = useState<CandlestickData[] | null>(null);
    const [activeDataType, setActiveDataType] = useState<'daily' | 'hourly'>('daily');
    const hourlyDataCacheRef = useRef<Map<string, { data: CandlestickData[]; ts: number }>>(new Map());

    const moralisApiKey = process.env.MORALIS_API_KEY; // User confirmed key is in env

    const coingeckoUrl = `https://api.coingecko.com/api/v3/coins/${getPlatformId(chain)}/contract/${encodeURIComponent(
        contractAddress
    )}/market_chart?vs_currency=usd&days=${MAX_TIMEFRAME_DAYS}`;

    // Fetch data with fallback logic, retries, and abort handling
    useEffect(() => {
        // Helper to process, sort, and deduplicate data
        function processData(rawCandles: CandlestickData[]): CandlestickData[] {
            // detailed sort first
            rawCandles.sort((a, b) => a.time - b.time);

            // remove duplicates (prioritizing later data if duplicates exist, though usually identical)
            const uniqueCandles: CandlestickData[] = [];
            const times = new Set<number>();

            for (const c of rawCandles) {
                if (!times.has(c.time)) {
                    times.add(c.time);
                    uniqueCandles.push(c);
                }
            }
            return uniqueCandles;
        }

        // Helper to fetch CoinGecko Coin ID from contract address
        async function fetchCoinId(signal: AbortSignal): Promise<string | null> {
            const cacheKey = `${chain}:${contractAddress}`;
            if (coinIdCache.current.has(cacheKey)) {
                return coinIdCache.current.get(cacheKey)!;
            }

            const platformId = getPlatformId(chain);
            const url = `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${contractAddress}`;

            try {
                const resp = await fetch(url, { signal });
                if (!resp.ok) return null;
                const json = await resp.json();
                if (json.id) {
                    coinIdCache.current.set(cacheKey, json.id);
                    return json.id;
                }
            } catch (e) {
                console.warn('Failed to fetch coin ID:', e);
            }
            return null;
        }

        // Helper to fetch OHLC data directly
        async function fetchOHLC(coinId: string, days: number, signal: AbortSignal): Promise<CandlestickData[]> {
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
           // console.log('Fetching OHLC from CoinGecko:', url);

            const resp = await fetch(url, { signal });
            if (!resp.ok) {
                throw new Error(`CoinGecko OHLC failed: ${resp.status}`);
            }
            const data = await resp.json();

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No OHLC data returned');
            }

            // CoinGecko OHLC format: [time(ms), open, high, low, close]
            const candlesticks: CandlestickData[] = data.map((d: number[]) => ({
                time: Math.floor(d[0] / 1000),
                open: d[1],
                high: d[2],
                low: d[3],
                close: d[4]
            }));

            return processData(candlesticks);
        }

        // Fetch from internal RWA price-data route
        async function fetchFromRWA(signal: AbortSignal): Promise<CandlestickData[]> {
            const selector = MAX_TIMEFRAME_DAYS <= 1 ? 'D' : MAX_TIMEFRAME_DAYS <= 7 ? 'W' : 'Y';
            const url = `/api/rwa/price-data/${encodeURIComponent(contractAddress)}?selector=${encodeURIComponent(selector)}`;
          //  console.log('Fetching from RWA internal API:', url);

            const resp = await fetch(url, { signal });
            if (!resp.ok) {
                throw new Error(`RWA price API failed: ${resp.status}`);
            }

            const json = await resp.json();

            // Helper to coerce different time formats into seconds
            function toSeconds(value: any): number | null {
                if (value == null) return null;
                if (typeof value === 'number' && !Number.isNaN(value)) {
                    if (value > 1e12) return Math.floor(value / 1000); // ms to seconds
                    if (value > 1e9) return value; // already seconds
                    return value;
                }
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (/^\d+$/.test(trimmed)) {
                        const n = Number(trimmed);
                        if (trimmed.length >= 13) return Math.floor(n / 1000);
                        if (trimmed.length === 10) return n;
                        if (n > 1e12) return Math.floor(n / 1000);
                        if (n > 1e9) return n;
                        return n;
                    }
                    const parsed = Date.parse(trimmed);
                    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
                }
                return null;
            }



            // Convert price data to candlesticks (simulated from single price points)
            const candlesticks: CandlestickData[] = [];
            let foundData = false;

            if (Array.isArray(json.prices) && json.prices.length > 0 && Array.isArray(json.prices[0])) {
                json.prices.forEach((p: any) => {
                    const seconds = toSeconds(p[0]);
                    if (seconds == null) return;
                    const price = Number(p[1]);
                    if (Number.isNaN(price)) return;
                    // Simulate OHLC with same price (since we only have one price point)
                    candlesticks.push({ time: seconds, open: price, high: price, low: price, close: price });
                });
                foundData = true;
            } else if (Array.isArray(json.data) && json.data.length > 0) {
                json.data.forEach((d: any) => {
                    const seconds = toSeconds(d.time ?? d.timestamp);
                    if (seconds == null) return;
                    const price = Number(d.close ?? d.price ?? 0);
                    if (Number.isNaN(price)) return;
                    candlesticks.push({ time: seconds, open: price, high: price, low: price, close: price });
                });
                foundData = true;
            } else if (Array.isArray(json) && json.length > 0) {
                json.forEach((d: any) => {
                    const seconds = toSeconds(d.timestamp ?? d.time);
                    if (seconds == null) return;
                    const price = Number(d.price ?? d.close ?? 0);
                    if (Number.isNaN(price)) return;
                    candlesticks.push({ time: seconds, open: price, high: price, low: price, close: price });
                });
                foundData = true;
            }

            if (!foundData) {
                throw new Error('Unrecognized RWA price data format');
            }

            return processData(candlesticks);
        }

        async function fetchFromCoinGecko(signal: AbortSignal): Promise<CandlestickData[]> {
            // Enhanced strategy: Try to get real OHLC data first, fallback to market_chart (simulated candles)

            // 1. Try to get Coin ID and fetch OHLC
            try {
                const coinId = await fetchCoinId(signal);
                if (coinId) {
                    // Map timeframe days to CoinGecko valid OHLC days: 1, 7, 14, 30, 90, 180, 365, max
                    // We have 1, 7, 30, 90 -> direct match
                    try {
                        const ohlcData = await fetchOHLC(coinId, MAX_TIMEFRAME_DAYS, signal);
                        //console.log('Loaded real OHLC data from CoinGecko');
                        return ohlcData;
                    } catch (ohlcErr) {
                        console.warn('OHLC fetch failed, falling back to market_chart:', ohlcErr);
                    }
                }
            } catch (idErr) {
                console.warn('Coin ID fetch failed:', idErr);
            }

            // 2. Fallback to market_chart (legacy method) with precision=full
            const fallbackUrl = `${coingeckoUrl}&precision=full`;
           // console.log('Fetching from CoinGecko (fallback):', fallbackUrl);

            const maxAttempts = 3;
            let lastErr: any = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const resp = await fetch(fallbackUrl, { cache: 'no-store', signal });
                    if (!resp.ok) {
                        if ([429, 500, 502, 503, 504].includes(resp.status) && attempt < maxAttempts) {
                            const delay = 300 * attempt;
                            await new Promise((r) => setTimeout(r, delay));
                            continue;
                        }
                        throw new Error(`CoinGecko API failed: ${resp.status}`);
                    }
                    const json = (await resp.json()) as MarketChartResponse;
                    if (!json.prices || json.prices.length === 0) {
                        throw new Error('No price data from CoinGecko');
                    }

                    const candlesticks: CandlestickData[] = json.prices.map(([timestamp, price]) => ({
                        time: Math.floor(timestamp / 1000), // Convert ms to seconds
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                    }));

                    return processData(candlesticks);
                } catch (err: any) {
                    if (signal.aborted) throw err;
                    lastErr = err;
                    if (attempt === maxAttempts) throw err;
                }
            }
            throw lastErr || new Error('CoinGecko failed');
        }

        // Helper to fetch OHLC data from GeckoTerminal
        async function fetchFromGeckoTerminal(signal: AbortSignal): Promise<CandlestickData[]> {
            // 1. Determine network
            let network = '';
            if (chain === 'bsc') network = 'bsc';
            else if (chain === 'eth') network = 'ethereum';
            else if (chain === 'sol') network = 'solana';
            else {
                throw new Error('GeckoTerminal not supported for this chain');
            }

            // 2. Determine timeframe params
            // - 1D (24h): minute, aggregate 5 (5-minute, ~300 points)
            // - 7D: hour, aggregate 1 (1-hour, 168 points)
            // - 30D: hour, aggregate 4 (4-hour, 180 points)
            // - 90D: day, aggregate 1 (Daily, 90 points)
            let timeframe = 'day';
            let aggregate = 1;
            let limit = 100;

            if (MAX_TIMEFRAME_DAYS <= 1) {
                timeframe = 'minute';
                aggregate = 5;
                limit = 300; // ~25 hours
            } else if (MAX_TIMEFRAME_DAYS <= 7) {
                timeframe = 'hour';
                aggregate = 1;
                limit = 168; // 7 days
            } else if (MAX_TIMEFRAME_DAYS <= 30) {
                timeframe = 'hour';
                aggregate = 4;
                limit = 180; // 30 days
            } else {
                timeframe = 'day';
                aggregate = 1;
                limit = MAX_TIMEFRAME_DAYS;
            }

            const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=base`;
           // console.log('Fetching OHLC from GeckoTerminal:', url);

            const resp = await fetch(url, { signal });
            if (!resp.ok) {
                throw new Error(`GeckoTerminal API failed: ${resp.status}`);
            }

            const json = await resp.json();
            const ohlcvList = json?.data?.attributes?.ohlcv_list;

            if (!Array.isArray(ohlcvList) || ohlcvList.length === 0) {
                throw new Error('No OHLC data returned from GeckoTerminal');
            }

            // GeckoTerminal format: [timestamp, open, high, low, close, volume]
            const candlesticks: CandlestickData[] = ohlcvList.map((d: number[]) => ({
                time: d[0],
                open: d[1],
                high: d[2],
                low: d[3],
                close: d[4]
            }));

            return processData(candlesticks);
        }

        // Helper to fetch Pair Address from Moralis
        async function fetchMoralisPairAddress(signal: AbortSignal, chainId: string): Promise<string | null> {
            try {
                const url = `https://deep-index.moralis.io/api/v2.2/${contractAddress}/pairs?chain=${chainId}`;
                const resp = await fetch(url, {
                    headers: { 'X-API-Key': moralisApiKey || '' },
                    signal
                });

                if (!resp.ok) return null;
                const json = await resp.json();

                // Return the first pair address if available
                if (json && json.pairs && json.pairs.length > 0) {
                    return json.pairs[0].pairAddress;
                }
            } catch (e) {
                console.warn('Moralis Pair fetch failed:', e);
            }
            return null;
        }

        // Helper to fetch OHLC data from Moralis
        async function fetchFromMoralis(signal: AbortSignal): Promise<CandlestickData[]> {
            if (!moralisApiKey) throw new Error('No Moralis API Key');

            // 1. Map Chain
            let chainHex = '';
            if (chain === 'bsc') chainHex = 'bsc';
            else if (chain === 'eth') chainHex = 'ethereum';
            else throw new Error('Moralis not supported for this chain');

            // 2. Get Pair Address
            const pairAddress = await fetchMoralisPairAddress(signal, chainHex);
            if (!pairAddress) throw new Error('No trading pair found on Moralis');

            // 3. Determine timeframe and limit
            // 1D -> 5m (limit 300)
            // 7D -> 1h (limit 168)
            // 30D -> 4h (limit 180)
            // 90D -> 1d (limit 90)
            let timeframe = '1d';
            let limit = 100;

            if (MAX_TIMEFRAME_DAYS <= 1) {
                timeframe = '5m';
                limit = 300;
            } else if (MAX_TIMEFRAME_DAYS <= 7) {
                timeframe = '1h';
                limit = 168;
            } else if (MAX_TIMEFRAME_DAYS <= 30) {
                timeframe = '4h';
                limit = 180;
            } else {
                timeframe = '1d';
                limit = MAX_TIMEFRAME_DAYS;
            }

            const url = `https://deep-index.moralis.io/api/v2.2/pairs/${pairAddress}/ohlc?chain=${chainHex}&timeframe=${timeframe}&currency=usd&limit=${limit}`;
           // console.log('Fetching OHLC from Moralis:', url);

            const resp = await fetch(url, {
                headers: { 'X-API-Key': moralisApiKey },
                signal
            });

            if (!resp.ok) {
                throw new Error(`Moralis OHLC API failed: ${resp.status}`);
            }

            const json = await resp.json();
            const result = json.result;

            if (!Array.isArray(result) || result.length === 0) {
                throw new Error('No OHLC data returned from Moralis');
            }

            // Moralis format: { timestamp, open, high, low, close }
            const candlesticks: CandlestickData[] = result.map((d: any) => ({
                time: new Date(d.timestamp).getTime() / 1000,
                open: Number(d.open),
                high: Number(d.high),
                low: Number(d.low),
                close: Number(d.close)
            }));

            return processData(candlesticks);
        }

        const abortController = new AbortController();
        const { signal } = abortController;
        let cancelled = false;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);
                const key = `${chain}:${contractAddress}:${MAX_TIMEFRAME_DAYS}`;

                // Serve stale cache immediately if present
                const cached = cacheRef.current.get(key);
                if (cached && !cancelled) {
                    setData(cached.data);
                }

                // If this is an RWA token, use internal RWA price-data route first
                if (chain === 'rwa') {
                    try {
                        const rwaData = await fetchFromRWA(signal);
                      //  console.log('RWA data loaded:', rwaData.length, 'candlesticks');
                        setData(rwaData);
                        cacheRef.current.set(key, { data: rwaData, ts: Date.now() });
                        return;
                    } catch (rwaErr) {
                        console.warn('RWA data failed, falling back to other providers:', rwaErr);
                    }
                }

                        // Prefer Supabase Token Analysis function for BSC / ETH when available
                        async function fetchFromSupabase(signal: AbortSignal): Promise<CandlestickData[]> {
                            // Hardcoded Supabase Functions host (direct call)
                            const supabaseBase = 'https://enpdzndcjxlzupmxpmms.supabase.co';

                            let timeframeParam = '1y';
                            if (MAX_TIMEFRAME_DAYS <= 1) timeframeParam = '24h';
                            else if (MAX_TIMEFRAME_DAYS <= 7) timeframeParam = '7d';
                            else if (MAX_TIMEFRAME_DAYS <= 30) timeframeParam = '30d';
                            else if (MAX_TIMEFRAME_DAYS <= 90) timeframeParam = '3m';

                            const url = `${supabaseBase}/functions/v1/token-analysis-api?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(contractAddress)}&timeframe=${encodeURIComponent(timeframeParam)}`;
                           // console.log('Fetching from Supabase (direct) in NewPriceActionChart:', url);

                            const resp = await fetch(url, { signal, cache: 'no-store' });
                            if (!resp.ok) {
                                throw new Error(`Supabase API failed: ${resp.status}`);
                            }

                            const json = await resp.json();
                            const candles = json?.priceChart?.candles;
                            if (!Array.isArray(candles) || candles.length === 0) {
                                throw new Error('No price data from Supabase');
                            }

                            // Normalize and convert to CandlestickData[] (time in seconds)
                            const normalized = candles
                                .map((c: any) => {
                                    const rawTime = Number(c.time);
                                    // if ms -> convert to seconds
                                    let timeSec = rawTime;
                                    if (rawTime > 1e12) timeSec = Math.floor(rawTime / 1000);
                                    else if (rawTime > 1e9) timeSec = rawTime;
                                    else if (rawTime <= 1e9) timeSec = rawTime; // assume seconds

                                    const open = Number(c.open ?? c.o ?? c[1] ?? c.close ?? 0);
                                    const high = Number(c.high ?? c.h ?? c[2] ?? c.close ?? 0);
                                    const low = Number(c.low ?? c.l ?? c[3] ?? c.close ?? 0);
                                    const close = Number(c.close ?? c.c ?? c[4] ?? 0);
                                    return { time: Math.floor(timeSec), open, high, low, close } as CandlestickData;
                                })
                                .filter((d: any) => Number.isFinite(d.time) && Number.isFinite(d.close));

                            // sort and dedupe
                            normalized.sort((a: CandlestickData, b: CandlestickData) => a.time - b.time);
                            const dedup: CandlestickData[] = [];
                            for (const nd of normalized) {
                                const last = dedup[dedup.length - 1];
                                if (last && last.time === nd.time) {
                                    dedup[dedup.length - 1] = nd; // replace with latest
                                } else {
                                    dedup.push(nd);
                                }
                            }

                            return processData(dedup);
                        }

                // Try Supabase function first for BSC/ETH/SOL (canonical analysis)
                if (chain === 'bsc' || chain === 'eth' || chain === 'sol') {
                    try {
                        const sbData = await fetchFromSupabase(signal);
                        //console.log('Supabase data loaded:', sbData.length, 'candlesticks');
                        setData(sbData);
                        cacheRef.current.set(key, { data: sbData, ts: Date.now() });
                        return;
                    } catch (sbErr) {
                        console.warn('Supabase function failed, trying GeckoTerminal:', sbErr);
                    }
                }

                // Try GeckoTerminal first for BSC/ETH (High resolution OHLC)
                try {
                    const geckoTerminalData = await fetchFromGeckoTerminal(signal);
                    //console.log('GeckoTerminal data loaded:', geckoTerminalData.length, 'candlesticks');
                    setData(geckoTerminalData);
                    cacheRef.current.set(key, { data: geckoTerminalData, ts: Date.now() });
                    return;
                } catch (gtErr) {
                    console.warn('GeckoTerminal failed, falling back to Moralis:', gtErr);
                }

                // Try Moralis (High quality secondary source)
                try {
                    const moralisData = await fetchFromMoralis(signal);
                  //  console.log('Moralis data loaded:', moralisData.length, 'candlesticks');
                    setData(moralisData);
                    cacheRef.current.set(key, { data: moralisData, ts: Date.now() });
                    return;
                } catch (moralisErr) {
                    console.warn('Moralis failed, falling back to CoinGecko:', moralisErr);
                }

                // Try CoinGecko (Standard API, final fallback)
                const coinGeckoData = await fetchFromCoinGecko(signal);
                setData(coinGeckoData);
                cacheRef.current.set(key, { data: coinGeckoData, ts: Date.now() });
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
            abortController.abort('Chart fetch cancelled');
        };
    }, [coingeckoUrl, contractAddress, MAX_TIMEFRAME_DAYS, chain]);

    // Keep refs in sync with state
    useEffect(() => {
        dataRef.current = data;
        hourlyDataRef.current = hourlyData;
        activeDataTypeRef.current = activeDataType;
    }, [data, hourlyData, activeDataType]);

    // Fetch hourly data when needed
    useEffect(() => {
        if (!data || activeDataType !== 'daily') return;

        async function fetchHourlyData() {
            if (!chain || !contractAddress) return;

            const cacheKey = `${chain}:${contractAddress}:hourly`;
            const cached = hourlyDataCacheRef.current.get(cacheKey);

            // Return cached if available and fresh (within 5 mins)
            if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
                setHourlyData(cached.data);
                return;
            }

            try {
                let network = '';
                if (chain === 'bsc') network = 'bsc';
                else if (chain === 'eth') network = 'ethereum';
                else if (chain === 'sol') network = 'solana';
                else return;

                // Fetch hourly data from GeckoTerminal
                const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}/ohlcv/hour?aggregate=1&limit=24&currency=usd&token=base`;

                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`GeckoTerminal hourly fetch failed: ${resp.status}`);

                const json = await resp.json();
                const ohlcvList = json?.data?.attributes?.ohlcv_list;

                if (!Array.isArray(ohlcvList) || ohlcvList.length === 0) {
                    throw new Error('No hourly data available');
                }

                const hourlyCandles: CandlestickData[] = ohlcvList.map((d: number[]) => ({
                    time: d[0],
                    open: d[1],
                    high: d[2],
                    low: d[3],
                    close: d[4]
                }));

                hourlyDataCacheRef.current.set(cacheKey, { data: hourlyCandles, ts: Date.now() });
                setHourlyData(hourlyCandles);
            } catch (err) {
                console.warn('Failed to fetch hourly data:', err);
                setHourlyData(null);
            }
        }

        fetchHourlyData();
    }, [data, chain, contractAddress, activeDataType]);

    // Set responsive chart height based on viewport
    useEffect(() => {
        const updateChartHeight = () => {
            const isMobile = window.innerWidth < 768;
            const height = isMobile ? 300 : 500;
            setChartHeight(height);
        };

        updateChartHeight();
        window.addEventListener('resize', updateChartHeight);
        return () => window.removeEventListener('resize', updateChartHeight);
    }, []);

    // Create and update chart
    useEffect(() => {
        if (loading || !data || data.length === 0 || !chartContainerRef.current) return;

        if (!chartRef.current) {
            const chart = createChart(chartContainerRef.current, {
                layout: {
                    background: { type: ColorType.Solid, color: 'transparent' },
                    textColor: '#d1d5db',
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.08)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                rightPriceScale: {
                    visible: false,           // We use custom labels
                    borderVisible: false,
                },
                leftPriceScale: {
                    visible: false,
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: { visible: false },   // optional: hide vertical line
                    horzLine: {
                        visible: true,
                        labelVisible: false,          // we don't want default label
                    },
                },
                width: chartContainerRef.current.clientWidth,
                height: chartHeight,
                timeScale: {
                    timeVisible: true,
                    secondsVisible: true,
                    borderVisible: false,
                    tickMarkFormatter: (time: any, tickMarkType: any) => {
                        const date = new Date(time * 1000);
                        const hours = String(date.getUTCHours()).padStart(2, '0');
                        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');

                        // Show time if within 1 day view, otherwise show date
                        if (tickMarkType === 0) return `${hours}:${minutes}`;
                        return `${month}/${day}`;
                    },
                },
                localization: {
                    priceFormatter: formatChartPrice,
                },
                handleScroll: true,
                handleScale: true,
            });

            const areaSeries = chart.addSeries(AreaSeries, {
                lineColor: '#f97316',
                topColor: 'rgba(249, 115, 22, 0.4)',
                bottomColor: 'rgba(249, 115, 22, 0.05)',
                lineWidth: 2,
                priceFormat: {
                    type: 'custom',
                    formatter: formatChartPrice,
                    minMove: 0.00000001,
                },
            });

            candlestickSeriesRef.current = areaSeries as any;
            chartRef.current = chart;

            // Use daily data converted to area series (close price only)
            const areaData = data.map(d => ({
                time: d.time as Time,
                value: d.close
            }));
            areaSeries.setData(areaData);

            // Set default zoom to show ~30 days of daily candles
            if (data.length > 0) {
                const lastCandle = data[data.length - 1];
                const secondsIn30Days = 30 * 24 * 60 * 60;
                const fromTime = ((lastCandle.time as number) - secondsIn30Days) as Time;
                const toTime = lastCandle.time as Time;
                chart.timeScale().setVisibleRange({
                    from: fromTime,
                    to: toTime,
                });
            } else {
                chart.timeScale().fitContent();
            }

            // ─── Custom right-side price labels ───────────────────────
            const updatePriceTicks = () => {
                if (!candlestickSeriesRef.current || !chartRef.current) return;

                const priceScale = candlestickSeriesRef.current.priceScale();

                const range = priceScale.getVisibleRange();

                if (!range) return;

                const { from, to } = range;

                if (from === null || to === null || from >= to) return;

                const tickCount = 6;
                const step = (to - from) / (tickCount - 1);
                const ticks: PriceTick[] = [];

                for (let i = 0; i < tickCount; i++) {
                    const price = from + step * i;
                    const y = candlestickSeriesRef.current.priceToCoordinate(price);

                    if (y !== null && y >= 0 && y <= chartContainerRef.current!.clientHeight) {
                        ticks.push({ y, price });
                    }
                }

                setPriceTicks(ticks);
            };

            // Update on zoom / scroll / resize
            chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
                requestAnimationFrame(updatePriceTicks);
            });

            chart.subscribeCrosshairMove(() => {
                requestAnimationFrame(updatePriceTicks);
            });

            // Detect zoom level and swap to hourly data if zoomed to ≤24 hours
            const checkZoomLevel = () => {
                const range = chart.timeScale().getVisibleRange();
                if (!range) return;

                const timeRangeSeconds = (range.to as number) - (range.from as number);
                const oneDay = 24 * 60 * 60;

                // Switch to hourly data if zoomed to ≤24 hours and hourly data is available
                if (timeRangeSeconds <= oneDay) {
                    if (activeDataTypeRef.current === 'daily' && hourlyDataRef.current) {
                        setActiveDataType('hourly');
                        candlestickSeriesRef.current?.setData(
                            hourlyDataRef.current.map(d => ({ time: d.time as Time, value: d.close }))
                        );
                    }
                } else {
                    // Switch back to daily data if zoomed out beyond 24 hours
                    if (activeDataTypeRef.current === 'hourly' && dataRef.current) {
                        setActiveDataType('daily');
                        candlestickSeriesRef.current?.setData(
                            dataRef.current.map(d => ({ time: d.time as Time, value: d.close }))
                        );
                    }
                }
            };

            chart.timeScale().subscribeVisibleTimeRangeChange(() => {
                checkZoomLevel();
            });

            // Initial update
            setTimeout(updatePriceTicks, 150);

            const handleResize = () => {
                if (chartRef.current && chartContainerRef.current) {
                    chartRef.current.applyOptions({
                        width: chartContainerRef.current.clientWidth,
                    });
                    updatePriceTicks();
                }
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
                if (chartRef.current) {
                    chartRef.current.remove();
                    chartRef.current = null;
                    candlestickSeriesRef.current = null;
                }
            };
        } else if (candlestickSeriesRef.current) {
            // Update data only with daily line data
            candlestickSeriesRef.current.setData(
                data.map(d => ({
                    time: d.time as Time,
                    value: d.close
                }))
            );
            chartRef.current.timeScale().fitContent();
            setTimeout(() => {
                if (candlestickSeriesRef.current && chartRef.current) {
                    const priceScale = candlestickSeriesRef.current.priceScale();
                    const range = priceScale.getVisiblePriceRange();
                    if (range) {
                        const { from, to } = range;
                        const diff = to - from;
                        const tickCount = 6;
                        const step = diff / (tickCount - 1);
                        const ticks: PriceTick[] = [];
                        for (let i = 0; i < tickCount; i++) {
                            const price = from + step * i;
                            const y = candlestickSeriesRef.current.priceToCoordinate(price);
                            if (y !== null) ticks.push({ y, price });
                        }
                        setPriceTicks(ticks);
                    }
                }
            }, 150);
        }
    }, [data, loading, chartHeight]);

    return (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/40 p-4">
            {/* Chart container + custom price labels */}
            <div className="relative">
                {/* Always-visible price labels on the right */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none z-10 flex flex-col justify-between"
                    aria-hidden="true"
                >
                    {priceTicks.map((tick, i) => (
                        <div
                            key={i}
                            className="text-right text-xs font-mono font-semibold pr-2 py-0.5 px-2 rounded"
                            style={{
                                transform: `translateY(${tick.y}px) translateY(-50%)`,
                                position: 'absolute',
                                right: 0,
                                width: '100%',
                                color: '#f97316',
                                textShadow: '0 0 8px rgba(249, 115, 22, 0.4)',
                                backgroundColor: 'rgba(249, 115, 22, 0.05)',
                                backdropFilter: 'blur(4px)',
                                borderLeft: '2px solid rgba(249, 115, 22, 0.3)',
                            }}
                        >
                            {formatChartPrice(tick.price)}
                        </div>
                    ))}
                </div>

                {/* Main chart area */}
                <div
                    ref={chartContainerRef}
                    className="w-full"
                    style={{ height: `${chartHeight}px` }}
                />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-neutral-400">
                        Loading price data...
                    </div>
                )}

                {!loading && (!data || data.length === 0) && (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                        No price data available
                    </div>
                )}
            </div>

            {/* {error && (
                <div className="mt-3 text-red-400 text-sm text-center">{error}</div>
            )} */}
        </div>
    );
}
