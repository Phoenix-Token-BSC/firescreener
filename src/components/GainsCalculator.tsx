"use client";

import { useState } from "react";

interface GainsCalculatorProps {
  tokenSymbol: string;
  currentPrice: string | number;
  marketCap: string | number;
}

type CalcMode = 'multiplier' | 'marketcap' | 'price';

interface PriceFormat {
  display: string;
  isExponential: boolean;
  zeros?: number;
  rest?: string;
}

function formatPrice(price: number): PriceFormat {
  if (price === 0) return { display: "0", isExponential: false };
  if (price >= 1) {
    return {
      display: price.toLocaleString(undefined, { maximumFractionDigits: 4 }),
      isExponential: false
    };
  }
  const s = price.toFixed(20);
  const dec = s.split(".")[1] ?? "";
  const leadingZeros = dec.match(/^0+/)?.[0].length ?? 0;
  if (leadingZeros > 4) {
    return {
      display: "$0.",
      isExponential: true,
      zeros: leadingZeros,
      rest: dec.substring(leadingZeros, leadingZeros + 5)
    };
  }
  return {
    display: `$0.${dec.substring(0, leadingZeros + 5)}`,
    isExponential: false
  };
}

function PriceDisplay({ price }: { price: number | null }) {
  if (price === null) return <span className="text-gray-600">—</span>;
  const formatted = formatPrice(price);

  if (formatted.display === "0") return <span>$0</span>;

  if (formatted.isExponential && formatted.zeros !== undefined && formatted.rest !== undefined) {
    return <span>{formatted.display}0<sub>{formatted.zeros}</sub>{formatted.rest}</span>;
  }

  if (formatted.display.startsWith("$")) return <span>{formatted.display}</span>;

  return <span>${formatted.display}</span>;
}

function formatMC(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function fmtMult(m: number): string {
  if (m % 1 === 0) return `${m}x`;
  if (m >= 10) return `${m.toFixed(1)}x`;
  return `${m.toFixed(2)}x`;
}

export default function GainsCalculator({ tokenSymbol, currentPrice, marketCap }: GainsCalculatorProps) {
  const [mode, setMode] = useState<CalcMode>('multiplier');
  const [multiplier, setMultiplier] = useState(2);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [targetMcapRaw, setTargetMcapRaw] = useState("");
  const [targetPriceInput, setTargetPriceInput] = useState("");

  const price = parseFloat(String(currentPrice));
  const mcap = parseFloat(String(marketCap));
  const amountNum = parseFloat(amount);
  const quantityNum = parseFloat(quantity);

  const priceValid = !isNaN(price) && price > 0;
  const mcapValid = !isNaN(mcap) && mcap > 0;
  const amountValid = !isNaN(amountNum) && amountNum > 0;
  const quantityValid = !isNaN(quantityNum) && quantityNum > 0;

  const parsedTargetMcap = parseFloat(targetMcapRaw);
  const parsedTargetPrice = parseFloat(targetPriceInput);
  const mcapInputValid = !isNaN(parsedTargetMcap) && parsedTargetMcap > 0;
  const priceInputValid = !isNaN(parsedTargetPrice) && parsedTargetPrice > 0;

  let effectiveMult: number | null = null;
  if (mode === 'multiplier') {
    effectiveMult = multiplier;
  } else if (mode === 'marketcap' && mcapValid && mcapInputValid) {
    const m = parsedTargetMcap / mcap;
    effectiveMult = isFinite(m) && m > 0 ? m : null;
  } else if (mode === 'price' && priceValid && priceInputValid) {
    const m = parsedTargetPrice / price;
    effectiveMult = isFinite(m) && m > 0 ? m : null;
  }

  const targetPriceVal = effectiveMult !== null && priceValid ? price * effectiveMult : null;
  const targetMcapVal = effectiveMult !== null && mcapValid ? mcap * effectiveMult : null;

  // Multiplier mode: USD amount in → USD value out
  const targetAmountVal = effectiveMult !== null && amountValid ? amountNum * effectiveMult : null;
  const amountProfit = targetAmountVal !== null ? targetAmountVal - amountNum : null;

  // MCap/Price modes: token quantity → current holding vs target holding
  const currentHoldingVal = quantityValid && priceValid ? quantityNum * price : null;
  const targetHoldingVal = quantityValid && targetPriceVal !== null ? quantityNum * targetPriceVal : null;
  const holdingProfit = targetHoldingVal !== null && currentHoldingVal !== null
    ? targetHoldingVal - currentHoldingVal
    : null;

  // Shared MCap input UI for both By MCap and By Price modes
  const mcapInputPanel = (
    <div className="mb-4">
      <p className="text-xs text-gray-400 mb-1.5">Target Market Cap</p>
      <div className="flex items-center gap-1 bg-orange-900/40 rounded-lg px-3 py-2">
        <span className="text-gray-400 text-sm">$</span>
        <input
          type="number"
          min={0}
          placeholder="0"
          value={targetMcapRaw}
          onChange={(e) => setTargetMcapRaw(e.target.value)}
          className="bg-transparent text-sm font-semibold w-full outline-none placeholder-gray-600"
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-gray-500">
        {mcapValid && <span>Current: {formatMC(mcap)}</span>}
        {mcapInputValid && <span>Target: {formatMC(parsedTargetMcap)}</span>}
      </div>
    </div>
  );

  return (
    <div className="mt-4 bg-orange-950 text-white p-4 rounded-xl border-2 border-orange-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-orange-500 font-bold text-lg">Gains Calculator</h2>
        <span className={`text-2xl font-bold ${effectiveMult !== null ? 'text-orange-400' : 'text-gray-600'}`}>
          {effectiveMult !== null ? fmtMult(effectiveMult) : '—'}
        </span>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-4 bg-orange-900/30 rounded-lg p-1">
        {(['multiplier', 'marketcap', 'price'] as CalcMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mode === m ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {m === 'multiplier' ? 'Multiplier' : m === 'marketcap' ? 'By MCap' : 'By Price'}
          </button>
        ))}
      </div>

      {/* Multiplier: slider */}
      {mode === 'multiplier' && (
        <>
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
            className="w-full accent-orange-500 cursor-pointer mb-4"
          />
        </>
      )}

      {/* By MCap: market cap input */}
      {mode === 'marketcap' && mcapInputPanel}

      {/* By Price: price input */}
      {mode === 'price' && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-1.5">Target Price</p>
          <div className="flex items-center gap-1 bg-orange-900/40 rounded-lg px-3 py-2">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={targetPriceInput}
              onChange={(e) => setTargetPriceInput(e.target.value)}
              className="bg-transparent text-sm font-semibold w-full outline-none placeholder-gray-600"
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-500">
            {priceValid && <span>Current: <PriceDisplay price={price} /></span>}
            {effectiveMult !== null && <span>≈ {fmtMult(effectiveMult)} from current</span>}
          </div>
        </div>
      )}

      {/* Multiplier mode: USD amount → value */}
      {mode === 'multiplier' && (
        <div className="flex items-center justify-between gap-2">
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
            <p className="text-xs text-gray-400 mb-1">
              {effectiveMult !== null ? `Value at ${fmtMult(effectiveMult)}` : 'Value'}
            </p>
            <p className="font-bold text-orange-400 text-sm truncate">
              {targetAmountVal !== null ? formatMC(targetAmountVal) : <span className="text-gray-600">—</span>}
            </p>
            {amountProfit !== null && (
              <p className={`text-xs mt-0.5 ${amountProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {amountProfit >= 0 ? '+' : '-'}{formatMC(Math.abs(amountProfit))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* MCap/Price modes: token quantity → current vs target holding */}
      {mode !== 'multiplier' && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 bg-orange-900/40 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Your Tokens</p>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-transparent text-sm font-semibold w-full outline-none placeholder-gray-600"
            />
            {currentHoldingVal !== null && (
              <p className="text-xs text-gray-500 mt-0.5">Now: {formatMC(currentHoldingVal)}</p>
            )}
          </div>
          <div className="text-gray-500 text-lg">→</div>
          <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Target Value</p>
            <p className="font-bold text-orange-400 text-sm truncate">
              {targetHoldingVal !== null ? formatMC(targetHoldingVal) : <span className="text-gray-600">—</span>}
            </p>
            {holdingProfit !== null && (
              <p className={`text-xs mt-0.5 ${holdingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {holdingProfit >= 0 ? '+' : '-'}{formatMC(Math.abs(holdingProfit))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* By MCap mode: show derived price */}
      {mode === 'marketcap' && (
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Current Price</p>
            <p className="font-semibold text-sm truncate">
              {priceValid ? <PriceDisplay price={price} /> : "N/A"}
            </p>
          </div>
          <div className="text-gray-500 text-lg">→</div>
          <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">
              Implied Price
            </p>
            <p className="font-bold text-orange-400 text-sm truncate">
              {targetPriceVal !== null ? <PriceDisplay price={targetPriceVal} /> : <span className="text-gray-500">—</span>}
            </p>
          </div>
        </div>
      )}

      {/* By Price mode: target price → implied mcap */}
      {mode === 'price' && (
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Market Cap</p>
            <p className="font-semibold text-sm truncate">
              {mcapValid ? formatMC(mcap) : "N/A"}
            </p>
          </div>
          <div className="text-gray-500 text-lg">→</div>
          <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Implied MCap</p>
            <p className="font-bold text-orange-400 text-sm truncate">
              {targetMcapVal !== null ? formatMC(targetMcapVal) : <span className="text-gray-500">—</span>}
            </p>
          </div>
        </div>
      )}

      {/* Multiplier mode: price and mcap rows */}
      {mode === 'multiplier' && (
        <>
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Current Price</p>
              <p className="font-semibold text-sm truncate">
                {priceValid ? <PriceDisplay price={price} /> : "N/A"}
              </p>
            </div>
            <div className="text-gray-500 text-lg">→</div>
            <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Price at {effectiveMult !== null ? fmtMult(effectiveMult) : '—'}</p>
              <p className="font-bold text-orange-400 text-sm truncate">
                {targetPriceVal !== null ? <PriceDisplay price={targetPriceVal} /> : <span className="text-gray-500">—</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex-1 bg-orange-900/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Market Cap</p>
              <p className="font-semibold text-sm truncate">
                {mcapValid ? formatMC(mcap) : "N/A"}
              </p>
            </div>
            <div className="text-gray-500 text-lg">→</div>
            <div className="flex-1 bg-orange-500/10 border border-orange-500/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">MCap at {effectiveMult !== null ? fmtMult(effectiveMult) : '—'}</p>
              <p className="font-bold text-orange-400 text-sm truncate">
                {targetMcapVal !== null ? formatMC(targetMcapVal) : <span className="text-gray-500">—</span>}
              </p>
            </div>
          </div>
        </>
      )}

      <p className="text-center text-xs text-gray-500 mt-3">
        {tokenSymbol} {effectiveMult !== null ? `× ${fmtMult(effectiveMult)}` : '— set a target above'}
      </p>
    </div>
  );
}
