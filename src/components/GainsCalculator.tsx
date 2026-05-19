"use client";

import { useState } from "react";

interface GainsCalculatorProps {
  tokenSymbol: string;
  currentPrice: string | number;
  marketCap: string | number;
}

function formatPrice(price: number): string {
  if (price === 0) return "0";
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const s = price.toFixed(20);
  const dec = s.split(".")[1] ?? "";
  const leadingZeros = dec.match(/^0+/)?.[0].length ?? 0;
  return `0.${dec.substring(0, leadingZeros + 5)}`;
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export default function GainsCalculator({ tokenSymbol, currentPrice, marketCap }: GainsCalculatorProps) {
  const [multiplier, setMultiplier] = useState(2);
  const [amount, setAmount] = useState("");

  const price = parseFloat(String(currentPrice));
  const mcap = parseFloat(String(marketCap));
  const amountNum = parseFloat(amount);

  const priceValid = !isNaN(price) && price > 0;
  const mcapValid = !isNaN(mcap) && mcap > 0;
  const amountValid = !isNaN(amountNum) && amountNum > 0;

  const targetPrice = priceValid ? price * multiplier : null;
  const targetMcap = mcapValid ? mcap * multiplier : null;
  const targetAmount = amountValid ? amountNum * multiplier : null;

  return (
    <div className="mt-4 bg-orange-950 text-white p-4 rounded-xl border-2 border-orange-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-orange-500 font-bold text-lg">Gains Calculator</h2>
        <span className="text-2xl font-bold text-orange-400">{multiplier}x</span>
      </div>

      <div className="flex justify-between text-xs text-gray-400 mb-1 px-1">
        <span>1x</span>
        <span>100x</span>
      </div>
      <input
        type="range"
        min={1}
        max={100}
        step={1}
        value={multiplier}
        onChange={(e) => setMultiplier(Number(e.target.value))}
        className="w-full accent-orange-500 cursor-pointer"
      />

      {/* Amount input row */}
      <div className="flex items-center justify-between mt-4 gap-2">
        <div className="flex-1 bg-orange-900/40 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Your Amount</p>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              min={0}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent text-sm font-semibold w-full outline-none placeholder-gray-600"
            />
          </div>
        </div>
        <div className="text-gray-500 text-lg">→</div>
        <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Value at {multiplier}x</p>
          <p className="font-bold text-orange-400 text-sm truncate">
            {targetAmount !== null ? formatMarketCap(targetAmount) : <span className="text-gray-600">—</span>}
          </p>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Current Price</p>
          <p className="font-semibold text-sm truncate">
            {priceValid ? `$${formatPrice(price)}` : "N/A"}
          </p>
        </div>
        <div className="text-gray-500 text-lg">→</div>
        <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Price at {multiplier}x</p>
          <p className="font-bold text-orange-400 text-sm truncate">
            {targetPrice !== null ? `$${formatPrice(targetPrice)}` : "N/A"}
          </p>
        </div>
      </div>

      {/* Market cap row */}
      <div className="flex items-center justify-between mt-2 gap-2">
        <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Market Cap</p>
          <p className="font-semibold text-sm truncate">
            {mcapValid ? formatMarketCap(mcap) : "N/A"}
          </p>
        </div>
        <div className="text-gray-500 text-lg">→</div>
        <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">MCap at {multiplier}x</p>
          <p className="font-bold text-orange-400 text-sm truncate">
            {targetMcap !== null ? formatMarketCap(targetMcap) : "N/A"}
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-gray-500 mt-3">
        {tokenSymbol} × {multiplier} multiplier
      </p>
    </div>
  );
}
