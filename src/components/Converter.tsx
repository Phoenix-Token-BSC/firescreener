// components/Converter.tsx

import React, { useState, useEffect } from 'react';

interface CurrencyConverterProps {
  tokenSymbol: string;
  tokenAddress: string;
  tokenLogoUrl?: string;
  chain?: string; // e.g. 'bsc' | 'eth' | 'sol' | 'rwa' | ...
}

const CurrencyConverter: React.FC<CurrencyConverterProps> = ({
  tokenSymbol,
  tokenAddress,
  tokenLogoUrl,
  chain = 'bsc',
}) => {
  const [inputValue, setInputValue] = useState('1');
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'NATIVE'>('USD');
  const [outputValue, setOutputValue] = useState('0.000000000');
  const [rates, setRates] = useState<{ usd: number; native: number }>({ usd: 0, native: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chain-specific configuration
  const chainConfig: Record<string, { dexscreenerId: string; nativeSymbol: string }> = {
    bsc: { dexscreenerId: 'bsc', nativeSymbol: 'BNB' },
    eth: { dexscreenerId: 'ethereum', nativeSymbol: 'ETH' },
    sol: { dexscreenerId: 'solana', nativeSymbol: 'SOL' },
    // Add more chains as needed, e.g.:
    // base: { dexscreenerId: 'base', nativeSymbol: 'ETH' },
    // polygon: { dexscreenerId: 'polygon', nativeSymbol: 'MATIC' },
  };

  const isRwa = chain === 'rwa';
  const config = chainConfig[chain] || chainConfig.bsc; // fallback to BSC
  const nativeLabel = config.nativeSymbol;

  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      setError(null);
      setRates({ usd: 0, native: 0 });

      try {
       // console.log(`Fetching price → Token: ${tokenAddress} | Chain: ${chain}`);

        if (isRwa) {
          // Your internal API for RWA / AssetChain tokens
          const res = await fetch(`/api/rwa/token-price/${tokenAddress}`);
          if (!res.ok) {
            const text = await res.text();
            console.error('RWA API failed:', res.status, text);
            throw new Error(`RWA API error: ${res.status}`);
          }

          const data = await res.json();
       //   console.log('RWA API response:', data);

          const usdRate = Number(data.price) || 0;
          // No native rate for RWA
          setRates({ usd: usdRate, native: 0 });
          return;
        }

        // DexScreener for public chains
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
        );

        if (!res.ok) {
          const text = await res.text();
          console.error('DexScreener failed:', res.status, text);
          throw new Error(`DexScreener HTTP ${res.status}`);
        }

        const data = await res.json();
//console.log('DexScreener full response:', data);

        if (!data.pairs || data.pairs.length === 0) {
          throw new Error('No pairs found for this token');
        }

        // Filter pairs for **this exact chain**
        const targetChainId = config.dexscreenerId;
        const chainPairs = data.pairs.filter((p: any) => p.chainId === targetChainId);

        if (chainPairs.length === 0) {
          console.warn(`No pairs on chain "${targetChainId}"`);
          throw new Error(`No ${chain.toUpperCase()} pairs found`);
        }

        // Pick the pair with highest USD liquidity
        const bestPair = chainPairs.reduce((prev: any, curr: any) =>
          (curr.liquidity?.usd || 0) > (prev.liquidity?.usd || 0) ? curr : prev
        );

        const usdRate = Number(bestPair.priceUsd) || 0;
        const nativeRate = Number(bestPair.priceNative) || 0;

        // console.log('Selected pair:', {
        //   dex: bestPair.dexId,
        //   chainId: bestPair.chainId,
        //   usdPrice: usdRate,
        //   nativePrice: nativeRate,
        //   liquidityUsd: bestPair.liquidity?.usd,
        // });

        setRates({ usd: usdRate, native: nativeRate });
      } catch (err: any) {
        console.error('Price fetch error:', err);
        setError(err.message || 'Failed to load price');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, [tokenAddress, chain]);

  const calculateOutput = (input: string, currency: 'USD' | 'NATIVE') => {
    const num = parseFloat(input);
    if (isNaN(num) || num < 0) return '0.000000000';

    const rate = currency === 'USD' ? rates.usd : rates.native;
    if (rate <= 0) return '—';

    return (num * rate).toFixed(9);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setOutputValue(calculateOutput(val, selectedCurrency));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCur = e.target.value as 'USD' | 'NATIVE';
    setSelectedCurrency(newCur);
    setOutputValue(calculateOutput(inputValue, newCur));
  };

  const showNativeOption = !isRwa && rates.native > 0;

  return (
    <div className="mt-4 bg-neutral-900 text-white p-4 rounded-xl border-2 border-neutral-600 ">
      {/* Input (Token amount) */}
      <div className="flex items-center justify-between bg-gray-800 rounded-md p-3 mb-3">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="0.0"
          className="bg-transparent text-white text-xl w-2/3 focus:outline-none"
        />
        <div className="flex items-center bg-gray-700 px-3 py-1 rounded-md">
          {tokenLogoUrl && (
            <img
              src={tokenLogoUrl}
              alt={`${tokenSymbol} logo`}
              className="w-6 h-6 mr-2 rounded-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/file.svg';
                e.currentTarget.alt = 'Token';
              }}
            />
          )}
          <span className="font-medium">{tokenSymbol}</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center mb-3 text-2xl">↓</div>

      {/* Output (Converted value) */}
      <div className="flex items-center justify-between bg-gray-800 rounded-md p-3">
        <div className="text-xl font-medium">
          {loading
            ? 'Loading...'
            : error
            ? 'Error'
            : outputValue}
        </div>

        <select
          value={selectedCurrency}
          onChange={handleCurrencyChange}
          disabled={loading || !!error}
          className="bg-green-700 text-white px-4 py-2 rounded-md appearance-none focus:outline-none cursor-pointer"
        >
          <option value="USD">USD</option>
          {showNativeOption && (
            <option value="NATIVE">{nativeLabel}</option>
          )}
        </select>
      </div>

      {error && (
        <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
      )}
    </div>
  );
};

export default CurrencyConverter;