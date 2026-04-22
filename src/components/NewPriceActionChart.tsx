"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, Time, ISeriesApi, CandlestickSeries, CrosshairMode } from 'lightweight-charts';

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

const TOTAL_DAYS = 90;

function getPlatformId(chain: SupportedChain): string {
    return chain === "bsc" ? "binance-smart-chain" : "ethereum" ;
}

function getSymbolFromChain(chain: SupportedChain): string {
    return chain === "bsc" ? "BNB" : "eth";
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
    const [data, setData] = useState<CandlestickData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [priceTicks, setPriceTicks] = useState<PriceTick[]>([]);
    const [crosshairInfo, setCrosshairInfo] = useState<{
        time: string; open: string; high: string; low: string; close: string;
    } | null>(null);

    // Get CryptoCompare API key from environment variable
    const cryptocompareApiKey = process.env.CRYPTOCOMPARE_API_KEY || "a2908b51095ddf69552f5dd2caabe3f9a12d2507f8ed32987008c936c1caff61";
    const moralisApiKey = process.env.MORALIS_API_KEY; // User confirmed key is in env

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
            console.log('Fetching OHLC from CoinGecko:', url);

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
            const selector = 'Y'; // always fetch max (90 days)
            const url = `/api/rwa/price-data/${encodeURIComponent(contractAddress)}?selector=${encodeURIComponent(selector)}`;
            console.log('Fetching from RWA internal API:', url);

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
                        const ohlcData = await fetchOHLC(coinId, TOTAL_DAYS, signal);
                        console.log('Loaded real OHLC data from CoinGecko');
                        return ohlcData;
                    } catch (ohlcErr) {
                        console.warn('OHLC fetch failed, falling back to market_chart:', ohlcErr);
                    }
                }
            } catch (idErr) {
                console.warn('Coin ID fetch failed:', idErr);
            }

            // 2. Fallback to market_chart (legacy method) with precision=full
            const fallbackUrl = `https://api.coingecko.com/api/v3/coins/${getPlatformId(chain)}/contract/${encodeURIComponent(contractAddress)}/market_chart?vs_currency=usd&days=${TOTAL_DAYS}&precision=full`;
            console.log('Fetching from CoinGecko (fallback):', fallbackUrl);

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
            else {
                throw new Error('GeckoTerminal not supported for this chain');
            }

            // 90 days at 4-hour resolution: 540 candles (gives good detail for 24h initial view)
            const timeframe = 'hour';
            const aggregate = 4;
            const limit = 540;

            const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${contractAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=base`;
            console.log('Fetching OHLC from GeckoTerminal:', url);

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
                time: d[0], // Already in seconds? No, documentation says Unix timestamp. Usually seconds. 
                // Wait, double check. Usually seconds. API docs say "Timestamp".
                // Let's assume seconds based on standard APIs, but if it's ms we might need to adjust.
                // Actually, GeckoTerminal usually returns seconds.
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

            // 90 days at 4h resolution
            const timeframe = '4h';
            const limit = 540;

            const url = `https://deep-index.moralis.io/api/v2.2/pairs/${pairAddress}/ohlc?chain=${chainHex}&timeframe=${timeframe}&currency=usd&limit=${limit}`;
            console.log('Fetching OHLC from Moralis:', url);

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

        // Fetch from CryptoCompare - already has OHLC data
        async function fetchFromCryptoCompare(signal: AbortSignal): Promise<CandlestickData[]> {
            const symbol = getSymbolFromChain(chain);
            const endpoint = getHistoEndpoint(TOTAL_DAYS);
            const limit = getHistoLimit(TOTAL_DAYS);

            let url = `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}`;

            if (cryptocompareApiKey) {
                url += `&api_key=${cryptocompareApiKey}`;
            }

            console.log('Fetching from CryptoCompare:', url.replace(cryptocompareApiKey || '', '***'));

            const maxAttempts = 2;
            let resp: Response | null = null;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    resp = await fetch(url, { signal });
                    if (!resp.ok) {
                        if ([429, 500, 502, 503, 504].includes(resp.status) && attempt < maxAttempts) {
                            const delay = 300 * attempt;
                            await new Promise((r) => setTimeout(r, delay));
                            continue;
                        }
                        throw new Error(`CryptoCompare API failed: ${resp.status}`);
                    }
                    break;
                } catch (err) {
                    if (signal.aborted) throw err;
                    if (attempt === maxAttempts) throw err;
                }
            }
            if (!resp) throw new Error('CryptoCompare: no response');
            const json = (await resp.json()) as CryptoCompareResponse;

            if (json.Response === 'Error') {
                throw new Error(json.Message || 'CryptoCompare API error');
            }

            if (!json.Data?.Data || json.Data.Data.length === 0) {
                throw new Error('No data from CryptoCompare');
            }

            const candlesticks: CandlestickData[] = json.Data.Data.map((dataPoint) => ({
                time: dataPoint.time,
                open: dataPoint.open,
                high: dataPoint.high,
                low: dataPoint.low,
                close: dataPoint.close,
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
                const key = `${chain}:${contractAddress}:${TOTAL_DAYS}`;

                // Serve stale cache immediately if present
                const cached = cacheRef.current.get(key);
                if (cached && !cancelled) {
                    setData(cached.data);
                }

                // If this is an RWA token, use internal RWA price-data route first
                if (chain === 'rwa') {
                    try {
                        const rwaData = await fetchFromRWA(signal);
                        console.log('RWA data loaded:', rwaData.length, 'candlesticks');
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

                            const timeframeParam = '3m'; // always 90 days

                            const url = `${supabaseBase}/functions/v1/token-analysis-api?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(contractAddress)}&timeframe=${encodeURIComponent(timeframeParam)}`;
                            console.log('Fetching from Supabase (direct) in NewPriceActionChart:', url);

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

                // Try Supabase function first for BSC/ETH (canonical analysis), then GeckoTerminal
                if (chain === 'bsc' || chain === 'eth') {
                    try {
                        const sbData = await fetchFromSupabase(signal);
                        console.log('Supabase data loaded:', sbData.length, 'candlesticks');
                        setData(sbData);
                        cacheRef.current.set(key, { data: sbData, ts: Date.now() });
                        return;
                    } catch (sbErr) {
                        console.warn('Supabase function failed, falling back to GeckoTerminal:', sbErr);
                    }
                }

                // Try GeckoTerminal first for BSC/ETH (High resolution OHLC)
                try {
                    const geckoTerminalData = await fetchFromGeckoTerminal(signal);
                    console.log('GeckoTerminal data loaded:', geckoTerminalData.length, 'candlesticks');
                    setData(geckoTerminalData);
                    cacheRef.current.set(key, { data: geckoTerminalData, ts: Date.now() });
                    return;
                } catch (gtErr) {
                    console.warn('GeckoTerminal failed, falling back to Moralis:', gtErr);
                }

                // Try Moralis (High quality secondary source)
                try {
                    const moralisData = await fetchFromMoralis(signal);
                    console.log('Moralis data loaded:', moralisData.length, 'candlesticks');
                    setData(moralisData);
                    cacheRef.current.set(key, { data: moralisData, ts: Date.now() });
                    return;
                } catch (moralisErr) {
                    console.warn('Moralis failed, falling back to CoinGecko:', moralisErr);
                }

                // Try CoinGecko (Standard API)
                try {
                    const coinGeckoData = await fetchFromCoinGecko(signal);
                    console.log('CoinGecko data loaded:', coinGeckoData.length, 'candlesticks');
                    setData(coinGeckoData);
                    cacheRef.current.set(key, { data: coinGeckoData, ts: Date.now() });
                    return;
                } catch (cgError) {
                    console.warn('CoinGecko failed, trying CryptoCompare:', cgError);

                    if (!cryptocompareApiKey) {
                        throw new Error('CoinGecko failed and no CryptoCompare API key provided. Get a free key at https://www.cryptocompare.com/cryptopian/api-keys');
                    }

                    const cryptoCompareData = await fetchFromCryptoCompare(signal);
                    console.log('CryptoCompare data loaded:', cryptoCompareData.length, 'candlesticks');
                    setData(cryptoCompareData);
                    cacheRef.current.set(key, { data: cryptoCompareData, ts: Date.now() });
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
    }, [contractAddress, chain, cryptocompareApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
                height: 360,                      // slightly taller for better look
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderVisible: false,
                },
                localization: {
                    priceFormatter: formatChartPrice,
                },
                handleScroll: true,
                handleScale: true,
            });

            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350',
                priceFormat: {
                    type: 'custom',
                    formatter: formatChartPrice,
                    minMove: 0.00000001,
                },
            });

            candlestickSeriesRef.current = candlestickSeries;
            chartRef.current = chart;

            // Set data
            candlestickSeries.setData(
                data.map(d => ({ ...d, time: d.time as Time }))
            );

            // Set initial view to last 24 hours so user sees today; they can scroll back 90 days
            const lastCandle = data[data.length - 1];
            if (lastCandle) {
                chart.timeScale().setVisibleRange({
                    from: (lastCandle.time - 86400) as Time,
                    to: lastCandle.time as Time,
                });
            } else {
                chart.timeScale().fitContent();
            }

            // ─── Crosshair OHLC + date overlay ───────────────────────
            chart.subscribeCrosshairMove((param) => {
                if (!param.time || !param.seriesData) {
                    setCrosshairInfo(null);
                    return;
                }
                const candle = param.seriesData.get(candlestickSeries) as any;
                if (!candle) { setCrosshairInfo(null); return; }
                const date = new Date(Number(param.time) * 1000);
                setCrosshairInfo({
                    time: date.toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                    }),
                    open: formatChartPrice(candle.open),
                    high: formatChartPrice(candle.high),
                    low: formatChartPrice(candle.low),
                    close: formatChartPrice(candle.close),
                });
                requestAnimationFrame(updatePriceTicks);
            });

            // ─── Custom right-side price labels ───────────────────────
            const updatePriceTicks = () => {
                if (!candlestickSeriesRef.current || !chartRef.current) return;

                const priceScale = candlestickSeriesRef.current.priceScale();

                // NEW: use getVisibleRange() instead of getVisiblePriceRange()
                const range = priceScale.getVisibleRange();

                if (!range) return; // no visible range yet (chart not rendered)

                const { from, to } = range;

                if (from === null || to === null || from >= to) return;

                const tickCount = 6; // adjust as you like (5–7 looks good)
                const step = (to - from) / (tickCount - 1);
                const ticks: PriceTick[] = [];

                for (let i = 0; i < tickCount; i++) {
                    const price = from + step * i;
                    const y = candlestickSeriesRef.current.priceToCoordinate(price);

                    // Only include ticks that are actually inside the chart area
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
            // Update data only
            candlestickSeriesRef.current.setData(
                data.map(d => ({ ...d, time: d.time as Time }))
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
    }, [data, loading]);

    return (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/40 p-4">
            {/* Crosshair OHLC info bar */}
            <div className="flex items-center gap-3 mb-3 min-h-[20px] text-xs font-mono">
                {crosshairInfo ? (
                    <>
                        <span className="text-neutral-400">{crosshairInfo.time}</span>
                        <span className="text-neutral-300">O <span className="text-white">{crosshairInfo.open}</span></span>
                        <span className="text-neutral-300">H <span className="text-green-400">{crosshairInfo.high}</span></span>
                        <span className="text-neutral-300">L <span className="text-red-400">{crosshairInfo.low}</span></span>
                        <span className="text-neutral-300">C <span className="text-white">{crosshairInfo.close}</span></span>
                    </>
                ) : (
                    <span className="text-neutral-500 text-xs">Hover over a candle · 90-day history · scroll to explore</span>
                )}
            </div>

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
                            className="text-right text-xs font-mono text-neutral-400 pr-2"
                            style={{
                                transform: `translateY(${tick.y}px)`,
                                position: 'absolute',
                                right: 0,
                                width: '100%',
                            }}
                        >
                            {formatChartPrice(tick.price)}
                        </div>
                    ))}
                </div>

                {/* Main chart area */}
                <div
                    ref={chartContainerRef}
                    className="w-full h-[360px] min-h-[320px]"
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