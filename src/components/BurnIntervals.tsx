"use client";
import { useEffect, useState, useMemo } from "react";
import { getTokenByAddress } from "@/lib/tokenRegistry";

const INTERVALS = [
  { key: "burn5min", label: "5 Minutes" },
  { key: "burn15min", label: "15 Minutes" },
  { key: "burn30min", label: "30 Minutes" },
  { key: "burn1h", label: "1 Hour" },
  { key: "burn3h", label: "3 Hours" },
  { key: "burn6h", label: "6 Hours" },
  { key: "burn12h", label: "12 Hours" },
  { key: "burn24h", label: "24 Hours" },
] as const;

type IntervalKey = typeof INTERVALS[number]["key"];

interface BurnIntervalsProps {
  contractAddress: string;
  tokenSymbol?: string;
}

interface BurnData {
  burn5min: number;
  burn15min: number;
  burn30min: number;
  burn1h: number;
  burn3h: number;
  burn6h: number;
  burn12h: number;
  burn24h: number;
  lastUpdated: string;
}

interface TokenPriceData {
  price: string;
  lastUpdated: string;
}

function formatBurnValue(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "N/A";
  if (Math.abs(value) < 1) {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUSDValue(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "N/A";
  if (value < 0.01) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BurnIntervals({ contractAddress, tokenSymbol }: BurnIntervalsProps) {
  const [data, setData] = useState<BurnData | null>(null);
  const [tokenPrice, setTokenPrice] = useState<TokenPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<IntervalKey>("burn24h");

  const tokenRegistry = useMemo(() => {
    if (!contractAddress) return undefined;
    try {
      return getTokenByAddress(contractAddress);
    } catch (e) {
      console.error("Failed to lookup token:", e);
      return undefined;
    }
  }, [contractAddress]);

  const shouldShowBurns = tokenRegistry?.isBurn === true;

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // console.log("[BurnIntervals] Visibility check:", {
      //   contractAddress,
      //   hasTokenRegistry: !!tokenRegistry,
      //   isBurn: tokenRegistry?.isBurn,
      //   shouldShow: shouldShowBurns,
      // });
    }
  }, [contractAddress, tokenRegistry, shouldShowBurns]);

  useEffect(() => {
    if (!contractAddress || !shouldShowBurns) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch burn data and token price concurrently
        const [burnResponse, priceResponse] = await Promise.all([
          fetch(`/api/bsc/total-burnt/${encodeURIComponent(contractAddress)}`).then((res) => {
            if (!res.ok) throw new Error("Failed to fetch burn intervals");
            return res.json();
          }),
          fetch(`/api/bsc/token-price/${encodeURIComponent(contractAddress)}`).then((res) => {
            if (!res.ok) throw new Error("Failed to fetch token price");
            return res.json();
          }),
        ]);

        if (isMounted) {
          setData(burnResponse);
          setTokenPrice(priceResponse);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [contractAddress, shouldShowBurns]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedInterval(e.target.value as IntervalKey);
  };

  const value = data?.[selectedInterval];

  const usdValue = useMemo(() => {
    if (!tokenPrice?.price || tokenPrice.price === "N/A" || !value || isNaN(value)) {
      return "N/A";
    }

    const price = parseFloat(tokenPrice.price);
    if (isNaN(price)) return "N/A";

    const usdValue = value * price;
    return formatUSDValue(usdValue);
  }, [tokenPrice, value]);

  if (!shouldShowBurns) return null;

  return (
    <div className="bg-neutral-900 border-2 border-neutral-600 rounded-lg p-4">
      {loading ? (
        <div className="py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2 mx-auto"></div>
          <div className="text-center">Loading burn intervals...</div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500">Error: {error}</div>
      ) : !data ? (
        <div className="text-center text-gray-500">No burn data available</div>
      ) : (
        <>
          <h2 className="text-xl font-bold mb-2">
            {(typeof tokenSymbol === "string" ? tokenSymbol.toUpperCase() : contractAddress)} Burn Interval
          </h2>
          <div className="flex flex-col items-start mb-2">
            <select
              value={selectedInterval}
              onChange={handleChange}
              className="bg-neutral-800 mb-2 text-white border border-neutral-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {INTERVALS.map((interval) => (
                <option key={interval.key} value={interval.key}>
                  {interval.label}
                </option>
              ))}
            </select>
            <span className="text-2xl md:text-3xl font-bold text-red-500">
              {typeof value === "number" ? formatBurnValue(value) : "N/A"}
            </span>
            <p className="flex gap-2 items-center text-red-100 mb-2">
              <span className="text-sm">USD Value: </span>
              <span className="font-semibold text-lg md:text-xl text-red-500">{usdValue}</span>
            </p>
          </div>
          {/* <div className="text-xs text-gray-500 mt-2">
            Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "N/A"}
          </div> */}
        </>
      )}
    </div>
  );
}