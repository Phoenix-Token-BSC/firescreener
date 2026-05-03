"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getTokenBySymbol, TOKEN_REGISTRY } from "@/lib/tokenRegistry";

// Define interfaces for data structures
interface Token {
  symbol: string;
  fullName: string;
  chain: string;
  volume24h: number;
}

interface Suggestion {
  fullName: string;
  symbol: string;
}

// Create mappings from the centralized registry
const TOKEN_LIST: { [key: string]: string } = TOKEN_REGISTRY.reduce((acc, token) => {
  acc[token.symbol] = token.chain;
  return acc;
}, {} as { [key: string]: string });

const FULL_NAME_MAP: { [key: string]: string } = TOKEN_REGISTRY.reduce((acc, token) => {
  acc[token.name] = token.symbol;
  return acc;
}, {} as { [key: string]: string });

// Define props interface
interface SearchBarPopupProps {
  setSearch: (value: string) => void;
  handleSearch: (value: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchBarPopup({
  setSearch,
  handleSearch,
  isOpen,
  onClose,
}: SearchBarPopupProps) {
  const [inputValue, setInputValue] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchTrendingTokens() {
      if (!isOpen) return;

      setIsLoading(true);
      setError(null);

      try {
        const tokenSymbols = Object.keys(TOKEN_LIST);
        const fetchPromises = tokenSymbols.map(async (symbol: string) => {
          try {
            const response = await fetch(`/api/bsc/volume/dex/${symbol}`);
            const data: { volume: string; error?: string } = await response.json();
            if (data.error || data.volume === "N/A") {
              return null;
            }
            const fullName =
              Object.keys(FULL_NAME_MAP).find(
                (name) => FULL_NAME_MAP[name] === symbol
              ) || symbol.toUpperCase();
            return {
              symbol,
              fullName,
              chain: TOKEN_LIST[symbol],
              volume24h: parseFloat(data.volume) || 0,
            };
          } catch (err) {
            console.error(`Failed to fetch data for ${symbol}:`, err);
            return null;
          }
        });

        const results = await Promise.all(fetchPromises);
        const validTokens = results
          .filter((token): token is Token => token !== null && token.volume24h > 0)
          .sort((a, b) => b.volume24h - a.volume24h)
          .slice(0, 5); // Top 5 tokens by volume

        setTrendingTokens(validTokens);
        if (validTokens.length === 0) {
          setError("No volume data available for trending tokens");
        }
      } catch (err) {
        console.error("Error fetching trending tokens:", err);
        setError("Failed to load trending tokens");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrendingTokens();
  }, [isOpen]);

  const onChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setInputValue(value);

    if (typeof setSearch === "function") {
      setSearch(value.toLowerCase());
      //console.log("Input changed, search set to:", value.toLowerCase());
    } else {
      console.error("setSearch is not a function");
    }

    if (value.trim()) {
      const filteredSuggestions = Object.entries(FULL_NAME_MAP)
        .filter(
          ([fullName, symbol]) =>
            fullName.toUpperCase().includes(value.toUpperCase()) ||
            symbol.toUpperCase().includes(value.toUpperCase())
        )
        .map(([fullName, symbol]) => ({ fullName, symbol }));
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const onSuggestionClick = (suggestion: Suggestion) => {
    const symbol = suggestion.symbol;
    if (symbol) {
      setInputValue(suggestion.fullName);
      if (typeof setSearch === "function") {
        setSearch(symbol);
       // console.log("Suggestion selected, search set to:", symbol);
      } else {
        console.error("setSearch is not a function");
      }
      if (typeof handleSearch === "function") {
        handleSearch(symbol);
      //  console.log("handleSearch triggered with:", symbol);
      } else {
        console.error("handleSearch is not a function");
        // Get token metadata to navigate with contract address
        const tokenMetadata = getTokenBySymbol(symbol);
        if (tokenMetadata) {
         // console.log("Fallback navigation to:", `/${tokenMetadata.chain}/${tokenMetadata.address}`);
          router.push(`/${tokenMetadata.chain}/${tokenMetadata.address}`);
        } else {
         // console.log("Token not found in registry:", symbol);
          router.push("/error");
        }
      }
      setSuggestions([]);
      onClose(); // Close popup after selection
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = inputValue.trim().toLowerCase();
    if (token) {
      if (typeof handleSearch === "function") {
        //console.log("Form submitted, calling handleSearch with:", token);
        handleSearch(token);
      } else {
        console.error("handleSearch is not a function");
        // Get token metadata to navigate with contract address
        const tokenMetadata = getTokenBySymbol(token);
        if (tokenMetadata) {
        //  console.log("Fallback navigation to:", `/${tokenMetadata.chain}/${tokenMetadata.address}`);
          router.push(`/${tokenMetadata.chain}/${tokenMetadata.address}`);
        } else {
        //  console.log("Token not found in registry:", token);
          router.push("/error");
        }
      }
    } else {
     // console.log("Empty search input");
      router.push("/error");
    }
    setSuggestions([]);
    onClose(); // Close popup after search
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  flex items-center justify-center z-50">
      <div className="bg-neutral-900 rounded-md shadow-lg w-full max-w-lg p-6 relative border-2 border-orange-500">
        {/* Close Button */}
        <button
          onClick={onClose}
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
        <form onSubmit={onSubmit}>
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
              value={inputValue}
              onChange={onChange}
              className="w-full pl-10 pr-4 py-2 bg-neutral-800 text-white border-2 border-orange-500 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 transition duration-200"
              autoFocus
            />
          </div>
        </form>

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
                  {TOKEN_LIST[suggestion.symbol] || "Unknown"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Trading Volume Ranking */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            Top Tokens by 24h Trading Volume
          </h3>
          <div className="bg-neutral-800 rounded-md overflow-hidden border-2 border-orange-500">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div
                  className="animate-spin inline-block w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full"
                  role="status"
                >
                  <span className="sr-only">Loading...</span>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-4 text-red-500">{error}</div>
            ) : trendingTokens.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-900">
                  <tr>
                    <th className="p-3 text-white">Symbol</th>
                    <th className="p-3 text-white">Chain</th>
                    <th className="p-3 text-right text-white">24h Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {trendingTokens.map((token, index) => (
                    <tr
                      key={index}
                      onClick={() =>
                        onSuggestionClick({ symbol: token.symbol, fullName: token.fullName })
                      }
                      className="border-t border-orange-500 hover:bg-neutral-700 cursor-pointer"
                    >
                      <td className="p-3 text-white">{token.symbol.toUpperCase()}</td>
                      <td className="p-3 text-gray-400">{token.chain.toUpperCase()}</td>
                      <td className="p-3 text-right text-white">
                        ${token.volume24h.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-4 text-gray-400">
                No trending tokens available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}