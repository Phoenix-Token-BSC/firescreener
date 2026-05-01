"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TransactionsResponse } from "@/app/api/infura/transactions/[chain]/[contractAddress]/route";
import type { SwapTransaction } from "@/lib/infura";

interface TransactionsDataProps {
  chain: string | null;
  contractAddress: string | null;
}

const POLL_MS = 15_000;
const SUPPORTED = new Set(["bsc", "eth"]);

const EXPLORER: Record<string, string> = {
  eth: "https://etherscan.io",
  bsc: "https://bscscan.com",
};

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

function shortWallet(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsd(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return "$—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Renders a token price with the subscript zero-count format used on DexScreener.
 *
 * Examples:
 *   $0.05678    → $0.0₀5678  (subscript 0 — one zero before significant digits)
 *   $0.005678   → $0.0₁5678  (subscript 1)
 *   $0.0005678  → $0.0₂5678  (subscript 2)
 *   $0.000001234 → $0.0₅1234 (subscript 5)
 *
 * Prices ≥ $1 are shown as plain text unchanged.
 * The subscript equals (total leading zeros after decimal) − 1, because one zero
 * is already shown explicitly in the "0.0" prefix.
 */
function PriceDisplay({ raw }: { raw: string }) {
  const numStr = raw.startsWith("$") ? raw.slice(1) : raw;
  const num = parseFloat(numStr);

  // Prices ≥ $1 need no special formatting
  if (isNaN(num) || num === 0 || num >= 1) {
    return <span>{raw}</span>;
  }

  // Match one or more leading zeros after "0." followed by the first significant digit
  // e.g. "0.005678" → zeros="00", sig="5678"
  const match = numStr.match(/^0\.(0+)([1-9]\d*)/);

  // No leading zeros (price like $0.5678) — show plain
  if (!match) return <span>{raw}</span>;

  const zeroCount = match[1].length;          // total zeros after "0."
  const significant = match[2].slice(0, 4);   // up to 4 significant digits
  const subscript = zeroCount - 1;            // one zero already shown in "0.0"

  return (
    <span className="inline-flex items-baseline gap-px">
      <span>$0.0</span>
      <sub className="text-[9px] font-bold leading-none">{subscript}</sub>
      <span>{significant}</span>
    </span>
  );
}

// Skeleton row — matches 7-column grid
const Skeleton = () => (
  <div className="animate-pulse grid grid-cols-[44px_56px_96px_96px_80px_110px_110px] gap-x-2 px-3 py-2 border-b border-white/5 min-w-[660px]">
    <div className="h-4 w-8 bg-white/10 rounded" />
    <div className="h-5 w-10 bg-white/10 rounded" />
    <div className="h-4 w-14 bg-white/10 rounded ml-auto" />
    <div className="h-4 w-14 bg-white/10 rounded ml-auto" />
    <div className="h-4 w-10 bg-white/10 rounded ml-auto" />
    <div className="h-4 w-20 bg-white/10 rounded ml-auto" />
    <div className="h-4 w-20 bg-white/10 rounded ml-auto" />
  </div>
);

const MAX_CACHED = 30;

export default function TransactionsData({ chain, contractAddress }: TransactionsDataProps) {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newHashes, setNewHashes] = useState<Set<string>>(new Set());

  // Persistent refs — survive re-renders without triggering effects
  const lastToBlockRef = useRef<number | null>(null);
  const cachedTxnsRef = useRef<SwapTransaction[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTxns = useCallback(async () => {
    if (!chain || !contractAddress) return;
    try {
      const base = `/api/infura/transactions/${chain}/${contractAddress}`;
      const url = lastToBlockRef.current !== null
        ? `${base}?sinceBlock=${lastToBlockRef.current}`
        : base;

      const res = await fetch(url);
      if (res.status === 503 || res.status === 404 || res.status === 400) {
        setUnavailable(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Failed to load transactions (${res.status})`);
        setLoading(false);
        return;
      }

      const json: TransactionsResponse = await res.json();

      // Advance the cursor so next poll starts from where this one ended
      lastToBlockRef.current = json.toBlock;

      if (json.transactions.length === 0) {
        setData((prev) =>
          prev ? { ...prev, updatedAt: json.updatedAt } : { ...json, transactions: [] }
        );
        setLoading(false);
        return;
      }

      // Identify truly new entries for the flash-highlight
      const fresh = new Set<string>();
      for (const tx of json.transactions) {
        const k = `${tx.hash}-${tx.logIndex}`;
        if (!seenKeysRef.current.has(k)) fresh.add(k);
      }

      // Prepend new transactions then deduplicate, keeping only MAX_CACHED
      const merged = [...json.transactions, ...cachedTxnsRef.current];
      const deduped: SwapTransaction[] = [];
      const seen = new Set<string>();
      for (const tx of merged) {
        const k = `${tx.hash}-${tx.logIndex}`;
        if (!seen.has(k)) {
          seen.add(k);
          deduped.push(tx);
        }
        if (deduped.length === MAX_CACHED) break;
      }

      cachedTxnsRef.current = deduped;
      seenKeysRef.current = seen;

      if (fresh.size > 0) {
        setNewHashes(fresh);
        setTimeout(() => setNewHashes(new Set()), 2000);
      }

      setData({ ...json, transactions: deduped });
      setUnavailable(false);
    } catch {
      // Network error — keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [chain, contractAddress]);

  useEffect(() => {
    // Reset all state and cursors when the token changes
    lastToBlockRef.current = null;
    cachedTxnsRef.current = [];
    seenKeysRef.current = new Set();
    setData(null);
    setNewHashes(new Set());
    setUnavailable(false);
    setError(null);

    if (!chain || !contractAddress || !SUPPORTED.has(chain)) return;

    setLoading(true);
    fetchTxns();
    timerRef.current = setInterval(fetchTxns, POLL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [chain, contractAddress, fetchTxns]);

  if (!chain || !SUPPORTED.has(chain) || unavailable) return null;

  const explorerBase = EXPLORER[chain ?? ""] ?? "";

  return (
    <div className="mt-4 flex flex-col rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5">
        <div className="flex items-center gap-2">

          <span className="text-md font-bold text-white/70">
            Transactions
          </span>
        </div>

      </div>

      {/* Horizontally scrollable table */}
      <div className="overflow-x-auto overflow-y-auto max-h-80 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="min-w-[660px]">
          {/* Column headers */}
          <div className="grid grid-cols-[44px_56px_96px_96px_80px_110px_110px] gap-x-2 px-3 py-1 text-[10px] uppercase tracking-wide text-white/40 border-b border-white/5">
            <span>Age</span>
            <span>Type</span>
            <span className="text-right">Price</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
            <span className="text-right">Maker</span>
            <span className="text-right">Tx Hash</span>
          </div>

          {/* Rows */}
          {loading && !data ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
          ) : error ? (
            <p className="text-center text-sm text-red-400/70 py-8">{error}</p>
          ) : data?.transactions.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-8">
              No recent swaps found for this pair
            </p>
          ) : (
            data?.transactions.map((tx: SwapTransaction) => {
              const isBuy = tx.type === "buy";
              const isNew = newHashes.has(`${tx.hash}-${tx.logIndex}`);

              return (
                <div
                  key={`${tx.hash}-${tx.logIndex}`}
                  className={[
                    "grid grid-cols-[44px_56px_96px_96px_80px_110px_110px]",
                    "items-center gap-x-2 px-3 py-2 border-b border-white/5",
                    "transition-colors duration-700",
                    isNew
                      ? isBuy ? "bg-green-500/20" : "bg-red-500/20"
                      : isBuy ? "hover:bg-green-500/5" : "hover:bg-red-500/5",
                  ].join(" ")}
                >
                  {/* Age */}
                  <span className="text-[11px] text-white/50">
                    {timeAgo(tx.estimatedTimestamp)}
                  </span>

                  {/* Type badge */}
                  <span
                    className={[
                      "text-[11px] font-bold px-1.5 py-0.5 rounded text-center w-fit",
                      isBuy
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400",
                    ].join(" ")}
                  >
                    {isBuy ? "BUY" : "SELL"}
                  </span>

                  {/* Price */}
                  <span className="text-right text-white/70 text-[11px] justify-end flex">
                    <PriceDisplay raw={tx.pricePerToken} />
                  </span>

                  {/* Token amount */}
                  <span className="text-right text-white/80 text-[11px]">
                    {tx.tokenAmount}
                  </span>

                  {/* Total USD */}
                  <span
                    className={[
                      "text-right font-semibold text-[11px]",
                      isBuy ? "text-green-400" : "text-red-400",
                    ].join(" ")}
                  >
                    {formatUsd(tx.amountUsd)}
                  </span>

                  {/* Maker wallet */}
                  <a
                    href={`${explorerBase}/address/${tx.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-right text-[11px] text-orange-400 hover:text-orange-300 hover:underline font-mono truncate"
                    title={tx.wallet}
                  >
                    {shortWallet(tx.wallet)}
                  </a>

                  {/* Tx hash */}
                  <a
                    href={`${explorerBase}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-right text-[11px] text-white/40 hover:text-white/70 hover:underline font-mono truncate"
                    title={tx.hash}
                  >
                    {shortWallet(tx.hash)}
                  </a>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
