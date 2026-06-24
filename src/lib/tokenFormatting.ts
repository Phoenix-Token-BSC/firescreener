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
 * Intelligently handles decimals based on magnitude
 */
export function formatCompactNumber(value: number | string): string {
  if (typeof value === 'string') {
    value = parseFloat(value.replace(/[^0-9.-]+/g, ''));
  }

  if (isNaN(value) || value === 0) {
    return 'N/A';
  }

  const formatWithDecimals = (num: number, divisor: number, suffix: string): string => {
    const result = num / divisor;
    // Show 2 decimals if the result is < 10, otherwise 1 decimal
    const decimals = result < 10 ? 2 : 1;
    const formatted = result.toFixed(decimals);
    // Remove trailing zeros and decimal point if not needed
    return formatted.replace(/\.?0+$/, '') + suffix;
  };

  if (value >= 1e12) {
    return formatWithDecimals(value, 1e12, 'T');
  }
  if (value >= 1e9) {
    return formatWithDecimals(value, 1e9, 'B');
  }
  if (value >= 1e6) {
    return formatWithDecimals(value, 1e6, 'M');
  }
  if (value >= 1e3) {
    return formatWithDecimals(value, 1e3, 'K');
  }

  // For numbers less than 1000, show appropriate decimals
  if (value >= 100) {
    return value.toFixed(0);
  }
  if (value >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

/**
 * Format price with exponential notation handling for very small numbers
 * and compact notation for very large numbers
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

  // Handle very large numbers (6+ figures) with compact notation
  if (priceNum >= 1e6) {
    const formatLarge = (num: number, divisor: number, suffix: string): string => {
      const result = num / divisor;
      const decimals = result < 10 ? 2 : 1;
      const formatted = result.toFixed(decimals);
      return formatted.replace(/\.?0+$/, '') + suffix;
    };

    if (priceNum >= 1e12) {
      return {
        display: '$' + formatLarge(priceNum, 1e12, 'T'),
        isExponential: false,
      };
    }
    if (priceNum >= 1e9) {
      return {
        display: '$' + formatLarge(priceNum, 1e9, 'B'),
        isExponential: false,
      };
    }
    if (priceNum >= 1e6) {
      return {
        display: '$' + formatLarge(priceNum, 1e6, 'M'),
        isExponential: false,
      };
    }
  }

  // Force decimal notation to check for leading zeros (prevents scientific notation issues)
  const priceStr = priceNum.toFixed(20);

  // Check for very small numbers with many leading zeros (more than 3 zeros after decimal)
  if (priceStr.includes('.')) {
    const [, decimal] = priceStr.split('.');
    const leadingZeros = decimal.match(/^0+/);

    if (leadingZeros && leadingZeros[0].length > 3) {
      const zeros = leadingZeros[0].length;
      // Get only the first 6 significant digits after leading zeros
      const rest = decimal.substring(zeros).substring(0, 6);
      return {
        display: `0.`,
        isExponential: true,
        zeros,
        rest,
      };
    }

    // Standard number: show appropriate decimals based on price magnitude
    let displayPrice: string;
    if (priceNum >= 1000) {
      displayPrice = priceNum.toFixed(2).replace(/\.?0+$/, '').replace(/\.$/, '');
    } else if (priceNum >= 100) {
      displayPrice = priceNum.toFixed(2).replace(/\.?0+$/, '').replace(/\.$/, '');
    } else if (priceNum >= 1) {
      displayPrice = priceNum.toFixed(4).replace(/\.?0+$/, '').replace(/\.$/, '');
    } else {
      // Very small but not exponential
      displayPrice = priceNum.toFixed(8).replace(/\.?0+$/, '').replace(/\.$/, '');
    }

    return {
      display: displayPrice,
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
