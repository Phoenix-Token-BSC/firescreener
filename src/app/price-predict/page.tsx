"use client";

import Header from '@/components/Header';
import { TOKEN_REGISTRY } from '@/lib/tokenRegistry';
import { toPng, toBlob } from 'html-to-image';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

// Define interfaces for our data structures
interface TokenData {
  id: string;
  symbol: string;
  name: string;
  price?: string;
  marketCap?: string;
  volume24h?: string;
  priceChange24h?: string;
  image?: string;
  isTop100?: boolean;
  isMeme?: boolean;
}

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
}

interface CoinGeckoCoinData {
  id: string;
  symbol: string;
  name: string;
  image: { large: string; };
  market_data: {
    current_price: { usd: number; };
    market_cap: { usd: number; };
    total_volume: { usd: number; };
    price_change_percentage_24h: number;
    ath_market_cap: { usd: number; };
  };
}

// Token list with chain mapping
// Build TOKENS list from the central TOKEN_REGISTRY to avoid maintaining separate lists
// We normalize to lower-case `id` to match previous usage (symbols like 'pht')
const TOKENS = TOKEN_REGISTRY
  .filter(t => t.chain === 'bsc' && t.symbol && t.symbol.trim().length > 0)
  .map(t => ({
    id: t.symbol.toLowerCase(),
    symbol: t.symbol.toUpperCase(),
    name: t.name || t.symbol.toUpperCase(),
    chain: t.chain,
  }));

const formatMarketCap = (marketCap: string | undefined): string => {
  if (!marketCap) return '$0';
  const mc = parseFloat(marketCap);
  if (mc >= 1_000_000_000) {
    return `$${(mc / 1_000_000_000).toFixed(2)}B`;
  }
  if (mc >= 1_000_000) {
    return `$${(mc / 1_000_000).toFixed(2)}M`;
  }
  if (mc >= 1_000) {
    return `$${(mc / 1_000).toFixed(2)}K`;
  }
  return `$${mc.toFixed(2)}`;
};

// Helper to convert data URL to Blob
const dataUrlToBlob = async (url: string): Promise<Blob> => {
  return await (await fetch(url)).blob();
};


const PriceComparison = () => {
  const [cryptoA, setCryptoA] = useState<string>('pht');
  const [cryptoB, setCryptoB] = useState<string>('wkc');
  const [cryptoAData, setCryptoAData] = useState<TokenData | null>(null);
  const [cryptoBData, setCryptoBData] = useState<TokenData | null>(null);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingTokens, setLoadingTokens] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'now' | 'ath'>('now');
  const [searchTermA, setSearchTermA] = useState('');
  const [searchTermB, setSearchTermB] = useState('');
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);
  const [activeTab, setActiveTab] = useState<'platform' | 'top100' | 'meme'>('platform');
  const comparisonRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);


  const fetchTokenData = useCallback(async (tokenId: string, timeframe: 'now' | 'ath' = 'now'): Promise<TokenData | null> => {
    const isPlatformToken = TOKENS.some(t => t.id === tokenId);

    if (isPlatformToken) {
      // Find the contract address for the platform token
      // Try to match by symbol (id) in the registry
      const tokenMeta = TOKEN_REGISTRY.find(
        (t) => t.symbol.toLowerCase() === tokenId.toLowerCase() && t.chain === 'bsc'
      );
      if (!tokenMeta) {
        console.error(`No contract address found for platform token: ${tokenId}`);
        return null;
      }

      // If fetching ATH, try CoinGecko first (Dexscreener doesn't have ATH)
      if (timeframe === 'ath') {
        try {
          // Map internal chain ID to CoinGecko asset platform ID
          // Currently only supporting BSC as per the regex filter above
          const platformId = 'binance-smart-chain';

          const response = await fetch(`https://api.coingecko.com/api/v3/coins/${platformId}/contract/${tokenMeta.address}`);

          if (response.ok) {
            const data: CoinGeckoCoinData = await response.json();
            const athMarketCap = data.market_data.ath_market_cap?.usd;

            // Only use this data if we actually got a valid ATH market cap
            if (athMarketCap !== undefined && athMarketCap !== null) {
              return {
                id: tokenId,
                symbol: data.symbol.toUpperCase(),
                name: data.name,
                // We use CoinGecko data for consistency if we're using their ATH
                price: data.market_data.current_price.usd.toString(),
                marketCap: athMarketCap.toString(),
                volume24h: data.market_data.total_volume.usd.toString(),
                priceChange24h: data.market_data.price_change_percentage_24h.toString(),
                image: data.image.large,
              };
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch ATH from CoinGecko for ${tokenId}, falling back to Dexscreener`, err);
          // Continue to Dexscreener fallback
        }
      }

      try {
        // Fetch directly from Dexscreener API using the contract address
        const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenMeta.address}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch data from Dexscreener for ${tokenId}`);
        }
        const dexData = await response.json();
        // Parse Dexscreener response (assume first pair is the most relevant)
        const pair = dexData.pairs && dexData.pairs.length > 0 ? dexData.pairs[0] : null;
        if (!pair) {
          throw new Error(`No pair data found on Dexscreener for ${tokenId}`);
        }
        return {
          id: tokenId,
          symbol: pair.baseToken?.symbol || tokenMeta.symbol.toUpperCase() || '',
          name: pair.baseToken?.name || tokenMeta.name || '',
          price: pair.priceUsd || '0',
          marketCap: pair.fdv || '0',
          volume24h: pair.volume?.h24 || '0',
          priceChange24h: pair.priceChange?.h24 || '0',
          image: pair.baseToken?.logoURI || '',
        };
      } catch (err) {
        console.error(`Error fetching Dexscreener data for ${tokenId}:`, err);
        return null;
      }
    } else {
      // It might be a coingecko token
      try {
        // Use CoinGecko Markets API as requested
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenId}`
        );
        if (!response.ok) {
          return null;
        }

        const dataArray = await response.json();
        if (!Array.isArray(dataArray) || dataArray.length === 0) {
          return null;
        }

        const data = dataArray[0]; // Take the first result

        let marketCapStr = data.market_cap.toString();

        if (timeframe === 'ath') {
          // Calculate ATH Market Cap: ATH Price * Circulating Supply
          // Note: This is "Implied ATH Market Cap" based on current supply
          const athPrice = data.ath;
          const supply = data.circulating_supply;

          if (athPrice && supply) {
            marketCapStr = (athPrice * supply).toString();
          } else {
            // Fallback if data is missing, though unlikely for top tokens
            marketCapStr = data.market_cap.toString();
          }
        }

        return {
          id: data.id,
          symbol: data.symbol.toUpperCase(),
          name: data.name,
          price: data.current_price.toString(),
          marketCap: marketCapStr,
          volume24h: data.total_volume.toString(),
          priceChange24h: data.price_change_percentage_24h.toString(),
          image: data.image,
          isTop100: true,
          // We don't explicitly set isMeme here, it's inferred from the list logic or defaults
        }

      } catch (err) {
        console.error(`Error fetching coingecko token ${tokenId}:`, err);
        return null;
      }
    }
  }, []);

  const fetchTokenLists = useCallback(async () => {
    const CACHE_KEY = 'token_lists_data';
    const CACHE_TIMESTAMP_KEY = 'token_lists_timestamp';
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    try {
      setLoadingTokens(true);

      // Check cache first
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      const now = Date.now();

      if (cachedData && cachedTimestamp) {
        const age = now - parseInt(cachedTimestamp);
        if (age < CACHE_DURATION) {
          console.log('Using cached token lists');
          setTokens(JSON.parse(cachedData));
          setLoadingTokens(false);
          return;
        }
      }

      const platformTokens = TOKENS.map(token => ({ ...token, isTop100: false, isMeme: false }));

      // Fetch Top 100
      let top100Data: CoinGeckoMarketData[] = [];
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false'
        );
        if (response.ok) {
          top100Data = await response.json();
        } else {
          console.warn('Rate limit or error fetching top 100, using cache if available');
          throw new Error('Failed to fetch top 100');
        }
      } catch (e) {
        if (cachedData) {
          console.log('Falling back to cached data due to error');
          setTokens(JSON.parse(cachedData));
          setLoadingTokens(false);
          return;
        }
        throw e;
      }

      const top100Tokens = top100Data.map((coin) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        isTop100: true,
        isMeme: false,
      }));

      // Fetch Meme Tokens
      let memeData: CoinGeckoMarketData[] = [];
      try {
        const meme_response = await fetch(
          'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=meme-token&per_page=50'
        );
        if (meme_response.ok) {
          memeData = await meme_response.json();
        } else {
          console.warn('Rate limit or error fetching meme tokens');
        }
      } catch (e) {
        console.warn('Error fetching meme tokens', e);
        // Don't fail entire app if meme tokens fail, just proceed with what we have if possible
      }

      const memeTokens = memeData.map((coin) => ({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        image: coin.image,
        isTop100: false,
        isMeme: true,
      }));

      const platformTokenIds = new Set(platformTokens.map(t => t.id));
      const uniqueTop100Tokens = top100Tokens.filter(t => !platformTokenIds.has(t.id));

      const existingIds = new Set([...platformTokens.map(t => t.id), ...uniqueTop100Tokens.map(t => t.id)]);
      const uniqueMemeTokens = memeTokens.filter(t => !existingIds.has(t.id));

      const allTokens = [...platformTokens, ...uniqueTop100Tokens, ...uniqueMemeTokens];

      // Save to cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(allTokens));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());

      setTokens(allTokens);

    } catch (error) {
      console.error('Error fetching token lists:', error);
      // Final fallback to cache even if error
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        console.log('Using cached data after error');
        setTokens(JSON.parse(cachedData));
      } else {
        setError('Failed to load token lists. API rate limit likely reached. Please try again later.');
      }
    } finally {
      setLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenLists();
  }, [fetchTokenLists]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dataA, dataB] = await Promise.all([
          fetchTokenData(cryptoA, 'now'),
          fetchTokenData(cryptoB, timeframe)
        ]);
        setCryptoAData(dataA);
        setCryptoBData(dataB);
      } catch (err) {
        setError('Failed to fetch data. Please try again later.');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    if (tokens.length > 0) {
      fetchInitialData();
    }
  }, [cryptoA, cryptoB, fetchTokenData, tokens, timeframe]);


  const calculateAdjustedPrice = useCallback((tokenA: TokenData | null, tokenB: TokenData | null): number => {
    if (!tokenA || !tokenB || !tokenA.price || !tokenB.marketCap) return 0;

    const priceA = parseFloat(tokenA.price);
    const marketCapB = parseFloat(tokenB.marketCap);

    if (priceA <= 0 || marketCapB <= 0) return 0;

    const potentialPrice = marketCapB / (parseFloat(tokenA.marketCap || '0') / priceA);

    return potentialPrice;
  }, []);

  const handleDownload = async () => {
    if (!comparisonRef.current || !cryptoAData || !cryptoBData) return;
    try {
      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render

      const dataUrl = await toPng(comparisonRef.current, {
        backgroundColor: '#FF6600',
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = 'price-comparison.png';
      link.href = dataUrl;
      link.click();

      setIsCapturing(false);
    } catch (err) {
      console.error('Error downloading:', err);
      setIsCapturing(false);
      alert('Failed to generate image. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!comparisonRef.current || !cryptoAData || !cryptoBData) return;

    try {
      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const blob = await toBlob(comparisonRef.current, {
        backgroundColor: '#FF6600',
        cacheBust: true,
        pixelRatio: 2,
      });

      if (!blob) {
        console.error('Failed to create blob');
        setIsCapturing(false);
        return;
      }

      const file = new File([blob], 'price-comparison.png', { type: 'image/png' });
      const shareText = `Check out this potential price for ${cryptoAData.symbol} with ${cryptoBData.symbol}'s market cap! By Firescreener`;

      const shareData = {
        title: 'Price Comparison',
        text: shareText,
        files: [file]
      };

      // Always try to copy to clipboard as backup
      try {
        await navigator.clipboard.writeText(shareText + ' https://firescreener.com');
      } catch (err) {
        console.warn('Clipboard write failed', err);
      }

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share(shareData);
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error sharing:', error);
            // Fallback to manual download
            const link = document.createElement('a');
            link.download = 'price-comparison.png';
            link.href = URL.createObjectURL(blob);
            link.click();
            alert('Share failed, but image downloaded! Text copied to clipboard.');
          }
        }
      } else {
        // Fallback to download
        const link = document.createElement('a');
        link.download = 'price-comparison.png';
        link.href = URL.createObjectURL(blob);
        link.click();
        alert('Sharing not supported on this device/browser. Image downloaded! Text copied to clipboard.');
      }
      setIsCapturing(false);

    } catch (err) {
      console.error('Error sharing:', err);
      setIsCapturing(false);
      alert('Error generating or sharing image.');
    }
  };


  const renderTokenSelect = (type: 'from' | 'to'): React.ReactElement => {
    const isFrom = type === 'from';
    const selectedTokenId = isFrom ? cryptoA : cryptoB;
    const setSelectedToken = isFrom ? setCryptoA : setCryptoB;
    const searchTerm = isFrom ? searchTermA : searchTermB;
    const setSearchTerm = isFrom ? setSearchTermA : setSearchTermB;
    const showDropdown = isFrom ? showDropdownA : showDropdownB;
    const setShowDropdown = isFrom ? setShowDropdownA : setShowDropdownB;
    const selectedTokenData = (isFrom ? cryptoAData : cryptoBData);

    const searchLower = searchTerm.toLowerCase();

    const platformTokens = tokens.filter(t => !t.isTop100 && !t.isMeme);
    const top100Tokens = tokens.filter(t => t.isTop100);
    const memeTokens = tokens.filter(t => t.isMeme);

    const filteredPlatformTokens = platformTokens.filter(token =>
      token.symbol.toLowerCase().includes(searchLower) || token.name.toLowerCase().includes(searchLower)
    );

    const filteredTop100Tokens = top100Tokens.filter(token =>
      token.symbol.toLowerCase().includes(searchLower) || token.name.toLowerCase().includes(searchLower)
    );

    const filteredMemeTokens = memeTokens.filter(token =>
      token.symbol.toLowerCase().includes(searchLower) || token.name.toLowerCase().includes(searchLower)
    );

    const handleSelect = (tokenId: string) => {
      setSelectedToken(tokenId);
      const tokenInfo = tokens.find(t => t.id === tokenId);
      setSearchTerm(tokenInfo?.symbol || ''); // Set to symbol, not name
      setShowDropdown(false);
    };

    const handleFocus = () => {
      setShowDropdown(true);
      setSearchTerm('');
    };

    return (
      <div className="relative w-full">
        <div className="relative">
          <input
            type="text"
            className="w-full bg-white/10 border border-white/20 rounded-lg py-2 pl-3 pr-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#FF7F27] focus:border-transparent"
            placeholder={loadingTokens ? 'Loading tokens...' : `Search ${type === 'from' ? 'Token A' : 'Token B'}`}
            value={showDropdown ? searchTerm : selectedTokenData?.symbol || ''}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            disabled={loadingTokens}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full bg-[#3d0a00] border border-white/20 rounded-lg shadow-xl max-h-96 overflow-auto">
            {filteredPlatformTokens.length === 0 && filteredTop100Tokens.length === 0 && filteredMemeTokens.length === 0 ? (
              <div className="px-4 py-2 text-white/60">No tokens found</div>
            ) : (
              <div>
                {type === 'from' && filteredPlatformTokens.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-medium text-white/60 uppercase tracking-wider">Platform Tokens</div>
                    {filteredPlatformTokens.map((token) => (
                      <div
                        key={token.id}
                        className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center ${selectedTokenId === token.id ? 'bg-white/15' : ''
                          }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(token.id);
                        }}
                      >
                        {token.image && (
                          <img src={token.image} alt={token.name} className="w-5 h-5 mr-2 rounded-full" />
                        )}
                        <span className="font-medium text-white">{token.symbol}</span>
                      </div>
                    ))}
                  </div>
                )}
                {type === 'to' && (
                  <>
                    <div className="flex border-b border-white/20 sticky top-0 bg-[#3d0a00]">
                      <button
                        className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'platform' ? 'text-white border-b-2 border-[#FF7F27]' : 'text-white/60'}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveTab('platform')}
                      >
                        Platform
                      </button>
                      <button
                        className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'top100' ? 'text-white border-b-2 border-[#FF7F27]' : 'text-white/60'}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveTab('top100')}
                      >
                        Top 100
                      </button>
                      <button
                        className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === 'meme' ? 'text-white border-b-2 border-[#FF7F27]' : 'text-white/60'}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setActiveTab('meme')}
                      >
                        Meme
                      </button>
                    </div>

                    {activeTab === 'platform' && (
                      <div>
                        {filteredPlatformTokens.map((token) => (
                          <div
                            key={token.id}
                            className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center ${selectedTokenId === token.id ? 'bg-white/15' : ''
                              }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(token.id);
                            }}
                          >
                            {token.image && (
                              <img src={token.image} alt={token.name} className="w-5 h-5 mr-2 rounded-full" />
                            )}
                            <span className="font-medium text-white">{token.symbol}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'top100' && (
                      <div>
                        {filteredTop100Tokens.map((token) => (
                          <div
                            key={token.id}
                            className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center ${selectedTokenId === token.id ? 'bg-white/15' : ''
                              }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(token.id);
                            }}
                          >
                            {token.image && (
                              <img src={token.image} alt={token.name} className="w-5 h-5 mr-2 rounded-full" />
                            )}
                            <span className="font-medium text-white">{token.symbol}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeTab === 'meme' && (
                      <div>
                        {filteredMemeTokens.map((token) => (
                          <div
                            key={token.id}
                            className={`px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center ${selectedTokenId === token.id ? 'bg-white/15' : ''
                              }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(token.id);
                            }}
                          >
                            {token.image && (
                              <img src={token.image} alt={token.name} className="w-5 h-5 mr-2 rounded-full" />
                            )}
                            <span className="font-medium text-white">{token.symbol}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderComparison = (): React.ReactElement => {
    if (loading || loadingTokens) {
      return (
        <div className="text-center py-12 text-white">
          Loading token data...
        </div>
      );
    }

    if (error) {
      return <div className="text-center text-red-300 py-12">{error}</div>;
    }

    if (!cryptoAData || !cryptoBData) {
      return (
        <div className="text-center text-white/80 py-12">
          Select tokens to compare
        </div>
      );
    }

    const currentPrice = parseFloat(cryptoAData.price || '0');
    const potentialPrice = calculateAdjustedPrice(cryptoAData, cryptoBData);
    const multiplier = currentPrice > 0 ? potentialPrice / currentPrice : 0;

    return (
      <div className="flex flex-col items-center w-full" ref={comparisonRef}>
        {/* Token A box */}
        <div className="w-full rounded-xl bg-black/30 px-4 py-3 mb-3">
          <p className="font-bold text-white text-base md:text-lg">
            {cryptoAData.symbol} ({cryptoAData.name})
          </p>
          <p className="text-white/90 text-sm">
            Price: ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}, Market Cap: {formatMarketCap(cryptoAData.marketCap)}
          </p>
        </div>

        <p className="text-white font-medium my-2">Compare with</p>

        {/* Token B box */}
        <div className="w-full rounded-xl bg-black/30 px-4 py-3 mb-4">
          <p className="font-bold text-white text-base md:text-lg">
            {cryptoBData.symbol} ({cryptoBData.name})
          </p>
          <p className="text-white/90 text-sm">
            (Price: ${parseFloat(cryptoBData.price || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}, Market Cap {formatMarketCap(cryptoBData.marketCap)})
          </p>
        </div>

        {/* Prediction result */}
        <p className="text-white/95 text-sm md:text-base mb-1">
          ${cryptoAData.symbol} AT ${cryptoBData.symbol} MARKETCAP
        </p>
        <p className="text-white text-3xl md:text-5xl font-bold mb-1">
          ${potentialPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-white text-2xl md:text-4xl font-bold mb-6">
          {multiplier.toFixed(1)}X
        </p>

        {/* Current MC / ATH toggle inside card */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTimeframe('now')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm ${timeframe === 'now'
              ? 'bg-white text-[#FF7F27]'
              : 'bg-white/20 text-white'
              }`}
          >
            Current MC
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('ath')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm ${timeframe === 'ath'
              ? 'bg-white text-[#FF7F27]'
              : 'bg-white/20 text-white'
              }`}
          >
            ATH
          </button>
        </div>

        {isCapturing && (
          <div className="absolute bottom-4 right-4 flex items-center space-x-1 opacity-60">
            <Image src="/logo-fixed.png" alt="logo" width={25} height={25} className="w-6 h-auto" />
            <span className="text-xs font-bold text-white tracking-widest">FIRESCREENER</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen text-white">
      <Header />
      <div className="max-w-lg mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <h1 className="text-4xl md:text-5xl uppercase font-bold text-center mb-2" style={{ color: '#FF7F27' }}>
          Price Predict
        </h1>
        <p className="text-white/90 text-center text-sm md:text-base mb-8">
          Get token&apos;s futuristic price by checking it&apos;s futuristic marketcap of other tokens
        </p>

        {/* Token selectors - compact row above card */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 sm:items-center mb-4">
          <div className="flex-1 min-w-0">
            <span className="text-white/70 text-xs block mb-1">Token</span>
            {renderTokenSelect('from')}
          </div>
          <span className="text-white/80 text-sm text-center hidden sm:block">vs</span>
          <div className="flex-1 min-w-0">
            <span className="text-white/70 text-xs block mb-1">Compare with</span>
            {renderTokenSelect('to')}
          </div>
        </div>

        {/* Main orange prediction card */}
        <div
          className="rounded-2xl p-6 md:p-8 relative"
          style={{ backgroundColor: '#FF6600' }}
        >
          {renderComparison()}
        </div>

        {/* Action buttons - white bg, below card */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleShare}
              className="flex-1 max-w-[140px] px-4 py-3 bg-white text-black rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
              disabled={isCapturing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              <span>{isCapturing ? '...' : 'Share'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 max-w-[140px] px-4 py-3 bg-white text-black rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
              disabled={isCapturing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download</span>
            </button>
          </div>
          <a
            href={`/bsc/${cryptoA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-white text-black rounded-xl font-semibold text-center hover:bg-gray-100 transition-colors"
          >
            View {cryptoAData?.symbol ?? 'PHT'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default PriceComparison;