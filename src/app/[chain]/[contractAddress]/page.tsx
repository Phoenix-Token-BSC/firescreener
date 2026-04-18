"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import DataCard from "@/components/DataCard";
import BurnsDisplay from "@/components/BurnHistory";
import BurnIntervals from "@/components/BurnIntervals";
import { FaCopy, FaGlobe, FaTelegramPlane } from "react-icons/fa";
import { SiX } from "react-icons/si";
import styles from "../styles.module.css";
import Footer from "@/components/Footer";
import Image from "next/image";
import CurrencyConverter from "@/components/Converter";
import PriceActionChart from "@/components/PriceActionChart";
import {
  getTokenByAddress,
  isValidContractAddress,
  TokenMetadata,
} from "@/lib/tokenRegistry";
import { useTrackActiveToken } from "@/hooks/useTrackActiveToken";
import { useEmojiReactions } from "@/hooks/useEmojiReactions";
import { Star } from "lucide-react";
import WatchlistButton from "@/components/WatchlistButton";
import NewPriceActionChart from "@/components/NewPriceActionChart";
import SecurityAnalysis from "@/components/GoPlusAnalysis";
import HoneypotAnalysis from "@/components/HoneypotAnalysis";
import LiquidityLocker from "@/components/LiquidityLocker";
import TokenInfo from "@/components/TokenInfo";
import VolumeTxnsInfo from "@/components/VolumeTxnsInfo";
import LoadingWithLogo from "@/components/LoadingWithLogo";

// Define types for token data and intervals
interface TokenData {
  price: string | number;
  totalSupply: string | number;
  cSupply: string | number;
  lSupply: string | number;
  holders: string | number;
  marketCap: string | number;
  fdv: string | number;
  volume: string | number;
  burn5min: string | number;
  burn15min: string | number;
  burn30min: string | number;
  burn1h: string | number;
  burn3h: string | number;
  burn6h: string | number;
  burn12h: string | number;
  burn24h: string | number;
  totalburnt: string | number;
  priceChange24h: string | number;
  priceChange6h: string | number;
  priceChange3h: string | number;
  priceChange1h: string | number;
  liquidity: string | number;
  profile: string;
  contract: string;
  description: string;
  holdersCount: string | number;
  txns: string | number;
}

// Define props interface
interface TokenPageProps {
  params: Promise<{ chain: string; contractAddress: string }>;
}

export default function TokenPage({ params: paramsPromise }: TokenPageProps) {
  const router = useRouter();
  const [chain, setChain] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(
    null,
  );

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [socialLinks, setSocialLinks] = useState<{
    website: string;
    twitter: string;
    telegram: string;
    scan: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("info");

  // Emoji reactions synced with Supabase
  const {
    counts: emojiCounts,
    handleEmojiClick: submitEmojiReaction,
    // resetCounts: resetEmojiCounts,
    hasReactedToday: hasReactedToday,
  } = useEmojiReactions(contractAddress);

  // Track this token as actively viewed for priority cache refresh
  useTrackActiveToken(contractAddress || undefined, chain || undefined);

  const cryptocompareApiKey = process.env.CRYPTO_COMPARE_API_KEY;
  console.log(cryptocompareApiKey);

  useEffect(() => {
    if (paramsPromise) {
      Promise.resolve(paramsPromise).then((resolvedParams) => {
        const { chain: paramChain, contractAddress: paramContractAddress } =
          resolvedParams || {};
        setChain(paramChain);
        setContractAddress(paramContractAddress);
      });
    }
  }, [paramsPromise]);

  useEffect(() => {
    async function fetchTokenData() {
      if (!chain || !contractAddress) {
        setError("Invalid chain or contract address");
        setLoading(false);
        return;
      }

      const chainLower = chain.toLowerCase() as "bsc" | "sol" | "rwa" | "eth";

      // Validate contract address format
      if (!isValidContractAddress(contractAddress, chainLower)) {
        router.push(
          `/error?type=invalid_address&identifier=${encodeURIComponent(contractAddress)}&chain=${chainLower}`,
        );
        return;
      }

      // Get token metadata from registry
      const metadata = getTokenByAddress(contractAddress);
      if (!metadata) {
        router.push(
          `/error?type=token_not_found&identifier=${encodeURIComponent(contractAddress)}&chain=${chainLower}`,
        );
        return;
      }

      // Verify chain matches
      if (metadata.chain !== chainLower) {
        router.push(
          `/error?type=chain_mismatch&identifier=${encodeURIComponent(contractAddress)}&chain=${chainLower}`,
        );
        return;
      }

      // Ensure isBurn is a boolean
      const enhancedMetadata = {
        ...metadata,
        isBurn: metadata.isBurn === true,
      };

      setTokenMetadata(enhancedMetadata);

      try {
        // Use the token symbol for API calls (for backward compatibility with existing APIs)
        // const tokenSymbol = metadata.symbol;
        const apiEndpoints = [
          `/api/${chainLower}/token-metrics/${contractAddress}`,
          `/api/${chainLower}/token-holders/${contractAddress}`,
          `/api/${chainLower}/token-price/${contractAddress}`, // Now using contract address
          `/api/${chainLower}/burns-interval/${contractAddress}`,
          `/api/${chainLower}/token-profile/${contractAddress}`,
          `/api/${chainLower}/socials/${contractAddress}`,
          `/api/${chainLower}/ca/${contractAddress}`,
          `/api/${chainLower}/description/${contractAddress}`,
          `/api/${chainLower}/holders/${contractAddress}`,
        ];

        const responses = await Promise.all(
          apiEndpoints.map((endpoint) =>
            fetch(endpoint)
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null),
          ),
        );

        const [
          metricsData,
          holdersData,
          priceData,
          burnsData,
          profileData,
          socialData,
          ,
          descriptionData,
          holdersCount,
        ] = responses;

        setTokenData({
          price: priceData?.price || "N/A",
          totalSupply: metricsData?.totalSupply || "N/A",
          cSupply: metricsData?.circulatingSupply || "N/A",
          lSupply: metricsData?.lockedSupply || "N/A",
          holders: holdersData?.totalHolders || "N/A",
          marketCap: priceData?.marketCap || "N/A",
          fdv: priceData?.fdv || "N/A",
          volume: priceData?.volume || "N/A",
          burn5min: burnsData?.burn5min || "No burns",
          burn15min: burnsData?.burn15min || "No burns",
          burn30min: burnsData?.burn30min || "No burns",
          burn1h: burnsData?.burn1h || "No burns",
          burn3h: burnsData?.burn3h || "No burns",
          burn6h: burnsData?.burn6h || "No burns",
          burn12h: burnsData?.burn12h || "No burns",
          burn24h: burnsData?.burn24h || "No burns",
          totalburnt: metricsData?.burnedSupply || "N/A",
          priceChange24h: priceData?.change24h || "N/A",
          priceChange6h: priceData?.change6h || "N/A",
          priceChange3h: priceData?.change3h || "N/A",
          priceChange1h: priceData?.change1h || "N/A",
          liquidity: priceData?.liquidity || "N/A",
          profile: profileData?.profileImage || "N/A",
          contract: contractAddress,
          description: descriptionData?.description || "N/A",
          holdersCount: holdersCount?.holder_count || "N/A",
          txns: priceData?.txns || "N/A",
        });
        setSocialLinks(socialData || null);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch token data";
        console.error("Error fetching token data:", errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    if (chain && contractAddress) {
      fetchTokenData();
    }
  }, [chain, contractAddress, router]);

  // Formatting functions
  const formatPrice = (
    price: string | number,
  ): { display: string; isExponential: boolean } => {
    try {
      if (price === null || price === undefined || price === "N/A")
        return { display: "N/A", isExponential: false };
      const num = parseFloat(price.toString());
      if (isNaN(num)) return { display: "N/A", isExponential: false };

      const strNum = num.toFixed(20);
      const decimalParts = strNum.split(".");
      const integerPart = decimalParts[0];
      const decimalPart = decimalParts[1] || "0";

      let leadingZeros = 0;
      let significantDigitsStart = 0;
      for (let i = 0; i < decimalPart.length; i++) {
        if (decimalPart[i] === "0") {
          leadingZeros++;
        } else {
          significantDigitsStart = i;
          break;
        }
      }

      if (leadingZeros > 4 && integerPart === "0") {
        const exponent = leadingZeros;
        const significantDigits = decimalPart
          .slice(significantDigitsStart)
          .replace(/0+$/, "");
        return {
          display: `0.0 ${exponent} ${significantDigits}`,
          isExponential: true,
        };
      }

      const maxDecimals = Math.abs(num) < 1 ? 6 : 5;
      const formatted = num
        .toLocaleString("en-US", {
          minimumFractionDigits: 0,
          maximumFractionDigits: maxDecimals,
          useGrouping: Math.abs(num) >= 1000,
        })
        .replace(/\.?0+$/, "");
      return { display: formatted, isExponential: false };
    } catch (error) {
      console.error("Error in formatPrice:", error);
      return { display: "N/A", isExponential: false };
    }
  };

  const formatLargeNumber = (
    value: string | number,
    defaultValue: string = "N/A",
  ): string => {
    try {
      if (value === null || value === undefined || value === "")
        return defaultValue;
      const num = parseFloat(value.toString());
      if (isNaN(num)) return defaultValue;

      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        compactDisplay: "short",
        minimumFractionDigits: 0,
        maximumFractionDigits: num >= 1000000 ? 1 : 0,
      }).format(num);
    } catch (error) {
      console.error("Error in formatLargeNumber:", error);
      return defaultValue;
    }
  };

  const formatWholeNumber = (number: string | number): string => {
    try {
      if (number === null || number === undefined || number === "") return "0";
      const num = parseFloat(number.toString());
      if (isNaN(num)) return "0";
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true,
      }).format(num);
    } catch (error) {
      console.error("Error in formatWholeNumber:", error);
      return "0";
    }
  };

  function formatEvmAddress(
    address: string,
    shorten: boolean = true,
    chars: number = 8,
  ): string {
    // Normalize to lowercase and remove '0x' prefix if present
    const normalized = address.toLowerCase().replace(/^0x/i, "");
    if (normalized.length < 40) {
      throw new Error(
        "Invalid EVM address. Must be 40 hexadecimal characters.",
      );
    }

    // Basic checksum: alternate case for readability (not full EIP-55, which requires Keccak-256)
    let checksum = "0x";
    for (let i = 0; i < normalized.length; i++) {
      // Simple rule: uppercase every even-indexed character (0-based)
      checksum += i % 2 === 0 ? normalized[i].toUpperCase() : normalized[i];
    }

    // Shorten if requested
    if (shorten) {
      if (chars < 1)
        throw new Error("Number of characters must be at least 1.");
      return checksum.slice(0, 2 + chars) + "..." + checksum.slice(-chars);
    }

    return checksum;
  }

  // Function to copy the token address to the clipboard
  async function copyAddress(address: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);

      alert("Address copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy address:", error);
      alert("Failed to copy address. Please try again.");
    }
  }

  // Check if token has burns enabled
  const showBurns = tokenMetadata?.isBurn;

  // Dev logging to verify burn visibility
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      try {
        // const reg = tokenMetadata?.address ? getTokenByAddress(tokenMetadata.address) : undefined;
        // console.log('[TokenPage] Burn visibility debug:', {
        //     contractAddress,
        //     tokenMetadata,
        //     registryLookup: reg,
        //     showBurns
        // });
      } catch (e) {
        console.error("Failed registry lookup in TokenPage debug:", e);
      }
    }
  }, [contractAddress, tokenMetadata, showBurns]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-3 md:px-8 mt-8">
        {loading ? (
          <LoadingWithLogo tokenSymbol={tokenMetadata?.symbol} />
        ) : error ? (
          <div className="text-center mt-8 text-red-500 bg-gray-100 p-6 rounded-lg">
            <h1 className="text-xl font-semibold">Error: {error}</h1>
            <button
              onClick={() => router.push("/")}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg"
            >
              Return to Home
            </button>
          </div>
        ) : (
          tokenData &&
          tokenMetadata && (
            <>
              <div className="md:hidden">
                {/* Info Tab */}

                {/* <div className="mb-16 w-full h-full">
                                    {chain && contractAddress && (
                                        <PriceActionChart
                                            tokenSymbol={tokenMetadata?.symbol?.toUpperCase() || ""}
                                            chain={chain.toLowerCase() as 'bsc' | 'sol' | 'rwa' | "eth "}
                                            contractAddress={contractAddress}
                                        />
                                    )}

                                    
                                </div> */}
                <div className={activeTab === "info" ? "" : "hidden"}>
                  <section className="px-2">
                    <div className="flex flex-col bg-white/25 rounded-lg p-4 mb-2 justify-between md:items-end w-full">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-row items-center gap-2 flex-1 min-w-0">
                          <img
                            src={`/api/${chain}/logo/${contractAddress}`}
                            alt={`${tokenMetadata.symbol.toUpperCase()} Logo`}
                            className="w-15 h-15 rounded-md object-contain flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/file.svg";
                              (e.target as HTMLImageElement).alt =
                                "Default Logo";
                            }}
                          />
                          <h1 className="text-2xl md:text-3xl font-bold">
                            {tokenMetadata.symbol.toUpperCase()}
                          </h1>
                        </div>
                        <div className="mt-4 flex gap-2 items-center bg-neutral-900 mb-4 rounded-md p-2">
                          <WatchlistButton
                            token={{
                              contract: contractAddress || "",
                              chain: chain || "",
                              symbol: tokenMetadata.symbol || "",
                              name: tokenMetadata.name || "",
                              logo: `/api/${chain}/logo/${contractAddress}`,
                            }}
                            className="w-full justify-center"
                          />
                        </div>
                      </div>
                      {socialLinks && (
                        <div className="flex flex-row gap-4 mt-2 items-center justify-between px-4 bg-white text-black p-4 rounded-lg">
                          <a
                            href={socialLinks.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Website</p>
                          </a>
                          <a
                            href={socialLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">X(Twitter)</p>
                          </a>
                          <a
                            href={socialLinks.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Telegram</p>
                          </a>
                          <a
                            href={socialLinks.scan}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Explorer</p>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row items-center justify-between mb-4">
                      <div className="mt-4 flex flex-col rounded-md">
                        <h1 className="text-sm">{tokenMetadata.name}</h1>
                        <h1 className="font-bold text-2xl">
                          ${" "}
                          {(() => {
                            const { display, isExponential } = formatPrice(
                              tokenData.price,
                            );
                            if (!isExponential) return display;
                            const [prefix, exponent, value] =
                              display.split(" ");
                            return (
                              <>
                                {prefix}
                                <sup className={styles.superscript}>
                                  {exponent}
                                </sup>{" "}
                                {value}
                              </>
                            );
                          })()}
                        </h1>
                      </div>
                      {/* <div className="bg-white/25 rounded-md px-4 py-2">
                        <h1 className="text-sm">24h Volume:</h1>
                        <h1 className="font-bold text-md">
                          ${formatWholeNumber(tokenData.volume)}
                        </h1>
                      </div> */}
                    </div>

                    {chain && contractAddress && (
                      <NewPriceActionChart
                        tokenSymbol={tokenMetadata?.symbol?.toUpperCase() || ""}
                        chain={chain.toLowerCase() as "bsc" | "sol" | "rwa" | "eth"}
                        contractAddress={contractAddress}
                      />
                    )}

                    <div className="mt-4 flex flex-row bg-black/35 justify-between gap-2 items-center rounded-md p-4">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">1h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange1h).startsWith("-") ? "text-red-400" : "text-green-400"}`}
                        >
                          {tokenData.priceChange1h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">3h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange3h).startsWith("-") ? "text-red-500" : "text-green-500"}`}
                        >
                          {tokenData.priceChange3h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">6h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange6h).startsWith("-") ? "text-red-600" : "text-green-600"}`}
                        >
                          {tokenData.priceChange6h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">24h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange24h).startsWith("-") ? "text-red-700" : "text-green-700"}`}
                        >
                          {tokenData.priceChange24h}%
                        </span>
                      </div>
                    </div>

                    {/* <div className="mt-4 flex flex-col items-center border-2 border-orange-500 rounded-md p-4">
                                            <h1>Price:</h1>
                                            <h1 className="font-medium text-lg md:text-xl">
                                                ${" "}
                                                {(() => {
                                                    const { display, isExponential } = formatPrice(tokenData.price);
                                                    if (!isExponential) return display;
                                                    const [prefix, exponent, value] = display.split(" ");
                                                    return (
                                                        <>
                                                            {prefix}
                                                            <sup className={styles.superscript}>{exponent}</sup> {value}
                                                        </>
                                                    );
                                                })()}
                                            </h1>
                                        </div> */}

                    {/* <div className="mt-4">
                                            <h1 className="font-bold text-xl">Description</h1>
                                            <p>{tokenData?.description || "No description found"}</p>
                                        </div> */}

                    <div className="flex flex-col gap-2 border border-white p-4 mt-4 rounded-xl">
                      <p className="text-md">Contract Address</p>
                      <h1 className="text-xl font-bold text-orange-500 flex gap-2">
                        <span>{formatEvmAddress(tokenData.contract)}</span>
                        <button onClick={() => copyAddress(tokenData.contract)}>
                          <FaCopy size={20} fill="#ffffff" />
                        </button>
                      </h1>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">MARKETCAP</h1>
                        <h1 className="font-bold text-lg">
                          ${formatLargeNumber(tokenData.marketCap)}
                        </h1>
                      </div>
                      <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">FDV</h1>
                        <h1 className="font-bold text-lg">
                          ${formatLargeNumber(tokenData.fdv)}
                        </h1>
                      </div>
                      {/* Liquidity */}
                      <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          Liquidity
                        </h1>
                        <div className="flex flex-row items-center justify-center gap-2">
                          <h1 className="font-bold text-lg">
                            ${formatLargeNumber(tokenData.liquidity)}
                          </h1>
                          <LiquidityLocker chain={chain} contractAddress={contractAddress}/>
                        </div>
                      </div>

                      <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">HOLDERS</h1>
                        <h1 className="font-bold text-lg">
                          {formatWholeNumber(tokenData.holdersCount)}
                        </h1>
                      </div>



                      {/* <div className="flex flex-col items-center border-2 border-orange-500 rounded-md p-4">
                                                <h1>Volume:</h1>
                                                <h1 className="font-medium text-lg md:text-xl">${formatLargeNumber(tokenData.volume)}</h1>
                                            </div> */}
                    </div>

                    <div className="mt-4 flex flex-col gap-4">
                      <VolumeTxnsInfo chain={chain?.toLowerCase() as "bsc" | "eth"} contractAddress={contractAddress} />
                    </div>

              
                    {/* 
                                        <div className="mt-4 flex flex-row bg-neutral-900 justify-between gap-2 items-center border-2 border-orange-500 rounded-md p-4">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs text-gray-400">1h</span>
                                                <span
                                                    className={`px-2 py-1 rounded ${String(tokenData.priceChange1h).startsWith("-") ? "text-red-400" : "text-green-400"}`}
                                                >
                                                    {tokenData.priceChange1h}%
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs text-gray-400">3h</span>
                                                <span
                                                    className={`px-2 py-1 rounded ${String(tokenData.priceChange3h).startsWith("-") ? "text-red-500" : "text-green-500"}`}
                                                >
                                                    {tokenData.priceChange3h}%
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs text-gray-400">6h</span>
                                                <span
                                                    className={`px-2 py-1 rounded ${String(tokenData.priceChange6h).startsWith("-") ? "text-red-600" : "text-green-600"}`}
                                                >
                                                    {tokenData.priceChange6h}%
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs text-gray-400">24h</span>
                                                <span
                                                    className={`px-2 py-1 rounded ${String(tokenData.priceChange24h).startsWith("-") ? "text-red-700" : "text-green-700"}`}
                                                >
                                                    {tokenData.priceChange24h}%
                                                </span>
                                            </div>
                                        </div> */}

                    {/* <div className="flex flex-col gap-2 bg-neutral-900 border-2 border-neutral-600 p-4 mt-4 rounded-xl">
                                            <p className="text-md">Contract Address</p>
                                            <h1 className="text-lg md:text-xl font-bold text-orange-500 flex gap-2">
                                                <span>{formatEvmAddress(tokenData.contract)}</span>
                                                <button onClick={() => copyAddress(tokenData.contract)}><FaCopy size={20} fill="#ffffff" /></button>
                                            </h1>
                                        </div> */}

                    {chain && contractAddress && (
                      <>
                        <div className="mt-8 flex flex-col border-2 border-orange-500 p-4 rounded-xl gap-2">
                          <h1 className="text-xl font-bold">
                            SECURITY ANALYSIS
                          </h1>
                          <SecurityAnalysis
                            chain={chain}
                            contractAddress={contractAddress}
                          />
                          <HoneypotAnalysis
                            chain={chain}
                            contractAddress={contractAddress}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex-1">
                      <div className="my-8 space-y-4">
                        <DataCard
                          title="Total Supply"
                          value={formatWholeNumber(tokenData.totalSupply)}
                          bg="bg-white text-black"
                          image="/tSupply.png"
                        />
                        <DataCard
                          title="Total Locked"
                          value={formatWholeNumber(tokenData.lSupply)}
                          bg="bg-blue-600"
                          image="/lock-bg.png"
                        />
                        <DataCard
                          title="Circulatory Supply"
                          value={formatWholeNumber(tokenData.cSupply)}
                          bg="bg-green-600"
                          image="/cSupply-bg.png"
                        />
                        <DataCard
                          title="Total Burnt"
                          value={formatWholeNumber(tokenData.totalburnt)}
                          bg="bg-white text-black"
                          image="/burn-bg.png"
                        />
                      </div>
                    </div>

                    {tokenData.contract && chain && (
                      <CurrencyConverter
                        tokenSymbol={tokenMetadata.symbol.toUpperCase()}
                        tokenAddress={tokenData.contract}
                        tokenLogoUrl={`/api/${chain}/logo/${contractAddress}`}
                        chain={chain}
                      />
                    )}

                    {/* <div className="mt-4 flex gap-2 items-center bg-neutral-900 mb-4 rounded-md p-2">
                                            <WatchlistButton
                                                token={{
                                                    contract: contractAddress || "",
                                                    chain: chain || "",
                                                    symbol: tokenMetadata.symbol || "",
                                                    name: tokenMetadata.name || "",
                                                    logo: `/api/${chain}/logo/${contractAddress}`
                                                }}
                                                className="w-full justify-center"
                                            />
                                        </div> */}
                  </section>

                  <section className="mt-8 flex flex-col my-16">
                    {/* <div className="flex-1">
                                            <div className="my-8 space-y-4">
                                                <DataCard
                                                    title="Total Supply"
                                                    value={formatWholeNumber(tokenData.totalSupply)}
                                                    bg="bg-white text-black"
                                                    image="/tSupply.png"
                                                />
                                                <DataCard
                                                    title="Total Locked"
                                                    value={formatWholeNumber(tokenData.lSupply)}
                                                    bg="bg-blue-600"
                                                    image="/lock-bg.png"
                                                />
                                                <DataCard
                                                    title="Circulatory Supply"
                                                    value={formatWholeNumber(tokenData.cSupply)}
                                                    bg="bg-green-600"
                                                    image="/cSupply-bg.png"
                                                />
                                                <DataCard
                                                    title="Total Burnt"
                                                    value={formatWholeNumber(tokenData.totalburnt)}
                                                    bg="bg-white text-black"
                                                    image="/burn-bg.png"
                                                />
                                            </div>
                                        </div> */}

                    <div className="flex gap-2 md:gap-3 items-center justify-center mb-4 flex-wrap">
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(1)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🔥
                        </div>
                        <h1 className="font-semibold">{emojiCounts[1]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(2)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🚀
                        </div>
                        <h1 className="font-semibold">{emojiCounts[2]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(3)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          ❤️‍🔥
                        </div>
                        <h1 className="font-semibold">{emojiCounts[3]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(4)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          💩
                        </div>
                        <h1 className="font-semibold">{emojiCounts[4]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(5)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🚩
                        </div>
                        <h1 className="font-semibold">{emojiCounts[5]}</h1>
                      </div>
                    </div>
                    {hasReactedToday && (
                      <p className="text-center text-sm text-gray-400 mb-4">
                        You have already reacted today. Come back tomorrow to
                        react again!
                      </p>
                    )}
                    {/* <button onClick={() => resetEmojiCounts()} className="w-full mb-16 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200">
                                            Reset All
                                        </button> */}
                  </section>
                </div>

                {/* Burns Tab */}
                <div className={activeTab === "burns" ? "" : "hidden"}>
                  {showBurns && (
                    <section className="mt-8 flex flex-col">
                      <div className="flex-1">
                        {tokenMetadata && (
                          <BurnIntervals
                            contractAddress={tokenMetadata.address}
                            tokenSymbol={tokenMetadata.symbol}
                          />
                        )}
                      </div>
                      {tokenMetadata && chain && (
                        <BurnsDisplay
                          contractAddress={tokenMetadata.address}
                          chain={chain}
                        />
                      )}
                    </section>
                  )}
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:block">
                {/* Top Section: Token Info + Chart */}
                <section
                  className="flex flex-row items-start md:gap-8"
                  style={{ height: "calc(100vh - 8rem)" }}
                >
                  {/* Left Side: Token Information */}
                  <div className="w-[35%] h-full overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="flex flex-col gap-2 bg-black rounded-md p-4 mb-4">
                      <div className="flex flex-row items-center gap-2">
                        <img
                          src={`/api/${chain}/logo/${contractAddress}`}
                          alt={`${tokenMetadata.symbol.toUpperCase()} Logo`}
                          className="w-12 h-12 rounded-md object-contain flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/file.svg";
                            (e.target as HTMLImageElement).alt = "Default Logo";
                          }}
                        />
                        <h1 className="text-2xl break-words">
                          {tokenMetadata.name}
                        </h1>
                        <h1 className="uppercase font-bold text-2xl">
                          {tokenMetadata.symbol}
                        </h1>
                      </div>

                      {socialLinks && (
                        <div className="flex flex-row gap-4 mt-2 items-center justify-between px-4 bg-white text-black p-4 rounded-lg">
                          <a
                            href={socialLinks.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Website</p>
                          </a>
                          <a
                            href={socialLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">X(Twitter)</p>
                          </a>
                          <a
                            href={socialLinks.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Telegram</p>
                          </a>
                          <a
                            href={socialLinks.scan}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <p className="text-sm">Explorer</p>
                          </a>
                        </div>
                      )}

                    </div>


                    <div className="mb-4">
                      <TokenInfo
                        chain={chain?.toLowerCase() as "bsc" | "eth"}
                        contractAddress={contractAddress}
                      />
                    </div>

                    <div className="flex flex-col justify-center gap-4">
                      <VolumeTxnsInfo
                        chain={chain?.toLowerCase() as "bsc" | "eth"}
                        contractAddress={contractAddress}
                      />
                    </div>



                    <div className="flex flex-col gap-2 bg-neutral-900 border-2 border-neutral-600 p-4 mt-4 rounded-xl">
                      <p className="text-md">Contract Address</p>
                      <h1 className="text-lgfont-bold text-orange-500 flex gap-2">
                        <span>{tokenData.contract}</span>
                        <button onClick={() => copyAddress(tokenData.contract)}>
                          <FaCopy size={20} fill="#ffffff" />
                        </button>
                      </h1>
                    </div>

                    {tokenData.contract && tokenMetadata && chain && (
                      <CurrencyConverter
                        tokenSymbol={tokenMetadata.symbol.toUpperCase()}
                        tokenAddress={tokenData.contract}
                        tokenLogoUrl={`/api/${chain}/logo/${contractAddress}`}
                        chain={chain}
                      />
                    )}

                    <div className="mt-4 flex gap-2 items-center bg-neutral-900 mb-4 rounded-md p-2">
                      <WatchlistButton
                        token={{
                          contract: contractAddress || "",
                          chain: chain || "",
                          symbol: tokenMetadata.symbol || "",
                          name: tokenMetadata.name || "",
                          logo: `/api/${chain}/logo/${contractAddress}`,
                        }}
                        className="w-full justify-center"
                      />
                    </div>

                    <div className="mt-8 space-y-4">
                      <DataCard
                        title="Total Supply"
                        value={formatWholeNumber(tokenData.totalSupply)}
                        bg="bg-white text-black"
                        image="/tSupply.png"
                      />
                      <DataCard
                        title="Total Locked"
                        value={formatWholeNumber(tokenData.lSupply)}
                        bg="bg-blue-600"
                        image="/lock-bg.png"
                      />
                      <DataCard
                        title="Circulatory Supply"
                        value={formatWholeNumber(tokenData.cSupply)}
                        bg="bg-green-600"
                        image="/cSupply-bg.png"
                      />
                      <DataCard
                        title="Total Burnt"
                        value={formatWholeNumber(tokenData.totalburnt)}
                        bg="bg-white text-black"
                        image="/burn-bg.png"
                      />
                    </div>
                  </div>

                  {/* Right Side: Chart */}
                  <div className="w-[65%] h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {/* {chain && contractAddress && (
                                            <PriceActionChart
                                                tokenSymbol={tokenMetadata?.symbol?.toUpperCase() || ""}
                                                chain={chain.toLowerCase() as 'bsc' | 'sol' | 'rwa' | "eth"}
                                                contractAddress={contractAddress}
                                            />
                                        )} */}

                    <div className="mb-4 grid grid-cols-5 gap-2 items-stretch">
                      {/* Price */}
                      <div className="flex flex-col items-start justify-center rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          {tokenMetadata.symbol} PRICE
                        </h1>
                        <h1 className="font-bold text-xl leading-tight text-center">
                          ${" "}
                          {(() => {
                            const { display, isExponential } = formatPrice(
                              tokenData.price,
                            );
                            if (!isExponential) return display;
                            const [prefix, exponent, value] =
                              display.split(" ");
                            return (
                              <>
                                {prefix}
                                <sup className={styles.superscript}>
                                  {exponent}
                                </sup>{" "}
                                {value}
                              </>
                            );
                          })()}
                        </h1>
                      </div>
                      {/* Marketcap */}
                      <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          Marketcap
                        </h1>
                        <h1 className="font-bold text-base">
                          ${formatLargeNumber(tokenData.marketCap)}
                        </h1>
                      </div>
                      {/* FDV */}
                      <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          FDV
                        </h1>
                        <h1 className="font-bold text-base">
                          ${formatLargeNumber(tokenData.fdv)}
                        </h1>
                      </div>
                      {/* Liquidity */}
                      <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          Liquidity
                        </h1>
                        <div className="flex flex-row items-center justify-center gap-1">
                          <h1 className="font-bold text-base">
                            ${formatLargeNumber(tokenData.liquidity)}
                          </h1>
                          <LiquidityLocker chain={chain?.toLowerCase() as "bsc" | "eth"} 
                          contractAddress={contractAddress}/>
                        </div>
                      </div>
                      {/* Volume */}
                      {/* <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          Volume
                        </h1>
                        <h1 className="font-bold text-base">
                          ${formatLargeNumber(tokenData.volume)}
                        </h1>
                      </div> */}
                      {/* Holders */}
                      <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">
                          Holders
                        </h1>
                        <h1 className="font-bold text-base">
                          {formatWholeNumber(tokenData.holdersCount)}
                        </h1>
                      </div>
                    </div>

                    <div className="mt-4 mb-2 flex flex-row justify-center items-center gap-4 border-2 border-orange-500 rounded-md p-4">
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">1h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange1h).startsWith("-") ? "text-red-400" : "text-green-400"}`}
                        >
                          {tokenData.priceChange1h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">3h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange3h).startsWith("-") ? "text-red-500" : "text-green-500"}`}
                        >
                          {tokenData.priceChange3h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">6h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange6h).startsWith("-") ? "text-red-600" : "text-green-600"}`}
                        >
                          {tokenData.priceChange6h}%
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400">24h</span>
                        <span
                          className={`px-2 py-1 rounded ${String(tokenData.priceChange24h).startsWith("-") ? "text-red-700" : "text-green-700"}`}
                        >
                          {tokenData.priceChange24h}%
                        </span>
                      </div>
                    </div>

                    {chain && contractAddress && (
                      <NewPriceActionChart
                        tokenSymbol={tokenMetadata?.symbol?.toUpperCase() || ""}
                        chain={chain.toLowerCase() as "bsc" | "sol" | "rwa" | "eth"}
                        contractAddress={contractAddress}
                      />
                    )}

                    {/* Bottom Section: Burns (if enabled) */}
                    {showBurns && (
                      <section className="mt-4 mb-8">
                        <div className="grid grid-cols-1 gap-8">
                          <div className="p-4 rounded-lg shadow-lg">
                            <BurnIntervals
                              contractAddress={tokenMetadata?.address || ""}
                              tokenSymbol={tokenMetadata?.symbol}
                            />
                          </div>
                          <div>
                            {chain && tokenMetadata?.address && (
                              <BurnsDisplay
                                contractAddress={tokenMetadata.address}
                                chain={chain}
                              />
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    {/* {chain && contractAddress && (
                                            <>
                                                <div className="mt-8 flex flex-col border-2 border-orange-500 p-4 rounded-xl gap-2">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <h1 className="text-xl font-bold">SECURITY ANALYSIS</h1>
                                                    </div>
                                                    <SecurityAnalysis chain={chain} contractAddress={contractAddress} />
                                                    <HoneypotAnalysis chain={chain} contractAddress={contractAddress} />
                                                </div>
                                            </>
                                        )} */}

                    <div className="flex mt-8 gap-4 md:gap-8 md:w-full items-center justify-center mb-4 flex-wrap">
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(1)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🔥
                        </div>
                        <h1 className="font-semibold">{emojiCounts[1]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(2)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🚀
                        </div>
                        <h1 className="font-semibold">{emojiCounts[2]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(3)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          ❤️‍🔥
                        </div>
                        <h1 className="font-semibold">{emojiCounts[3]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(4)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          💩
                        </div>
                        <h1 className="font-semibold">{emojiCounts[4]}</h1>
                      </div>
                      <div
                        onClick={() =>
                          !hasReactedToday && submitEmojiReaction(5)
                        }
                        className={`border-2 flex flex-col items-center gap-1 border-orange-500 p-3 md:p-4 aspect-square rounded-lg transition-all duration-200 ${hasReactedToday
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-orange-500 hover:bg-opacity-10 transform hover:scale-110 cursor-pointer"
                          }`}
                        title={
                          hasReactedToday
                            ? "You have already reacted today"
                            : ""
                        }
                      >
                        <div className="text-3xl md:text-4xl flex items-center justify-center h-full">
                          🚩
                        </div>
                        <h1 className="font-semibold">{emojiCounts[5]}</h1>
                      </div>
                    </div>
                    {hasReactedToday && (
                      <p className="text-center text-sm text-gray-400 mb-4">
                        You have already reacted today. Come back tomorrow to
                        react again!
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )
        )}
      </main>
      <div className="md:hidden">
        <Footer
          onTabChange={setActiveTab}
          activeTab={activeTab}
          showBurns={!!showBurns}
        />
      </div>
    </div>
  );
}
