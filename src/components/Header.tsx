'use client'

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    TOKEN_REGISTRY,
    getTokenByAddress,
    getTokensBySymbol,
    isValidContractAddress,
} from "@/lib/tokenRegistry";

// Format price with subscript zeros for very small numbers (matches page.tsx)
function formatPrice(price: number | string): { display: string; isExponential: boolean; zeros?: number; rest?: string } {
    if (price === 'N/A' || price === null || price === undefined || price === '') {
        return { display: 'N/A', isExponential: false };
    }
    let priceNum: number;
    if (typeof price === 'string') {
        priceNum = parseFloat(price.replace(/[^0-9.-]/g, ''));
    } else {
        priceNum = price;
    }
    if (isNaN(priceNum)) {
        return { display: 'N/A', isExponential: false };
    }
    const priceStr = priceNum.toFixed(20);
    if (priceStr.includes('.')) {
        const decimalPart = priceStr.split('.')[1];
        if (decimalPart) {
            const leadingZeros = decimalPart.match(/^0+/)?.[0].length || 0;
            if (leadingZeros > 4) {
                const restOfNumber = decimalPart.substring(leadingZeros).substring(0, 6);
                return { display: '$0.', isExponential: true, zeros: leadingZeros, rest: restOfNumber };
            }
        }
    }
    let formattedPrice: string;
    if (priceNum >= 1) {
        formattedPrice = priceNum.toFixed(2);
    } else if (priceNum >= 0.01) {
        formattedPrice = priceNum.toFixed(6);
    } else {
        formattedPrice = priceNum.toFixed(8);
    }
    return { display: '$' + formattedPrice, isExponential: false };
}

// Define interfaces for data structures
interface Token {
    symbol: string;
    fullName: string;
    chain: string;
    address: string;
    price: string;
    volume24h: number;
    change1h: string;
    change3h: string;
    change6h: string;
    change24h: string;
}

interface Suggestion {
    fullName: string;
    symbol: string;
    chain: string;
    address: string;
}

const MAX_SUGGESTIONS = 25;

export default function Header() {
    const router = useRouter();
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
    const [isDesktopSearchFocused, setIsDesktopSearchFocused] = useState(false);
    const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
    const dropdownInteractingRef = useRef(false);
    const [search, setSearch] = useState<string>("");
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [trendingTokens, setTrendingTokens] = useState<Token[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sortMetric, setSortMetric] = useState<"change24h" | "change6h" | "change3h" | "change1h" | "volume">("change24h");

    // Determine active chain from pathname
    const getActiveChain = (): string | null => {
        const path = pathname?.toLowerCase() || '';
        if (path.startsWith('/bsc')) return 'bsc';
        if (path.startsWith('/eth')) return 'eth';
        if (path.startsWith('/rwa')) return 'rwa';
        if (path.startsWith('/sol')) return 'sol';
        return null; // Home page or other routes
    };

    const activeChain = getActiveChain();

    // Get chain display info
    const getChainInfo = (chain: string | null) => {
        if (!chain) return { name: 'All Chains', logo: null };
        const chainInfo: { [key: string]: { name: string; logo: string } } = {
            bsc: { name: 'BSC', logo: '/bsc-logo.png' },
            eth: { name: 'Ethereum', logo: '/eth-logo.png' },
            rwa: { name: 'RWA Chain', logo: '/rwa-logo.png' },
            sol: { name: 'Solana', logo: '/sol-logo.png' },
        };
        return chainInfo[chain] || { name: 'All Chains', logo: null };
    };

    const currentChainInfo = getChainInfo(activeChain);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleSearch = (tokenFromSearchBar: string = search): void => {
        const raw = tokenFromSearchBar.trim();
        const q = raw.toLowerCase();
        if (!q) return;

        setError(null);

        // If the user pasted a contract address, route directly (chain can be inferred from registry)
        const looksLikeBscOrEth = isValidContractAddress(q, "bsc") || isValidContractAddress(q, "eth");
        const looksLikeRwa = isValidContractAddress(q, "rwa");
        const looksLikeSol = isValidContractAddress(q, "sol");
        if (looksLikeBscOrEth || looksLikeRwa || looksLikeSol) {
            const match = getTokenByAddress(q);
            if (match) {
                router.push(`/${match.chain}/${match.address}`);
                return;
            }
            // If not in registry, try current chain if available; default to bsc-like route
            if (activeChain) {
                router.push(`/${activeChain}/${q}`);
                return;
            }
            router.push(`/bsc/${q}`);
            return;
        }

        // Otherwise treat input as a symbol/name query using registry
        const active = (activeChain ?? undefined) as "bsc" | "sol" | "rwa" | "eth" | undefined;
        let candidates = getTokensBySymbol(q);

        // Fallback: match by name contains query (within active chain if set)
        if (candidates.length === 0) {
            const byName = TOKEN_REGISTRY.filter(t => t.name.toLowerCase().includes(q));
            candidates = byName;
        }

        if (candidates.length > 0) {
            // Prefer exact symbol match in active chain, then exact symbol, then active chain, then BSC, then first
            const exactInActive = active
                ? candidates.find(t => t.chain === active && t.symbol.toLowerCase() === q)
                : undefined;
            const exactSymbol = candidates.find(t => t.symbol.toLowerCase() === q);
            const inActive = active ? candidates.find(t => t.chain === active) : undefined;
            const chosen =
                exactInActive ||
                exactSymbol ||
                inActive ||
                candidates.find(t => t.chain === "bsc") ||
                candidates[0];
            router.push(`/${chosen.chain}/${chosen.address}`);
            return;
        }

        setError(`Token "${raw}" not found`);
    };

    const onSuggestionClick = (suggestion: Suggestion) => {
        if (!suggestion?.address || !suggestion?.chain) return;
        setSearch(suggestion.symbol.toUpperCase());
        router.push(`/${suggestion.chain}/${suggestion.address}`);
        setSuggestions([]);
        setIsSearchOpen(false);
        setIsDesktopSearchFocused(false);
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);
        console.log("Input changed, search set to:", value.toLowerCase());

        if (!value.trim()) {
            setSuggestions([]);
            return;
        }

        const q = value.trim().toLowerCase();
        const active = (activeChain ?? undefined) as "bsc" | "sol" | "rwa" | "eth" | undefined;

        const filtered = TOKEN_REGISTRY
            .filter(t =>
                t.symbol.toLowerCase().includes(q) ||
                t.name.toLowerCase().includes(q) ||
                t.address.toLowerCase() === q
            )
            .sort((a, b) => {
                // Prefer active chain, then BSC
                const score = (t: typeof a) =>
                    (active && t.chain === active ? 100 : 0) + (t.chain === "bsc" ? 10 : 0);
                return score(b) - score(a);
            })
            .slice(0, MAX_SUGGESTIONS)
            .map(t => ({
                fullName: t.name,
                symbol: t.symbol,
                chain: t.chain,
                address: t.address,
            }));

        setSuggestions(filtered);
    };

    useEffect(() => {
        async function fetchTrendingTokens() {
            if (!isSearchOpen && !isDesktopSearchFocused) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/price-change?sortBy=${sortMetric}&limit=10`
                );
                const data = await response.json();

                if (!response.ok || data.error) {
                    setError(data.error || "Failed to load trending tokens");
                    setTrendingTokens([]);
                    return;
                }

                const tokens: Token[] = (data.tokens || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (t: any) => ({
                        symbol: t.symbol?.toLowerCase() || "",
                        fullName: t.name || t.symbol || "",
                        chain: t.chain || "bsc",
                        address: t.address || "",
                        price: t.price || "0",
                        volume24h: parseFloat(t.volume24h) || 0,
                        change1h: t.change1h || "0",
                        change3h: t.change3h || "0",
                        change6h: t.change6h || "0",
                        change24h: t.change24h || "0",
                    })
                );

                setTrendingTokens(tokens);
                if (tokens.length === 0) {
                    setError("No data available for trending tokens");
                }
            } catch (err) {
                console.error("Error fetching trending tokens:", err);
                setError("Failed to load trending tokens");
            } finally {
                setIsLoading(false);
            }
        }

        fetchTrendingTokens();
    }, [isSearchOpen, isDesktopSearchFocused, sortMetric]);

    return (
        <header className="sticky top-0 z-50 px-4 md:px-16 py-2 bg-white text-neutral-900">
            <nav className="flex flex-row justify-between items-center">
                <Link href="/" className="font-bold flex flex-row items-center">
                    <Image
                        src="/logo-fixed.png"
                        alt="FireScreener Logo"
                        width={25}
                        height={25}
                        className="mr-2"
                    />
                    FIRESCREENER
                </Link>

                {/* Backdrop overlay when search is focused */}
                {isDesktopSearchFocused && (
                    <div
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={() => setIsDesktopSearchFocused(false)}
                    />
                )}

                {/* Desktop Search (Center) - Replaces the old Nav Links */}
                <div className="hidden md:flex flex-1 max-w-2xl mx-8 relative z-50">
                    <div className="relative w-full">
                        <div className="relative">
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search tokens (e.g., WKC or WikiCat)..."
                                value={search}
                                onChange={onChange}
                                onFocus={() => setIsDesktopSearchFocused(true)}
                                className="w-full pl-10 pr-4 py-2 bg-neutral-100 text-neutral-900 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                            />
                        </div>

                        {/* Desktop Search Suggestions/Trending Dropdown */}
                        {isDesktopSearchFocused && (
                            <div
                                className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-orange-500 rounded-lg shadow-xl p-4 max-h-[80vh] overflow-y-auto w-full"
                            >
                                {/* Suggestions */}
                                {suggestions.length > 0 && (
                                    <ul className="bg-neutral-800 border-2 border-orange-500 rounded-md max-h-40 overflow-y-auto mb-4">
                                        {suggestions.map((suggestion, index) => (
                                            <li
                                                key={index}
                                                onMouseDown={() => onSuggestionClick(suggestion)}
                                                className="px-4 py-2 hover:bg-neutral-700 cursor-pointer flex justify-between items-center"
                                            >
                                                <div>
                                                    <span className="font-medium text-white">{suggestion.fullName}</span>
                                                    <span className="text-gray-400 text-sm ml-2">{suggestion.symbol.toUpperCase()}</span>
                                                </div>
                                                <span className="text-gray-400 text-xs uppercase">
                                                    {suggestion.chain?.toUpperCase() || "UNKNOWN"}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-semibold text-white">
                                        🔥 Top Performing Tokens
                                    </h3>
                                    <select
                                        value={sortMetric}
                                        onChange={(e) => setSortMetric(e.target.value as typeof sortMetric)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="bg-neutral-800 text-white text-xs border border-orange-500 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    >
                                        <option value="change24h">24h Change</option>
                                        <option value="change6h">6h Change</option>
                                        <option value="change3h">3h Change</option>
                                        <option value="change1h">1h Change</option>
                                        <option value="volume">24h Volume</option>
                                    </select>
                                </div>

                                {isLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="animate-spin inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                                        <span className="ml-2 text-gray-400 text-sm">Loading top tokens...</span>
                                    </div>
                                ) : trendingTokens.length > 0 ? (
                                    <div className="rounded-md overflow-hidden border border-neutral-700 max-w-full">
                                        <div className="w-full overflow-x-auto">
                                            <table className="min-w-[640px] w-full text-left text-sm table-fixed">
                                            <thead className="bg-neutral-800">
                                                <tr>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium w-[44px]">#</th>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium w-[120px]">Token</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 text-xs font-medium">
                                                        {sortMetric === 'volume' ? '24h Vol' : (
                                                            sortMetric === 'change1h' ? '1h %' :
                                                            sortMetric === 'change3h' ? '3h %' :
                                                            sortMetric === 'change6h' ? '6h %' : '24h %'
                                                        )}
                                                    </th>
                                                    <th className="px-3 py-2 text-right text-gray-400 text-xs font-medium">Price</th>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium">Chain</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trendingTokens.map((token, index) => {
                                                    const changeVal = sortMetric === 'volume'
                                                        ? token.volume24h
                                                        : parseFloat(
                                                            sortMetric === 'change1h' ? token.change1h :
                                                            sortMetric === 'change3h' ? token.change3h :
                                                            sortMetric === 'change6h' ? token.change6h :
                                                            token.change24h
                                                          ) || 0;
                                                    const isPositive = changeVal > 0;
                                                    const isVolume = sortMetric === 'volume';
                                                    return (
                                                        <tr
                                                            key={token.address || index}
                                                            onMouseDown={() => {
                                                                if (token.chain && token.address) {
                                                                    router.push(`/${token.chain}/${token.address}`);
                                                                    setIsDesktopSearchFocused(false);
                                                                    setSuggestions([]);
                                                                }
                                                            }}
                                                            className="border-t border-neutral-700/50 hover:bg-neutral-800 cursor-pointer transition-colors duration-150"
                                                        >
                                                            <td className="px-3 py-2 text-gray-500 text-xs">{index + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <span className="text-white font-medium text-sm truncate block">
                                                                    {token.symbol.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className={`px-3 py-2 text-right text-sm font-medium ${
                                                                isVolume ? 'text-white' : isPositive ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                                {isVolume
                                                                    ? `$${changeVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                                    : `${isPositive ? '+' : ''}${changeVal.toFixed(2)}%`
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-white text-sm">
                                                                {(() => {
                                                                    const { display, isExponential, zeros, rest } = formatPrice(token.price);
                                                                    if (display === 'N/A') return <span className="text-neutral-400">N/A</span>;
                                                                    if (isExponential) return <>{display}0<sub>{zeros}</sub>{rest}</>;
                                                                    return display;
                                                                })()}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-gray-400 border border-neutral-700">
                                                                    {token.chain.toUpperCase()}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-400">
                                        No trending tokens available
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side buttons */}
                <div className="flex items-center gap-2">
                    {/* Chain Selector Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition duration-200 ${activeChain
                                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300'
                                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'
                                }`}
                            aria-label="Select Chain"
                        >
                            {activeChain && currentChainInfo.logo ? (
                                <Image
                                    src={currentChainInfo.logo}
                                    alt={activeChain}
                                    width={20}
                                    height={20}
                                    className="rounded-sm"
                                />
                            ) : (
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                    />
                                </svg>
                            )}
                            <span className="hidden sm:inline text-sm font-medium">
                                {activeChain ? currentChainInfo.name : 'Chains'}
                            </span>
                            <svg
                                className={`h-4 w-4 transition-transform duration-200 ${isChainDropdownOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isChainDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsChainDropdownOpen(false)}
                                />
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-20">
                                    <Link
                                        href="/bsc"
                                        className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 ${activeChain === 'bsc'
                                                ? 'bg-orange-100 text-orange-900 font-semibold'
                                                : 'hover:bg-neutral-100'
                                            }`}
                                        onClick={() => setIsChainDropdownOpen(false)}
                                    >
                                        <Image
                                            src="/bsc-logo.png"
                                            alt="BSC"
                                            width={24}
                                            height={24}
                                        />
                                        <span className="text-sm font-medium">BSC</span>
                                        {activeChain === 'bsc' && (
                                            <svg
                                                className="h-4 w-4 ml-auto text-orange-600"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </Link>
                                    <Link
                                        href="/eth"
                                        className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 ${activeChain === 'bsc'
                                                ? 'bg-orange-100 text-orange-900 font-semibold'
                                                : 'hover:bg-neutral-100'
                                            }`}
                                        onClick={() => setIsChainDropdownOpen(false)}
                                    >
                                        <Image
                                            src="/eth-logo.png"
                                            alt="ETH"
                                            width={24}
                                            height={24}
                                        />
                                        <span className="text-sm font-medium">ETH</span>
                                        {activeChain === 'eth' && (
                                            <svg
                                                className="h-4 w-4 ml-auto text-orange-600"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </Link>
                                    <Link
                                        href="/rwa"
                                        className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 ${activeChain === 'rwa'
                                                ? 'bg-orange-100 text-orange-900 font-semibold'
                                                : 'hover:bg-neutral-100'
                                            }`}
                                        onClick={() => setIsChainDropdownOpen(false)}
                                    >
                                        <Image
                                            src="/rwa-logo.png"
                                            alt="RWA"
                                            width={24}
                                            height={24}
                                        />
                                        <span className="text-sm font-medium">RWA Chain</span>
                                        {activeChain === 'rwa' && (
                                            <svg
                                                className="h-4 w-4 ml-auto text-orange-600"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </Link>

                                    <div className="border-t border-neutral-200 my-2"></div>
                                    <Link
                                        href="/"
                                        className={`flex items-center gap-3 px-4 py-2 transition-colors duration-200 ${!activeChain
                                                ? 'bg-orange-100 text-orange-900 font-semibold'
                                                : 'hover:bg-neutral-100'
                                            }`}
                                        onClick={() => setIsChainDropdownOpen(false)}
                                    >
                                        <svg
                                            className="h-5 w-5 text-neutral-600"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M4 6h16M4 12h16M4 18h16"
                                            />
                                        </svg>
                                        <span className="text-sm font-medium">All Chains</span>
                                        {!activeChain && (
                                            <svg
                                                className="h-4 w-4 ml-auto text-orange-600"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        )}
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Search Button (Mobile Only) */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="md:hidden flex items-center bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition duration-200"
                        aria-label="Search Tokens"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </button>

                    {/* Desktop Menu Dropdown */}
                    <div className="relative hidden md:block">
                        <button
                            onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                            className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 rounded-lg transition duration-200"
                        >
                            <span className="font-medium">Menu</span>
                            <svg className={`h-4 w-4 transition-transform ${isDesktopMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isDesktopMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDesktopMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-neutral-200 py-2 z-20">
                                    <Link href="/" className="block px-4 py-2 hover:bg-neutral-100 text-neutral-900" onClick={() => setIsDesktopMenuOpen(false)}>Home</Link>
                                    <Link href="#" className="block px-4 py-2 hover:bg-neutral-100 text-neutral-900" onClick={() => setIsDesktopMenuOpen(false)}>Burns</Link>
                                    <Link href="/price-predict" className="block px-4 py-2 hover:bg-neutral-100 text-neutral-900" onClick={() => setIsDesktopMenuOpen(false)}>Price Predict</Link>
                                    <Link href="/watchlist" className="block px-4 py-2 hover:bg-neutral-100 text-neutral-900" onClick={() => setIsDesktopMenuOpen(false)}>Watchlist</Link>
                                    <Link href="https://www.phoenixtoken.community" className="block px-4 py-2 hover:bg-neutral-100 text-neutral-900" onClick={() => setIsDesktopMenuOpen(false)}>Token</Link>
                                    <div className="border-t border-neutral-200 my-2"></div>
                                    {/* <Link href="/auth/login" className="block px-4 py-2 hover:bg-neutral-100 text-orange-600 font-medium" onClick={() => setIsDesktopMenuOpen(false)}>Login</Link>
                                    <Link href="/auth/signup" className="block px-4 py-2 hover:bg-neutral-100 text-orange-600 font-medium" onClick={() => setIsDesktopMenuOpen(false)}>Signup</Link> */}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden flex items-center p-2 border border-neutral-300 rounded text-neutral-900"
                        onClick={toggleMenu}
                        aria-label="Toggle menu"
                    >
                        <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} bg-white border-t border-neutral-200 mt-2`}>
                <div className="">
                    <Link
                        href="https://firescreener.com"
                        className="block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Home
                    </Link>
                    <Link
                        href="#"
                        className="block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Burns
                    </Link>
                    <Link
                        href="/price-predict"
                        className="block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Price Predict
                    </Link>
                    <Link
                        href="/watchlist"
                        className="block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Watchlist
                    </Link>
                    <Link
                        href="https://www.phoenixtoken.community"
                        className="block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Phoenix Token
                    </Link>
                    {/* <Link
                        href="/auth/login"
                        className="text-orange-600 font-bold block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Login
                    </Link>
                    <Link
                        href="/auth/signup"
                        className="text-orange-600 font-bold block px-3 py-2 rounded-md text-base text-neutral-900 hover:text-neutral-700 hover:bg-neutral-100"
                        onClick={toggleMenu}
                    >
                        Signup
                    </Link> */}
                </div>
            </div>

            {/* Search Popup */}
            {isSearchOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-neutral-900 rounded-md shadow-lg w-full max-w-lg p-6 relative border-2 border-orange-500">
                        {/* Close Button */}
                        <button
                            onClick={() => setIsSearchOpen(false)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-orange-500"
                        >
                            <svg
                                className="h-6 w-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search tokens (e.g., WKC or WikiCat)"
                                value={search}
                                onChange={onChange}
                                className="w-full pl-10 pr-4 py-2 bg-neutral-800 text-white border-2 border-orange-500 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
                                autoFocus
                            />
                        </div>

                        {/* Suggestions */}
                        {suggestions.length > 0 && (
                            <ul className="bg-neutral-800 border-2 border-orange-500 rounded-md max-h-40 overflow-y-auto mb-4">
                                {suggestions.map((suggestion, index) => (
                                    <li
                                        key={index}
                                        onClick={() => onSuggestionClick(suggestion)}
                                        className="px-4 py-2 hover:bg-neutral-700 cursor-pointer flex justify-between items-center"
                                    >
                                        <div>
                                            <span className="font-medium text-white">{suggestion.fullName}</span>
                                            <span className="text-gray-400 text-sm ml-2">{suggestion.symbol.toUpperCase()}</span>
                                        </div>
                                        <span className="text-gray-400 text-xs uppercase">
                                            {suggestion.chain?.toUpperCase() || "UNKNOWN"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {/* Trading Volume/Price Change Ranking */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-white">
                                    🔥 Top Performing Tokens
                                </h3>
                                <select
                                    value={sortMetric}
                                    onChange={(e) => setSortMetric(e.target.value as typeof sortMetric)}
                                    className="bg-neutral-800 text-white text-xs border border-orange-500 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="change24h">24h Change</option>
                                    <option value="change6h">6h Change</option>
                                    <option value="change3h">3h Change</option>
                                    <option value="change1h">1h Change</option>
                                    <option value="volume">24h Volume</option>
                                </select>
                            </div>
                            <div className="bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 max-w-full">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="animate-spin inline-block w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                                        <span className="ml-2 text-gray-400 text-sm">Loading top tokens...</span>
                                    </div>
                                ) : error ? (
                                    <div className="text-center py-4 text-red-500">{error}</div>
                                ) : trendingTokens.length > 0 ? (
                                    <div className="w-full overflow-x-auto">
                                        <table className="min-w-[640px] w-full text-left text-sm table-fixed">
                                            <thead className="bg-neutral-800">
                                                <tr>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium w-[44px]">#</th>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium w-[120px]">Token</th>
                                                    <th className="px-3 py-2 text-right text-gray-400 text-xs font-medium">
                                                        {sortMetric === 'volume' ? '24h Vol' : (
                                                            sortMetric === 'change1h' ? '1h %' :
                                                            sortMetric === 'change3h' ? '3h %' :
                                                            sortMetric === 'change6h' ? '6h %' : '24h %'
                                                        )}
                                                    </th>
                                                    <th className="px-3 py-2 text-right text-gray-400 text-xs font-medium">Price</th>
                                                    <th className="px-3 py-2 text-gray-400 text-xs font-medium">Chain</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trendingTokens.map((token, index) => {
                                                    const changeVal = sortMetric === 'volume'
                                                        ? token.volume24h
                                                        : parseFloat(
                                                            sortMetric === 'change1h' ? token.change1h :
                                                            sortMetric === 'change3h' ? token.change3h :
                                                            sortMetric === 'change6h' ? token.change6h :
                                                            token.change24h
                                                          ) || 0;
                                                    const isPositive = changeVal > 0;
                                                    const isVolume = sortMetric === 'volume';
                                                    return (
                                                        <tr
                                                            key={token.address || index}
                                                            onClick={() => {
                                                                if (token.chain && token.address) {
                                                                    router.push(`/${token.chain}/${token.address}`);
                                                                    setIsSearchOpen(false);
                                                                    setSuggestions([]);
                                                                }
                                                            }}
                                                            className="border-t border-neutral-700/50 hover:bg-neutral-700 cursor-pointer transition-colors duration-150"
                                                        >
                                                            <td className="px-3 py-2 text-gray-500 text-xs">{index + 1}</td>
                                                            <td className="px-3 py-2">
                                                                <span className="text-white font-medium text-sm truncate block">
                                                                    {token.symbol.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className={`px-3 py-2 text-right text-sm font-medium ${
                                                                isVolume ? 'text-white' : isPositive ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                                {isVolume
                                                                    ? `$${changeVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                                                    : `${isPositive ? '+' : ''}${changeVal.toFixed(2)}%`
                                                                }
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-white text-sm">
                                                                {(() => {
                                                                    const { display, isExponential, zeros, rest } = formatPrice(token.price);
                                                                    if (display === 'N/A') return <span className="text-neutral-400">N/A</span>;
                                                                    if (isExponential) return <>{display}0<sub>{zeros}</sub>{rest}</>;
                                                                    return display;
                                                                })()}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-gray-400 border border-neutral-700">
                                                                    {token.chain.toUpperCase()}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-400">
                                        No trending tokens available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}