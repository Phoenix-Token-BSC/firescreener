"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface AthAtlData {
  ath: number;
  ath_date: string;
  ath_change_percentage: number;
  atl: number;
  atl_date: string;
  atl_change_percentage: number;
}

interface AthAtlInfoProps {
  chain: string | null;
  contractAddress: string | null;
}

const CHAIN_PLATFORM: Record<string, string> = {
  bsc: "binance-smart-chain",
  eth: "ethereum",
  sol: "solana",
};

function formatPrice(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  const str = value.toPrecision(4);
  return `$${parseFloat(str).toString()}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const StatCell = ({
  icon,
  value,
  label,
  valueClass = "",
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
  valueClass?: string;
}) => (
  <div className="flex flex-col items-center bg-orange-600 rounded-md px-3 py-2 text-center">
    {icon && <span className="mb-0.5">{icon}</span>}
    <span className={`font-bold text-sm md:text-base leading-tight ${valueClass}`}>
      {value}
    </span>
    <span className="text-xs mt-0.5 opacity-80">{label}</span>
  </div>
);

export default function AthAtlInfo({ chain, contractAddress }: AthAtlInfoProps) {
  const [data, setData] = useState<AthAtlData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chain || !contractAddress) {
      setData(null);
      return;
    }

    const platformId = CHAIN_PLATFORM[chain.toLowerCase()];
    if (!platformId) return;

    setLoading(true);
    setData(null);

    fetch(
      `https://api.coingecko.com/api/v3/coins/${platformId}/contract/${contractAddress}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const md = json.market_data;
        if (!md) throw new Error("No market_data");
        setData({
          ath: md.ath?.usd ?? 0,
          ath_date: md.ath_date?.usd ?? "",
          ath_change_percentage: md.ath_change_percentage?.usd ?? 0,
          atl: md.atl?.usd ?? 0,
          atl_date: md.atl_date?.usd ?? "",
          atl_change_percentage: md.atl_change_percentage?.usd ?? 0,
        });
      })
      .catch((err) => {
        console.error("ATH/ATL fetch failed:", err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [chain, contractAddress]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 text-center">
        {[0, 1].map((i) => (
          <div key={i} className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className="flex flex-col items-center bg-orange-600 rounded-md px-3 py-2 animate-pulse min-h-[60px]"
              >
                <span className="bg-orange-500/50 rounded h-5 w-14" />
                <span className="bg-orange-500/50 rounded h-3 w-10 mt-2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* ATH row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCell
          icon={<TrendingUp size={14} className="text-green-300" />}
          value={formatPrice(data.ath)}
          label="ATH"
        />
        <StatCell value={formatDate(data.ath_date)} label="ATH Date" />
        <StatCell
          value={`${data.ath_change_percentage.toFixed(1)}%`}
          label="From ATH"
          valueClass={data.ath_change_percentage >= 0 ? "text-green-300" : "text-red-300"}
        />
      </div>
      {/* ATL row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCell
          icon={<TrendingDown size={14} className="text-red-300" />}
          value={formatPrice(data.atl)}
          label="ATL"
        />
        <StatCell value={formatDate(data.atl_date)} label="ATL Date" />
        <StatCell
          value={`+${data.atl_change_percentage.toFixed(1)}%`}
          label="From ATL"
          valueClass="text-green-300"
        />
      </div>
    </div>
  );
}
