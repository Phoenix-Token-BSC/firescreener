"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useWatchlist } from "@/hooks/useWatchlist";
import { AnimatePresence } from "framer-motion";
import { formatCompactNumber, formatPrice, Token } from "@/lib/tokenFormatting";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import WatchlistTokenCard from "@/components/WatchlistTokenCard";
import TokenLoadingSkeleton from "@/components/TokenLoadingSkeleton";

export default function WatchlistPage() {
    const { watchlist, removeFromWatchlist } = useWatchlist();
    const [tokens, setTokens] = useState<Token[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    
    // Restore scroll position when user navigates back
    useScrollRestoration('watchlistPageScroll');

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        async function fetchWatchlistData() {
            if (watchlist.length === 0) {
                setTokens([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Fetch latest data for watched tokens
                const promises = watchlist.map(async (item) => {
                    try {
                        const priceRes = await fetch(`/api/${item.chain}/token-price/${item.contract}`);
                        const priceData = await priceRes.json();

                        // Add a small delay/fallback or optimized endpoint if available in future
                        // For now we fetch individually as per current architecture structure seen in token page
                        return {
                            symbol: item.symbol,
                            name: item.name,
                            address: item.contract,
                            chain: item.chain,
                            price: priceData?.price || "N/A",
                            marketCap: priceData?.marketCap || "N/A",
                            volume: priceData?.volume || "N/A",
                            liquidity: priceData?.liquidity || "N/A",
                            change24h: priceData?.change24h || "N/A"
                        };
                    } catch (e) {
                        console.error(`Failed to fetch data for ${item.symbol}`, e);
                        return {
                            symbol: item.symbol,
                            name: item.name,
                            address: item.contract,
                            chain: item.chain,
                            price: "N/A",
                            marketCap: "N/A",
                            volume: "N/A",
                            liquidity: "N/A",
                            change24h: "N/A"
                        };
                    }
                });

                const fetchedTokens = await Promise.all(promises);
                setTokens(fetchedTokens);
            } catch (error) {
                console.error("Error fetching watchlist data:", error);
            } finally {
                setLoading(false);
            }
        }

        if (mounted) {
            fetchWatchlistData();
        }
    }, [watchlist, mounted]);

    if (!mounted) return null;

    return (
        <div className="container mx-auto min-h-screen flex flex-col">
            <Header />
            <div className="px-3 pt-8 flex-1">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-white">My Watchlist</h1>
                </div>

                {watchlist.length === 0 ? (
                    <div className="flex flex-row gap-2 items-center justify-center py-20 border border-neutral-800 rounded-lg bg-black/50">
                        <div className="text-2xl mb-4">⭐</div>
                        <h2 className="text-md font-bold mb-2 text-white">Your watchlist is empty</h2>
                    </div>
                ) : (
                    <>
                        {/* Mobile: Card Layout */}
                        <div className="md:hidden flex flex-col gap-2">
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <div className="text-center">
                                       <TokenLoadingSkeleton />
                                    </div>
                                </div>
                            ) : (
                                <AnimatePresence>
                                    {tokens.map((token) => (
                                        <WatchlistTokenCard
                                            key={`mobile-${token.chain}-${token.address}`}
                                            token={token}
                                            onRemove={removeFromWatchlist}
                                        />
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>

                        {/* Desktop: Table Layout */}
                        <div className="hidden md:block shadow rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px]">
                                    <thead>
                                        <tr className="bg-orange-500">
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left sticky left-0 bg-orange-500 z-20 min-w-[150px]">
                                                Token
                                            </th>
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                                                Price
                                            </th>
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                                                24H Change
                                            </th>
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                                                Market Cap
                                            </th>
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                                                Liquidity
                                            </th>
                                            <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                                                24H Volume
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <TokenLoadingSkeleton />
                                            </tr>
                                        ) : (
                                            tokens.map((token) => (
                                                <tr key={`${token.chain}-${token.address}`} className="border-b border-orange-500 hover:bg-orange-600 transition-colors">
                                                    {/* Token column - sticky on mobile */}
                                                    <td className="px-5 py-4 text-sm sticky left-0 z-10 min-w-[150px]">
                                                        <Link href={`/${token.chain}/${token.address}`} className="flex items-center hover:opacity-80">
                                                            {/* Token Icon with Chain Badge */}
                                                            <div className="relative flex-shrink-0 mr-3">
                                                                <img
                                                                    src={`/api/${token.chain}/logo/${token.address}`}
                                                                    alt={token.symbol}
                                                                    width={32}
                                                                    height={32}
                                                                    className="rounded-full w-8 h-8 object-contain bg-black"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = '/file.svg';
                                                                    }}
                                                                />
                                                                {/* Chain Logo Overlay */}
                                                                <img
                                                                    src={`/${token.chain}-logo.png`}
                                                                    alt={token.chain}
                                                                    width={16}
                                                                    height={16}
                                                                    className="absolute -bottom-1 -right-1 rounded-sm border-2 border-black"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-white whitespace-nowrap font-medium text-base">
                                                                    {token.symbol.toUpperCase()}
                                                                </span>
                                                                <span className="text-gray-400 text-xs whitespace-nowrap">
                                                                    {token.name}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    </td>

                                                    {/* Price column */}
                                                    <td className="px-5 py-4 text-sm min-w-[120px]">
                                                        <span className="text-white whitespace-nowrap">
                                                            {token.price === 'N/A' ? 'N/A' : (() => {
                                                                const { display, isExponential, zeros, rest } = formatPrice(token.price);
                                                                if (!isExponential) return display;
                                                                return (
                                                                    <>
                                                                        {display}0<sub>{zeros}</sub>{rest}
                                                                    </>
                                                                );
                                                            })()}
                                                        </span>
                                                    </td>

                                                    {/* 24h Change column */}
                                                    <td className="px-5 py-4 text-sm min-w-[120px]">
                                                        {token.change24h === 'N/A' || token.change24h === undefined ? (
                                                            <span className="text-white whitespace-nowrap">N/A</span>
                                                        ) : (
                                                            (() => {
                                                                const change = parseFloat(String(token.change24h));
                                                                const isPositive = change >= 0;
                                                                return (
                                                                    <span className={`whitespace-nowrap font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                                                                    </span>
                                                                );
                                                            })()
                                                        )}
                                                    </td>

                                                    {/* Market Cap column */}
                                                    <td className="px-5 py-4 text-sm min-w-[120px]">
                                                        <span className="text-white whitespace-nowrap">
                                                            ${formatCompactNumber(token.marketCap)}
                                                        </span>
                                                    </td>

                                                    {/* Liquidity column */}
                                                    <td className="px-5 py-4 text-sm min-w-[120px]">
                                                        <span className="text-white whitespace-nowrap">
                                                            {token.liquidity === 'N/A' ? 'N/A' : `$${formatCompactNumber(token.liquidity)}`}
                                                        </span>
                                                    </td>

                                                    {/* Volume column */}
                                                    <td className="px-5 py-4 text-sm min-w-[120px]">
                                                        <span className="text-white whitespace-nowrap">
                                                            {token.volume === 'N/A' ? 'N/A' : `$${formatCompactNumber(token.volume)}`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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
