import React, { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect changes in a value and trigger a flash effect
 */
export function useFlashOnChange(value: string | number, flashDuration = 600) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), flashDuration);
      return () => clearTimeout(t);
    }
  }, [value, flashDuration]);

  return flashing;
}

/**
 * Format numbers in a compact way (1.2T, 500M, etc.)
 */
export function formatCompactNumber(value: number | string): string {
  if (typeof value === 'string') {
    value = parseFloat(value.replace(/[^0-9.-]+/g, ''));
  }

  if (isNaN(value) || value === 0) {
    return 'N/A';
  }

  if (value >= 1e12) {
    return (value / 1e12).toFixed(1) + 'T';
  }
  if (value >= 1e9) {
    return (value / 1e9).toFixed(1) + 'B';
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(1) + 'M';
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(0) + 'K';
  }
  return value.toFixed(1);
}

/**
 * Format price with exponential notation handling for very small numbers
 */
export function formatPrice(
  price: number | string
): { display: string; isExponential: boolean; zeros?: number; rest?: string } {
  // Handle N/A or invalid values
  if (price === 'N/A' || price === null || price === undefined || price === '') {
    return {
      display: 'N/A',
      isExponential: false,
    };
  }

  // Convert to number if it's a string
  let priceNum: number;
  if (typeof price === 'string') {
    // Remove any non-numeric characters except decimal point and minus sign
    const cleanedPrice = price.replace(/[^0-9.-]/g, '');
    priceNum = parseFloat(cleanedPrice);
  } else {
    priceNum = price;
  }

  // Check if conversion failed
  if (isNaN(priceNum)) {
    return {
      display: 'N/A',
      isExponential: false,
    };
  }

  // Force decimal notation to check for leading zeros (prevents scientific notation issues)
  const priceStr = priceNum.toFixed(20);

  // Check for very small numbers with many leading zeros (more than 4 zeros)
  if (priceStr.includes('.')) {
    const [, decimal] = priceStr.split('.');
    const leadingZeros = decimal.match(/^0+/);

    if (leadingZeros && leadingZeros[0].length > 4) {
      const zeros = leadingZeros[0].length;
      const rest = decimal.substring(zeros);
      return {
        display: `0.`,
        isExponential: true,
        zeros,
        rest,
      };
    }

    // Standard number, truncate to 8 decimals
    const truncated = priceNum.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
    return {
      display: truncated,
      isExponential: false,
    };
  }

  return {
    display: priceNum.toString(),
    isExponential: false,
  };
}

export interface Token {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string | number;
  marketCap: string | number;
  volume: string | number;
  liquidity: string | number;
  change24h?: string | number;
}
