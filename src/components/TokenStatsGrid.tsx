"use client";

import React from 'react';
import LiquidityLocker from './LiquidityLocker';
import styles from "@/app/[chain]/styles.module.css";

interface TokenStatsGridProps {
    chain: string | null;
    contractAddress: string | null;
    price: string | number;
    marketCap: string | number;
    fdv: string | number;
    liquidity: string | number;
    holdersCount: string | number;
    tokenSymbol: string;
    nativePriceUSD: number | null;
    nativeSymbol: string;
}

function formatPrice(price: string | number): { display: string; isExponential: boolean } {
    try {
        if (price === null || price === undefined || price === 'N/A')
            return { display: 'N/A', isExponential: false };
        const num = parseFloat(price.toString());
        if (isNaN(num)) return { display: 'N/A', isExponential: false };

        const strNum = num.toFixed(12);
        const [integerPart, decimalPart = '0'] = strNum.split('.');

        let leadingZeros = 0;
        let significantDigitsStart = 0;
        for (let i = 0; i < decimalPart.length; i++) {
            if (decimalPart[i] === '0') {
                leadingZeros++;
            } else {
                significantDigitsStart = i;
                break;
            }
        }

        if (leadingZeros > 4 && integerPart === '0') {
            const significantDigits = decimalPart.slice(significantDigitsStart).replace(/0+$/, '');
            return { display: `0.0 ${leadingZeros} ${significantDigits}`, isExponential: true };
        }

        const maxDecimals = Math.abs(num) < 1 ? 6 : 5;
        const formatted = num
            .toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: maxDecimals,
                useGrouping: Math.abs(num) >= 1000,
            })
            .replace(/\.?0+$/, '');
        return { display: formatted, isExponential: false };
    } catch {
        return { display: 'N/A', isExponential: false };
    }
}

function formatLargeNumber(value: string | number, defaultValue = 'N/A'): string {
    try {
        if (value === null || value === undefined || value === '') return defaultValue;
        const num = parseFloat(value.toString());
        if (isNaN(num)) return defaultValue;
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short',
            minimumFractionDigits: 0,
            maximumFractionDigits: num >= 1_000_000 ? 1 : 0,
        }).format(num);
    } catch {
        return defaultValue;
    }
}

function formatWholeNumber(number: string | number): string {
    try {
        if (number === null || number === undefined || number === '') return '0';
        const num = parseFloat(number.toString());
        if (isNaN(num)) return '0';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            useGrouping: true,
        }).format(num);
    } catch {
        return '0';
    }
}

const TokenStatsGrid: React.FC<TokenStatsGridProps> = ({
    chain,
    contractAddress,
    price,
    marketCap,
    fdv,
    liquidity,
    holdersCount,
    tokenSymbol,
    nativePriceUSD,
    nativeSymbol,
}) => {
    const priceNum = parseFloat(price?.toString() ?? '0');

    // token_price_usd / native_token_price_usd = price expressed in native token
    const nativeAmount =
        nativePriceUSD && priceNum && !isNaN(priceNum)
            ? priceNum / nativePriceUSD
            : null;

    const { display: priceDisplay, isExponential } = formatPrice(price);
    const [pfx, exp, val] = isExponential ? priceDisplay.split(' ') : [];

    const {
        display: nativeDisplay,
        isExponential: nativeIsExponential,
    } = nativeAmount !== null ? formatPrice(nativeAmount) : { display: 'N/A', isExponential: false };
    const [npfx, nexp, nval] = nativeIsExponential ? nativeDisplay.split(' ') : [];

    const renderFormattedValue = (
        display: string,
        isExp: boolean,
        pfxV: string,
        expV: string,
        valV: string
    ) =>
        isExp ? (
            <>
                {pfxV}
                <sup className={styles.superscript}>{expV}</sup>
                {''}{valV}
            </>
        ) : (
            display
        );

    const renderPriceValue = () => renderFormattedValue(priceDisplay, isExponential, pfx, exp, val);
    const renderNativeValue = () => renderFormattedValue(nativeDisplay, nativeIsExponential, npfx, nexp, nval);

    const nativeLabel = nativeSymbol || chain?.toUpperCase() || '';

    return (
        <>
            {/* Mobile */}
            <div className="md:hidden">
                <div className="flex flex-row items-center justify-between mb-4 p-3 border-2 border-orange-500 rounded-xl">
                    <div className="flex flex-col rounded-md">
                        <p>Price in USD:</p>
                        <h1 className="font-bold text-xl">$ {renderPriceValue()}</h1>
                    </div>
                    <div className="w-px self-stretch bg-orange-500 mx-2 border border-orange-500" />
                    <div className="text-right">
                        <h1 className="text-sm">Price in {nativeLabel}:</h1>
                        <h1 className="font-bold text-xl">
                            {renderNativeValue()} {nativeSymbol}
                        </h1>
                    </div>
                    
                </div>


                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">MARKETCAP</h1>
                        <h1 className="font-bold text-lg">${formatLargeNumber(marketCap)}</h1>
                    </div>
                    <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">FDV</h1>
                        <h1 className="font-bold text-lg">${formatLargeNumber(fdv)}</h1>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                        <h1 className="text-xs uppercase font-semibold text-white/80">Liquidity</h1>
                        <div className="flex flex-row items-center justify-center gap-2">
                            <h1 className="font-bold text-lg">${formatLargeNumber(liquidity)}</h1>
                            <LiquidityLocker chain={chain} contractAddress={contractAddress} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center bg-orange-600 rounded-md p-4">
                        <h1 className="text-sm">HOLDERS</h1>
                        <h1 className="font-bold text-lg">{formatWholeNumber(holdersCount)}</h1>
                    </div>
                </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:grid grid-cols-6 gap-2 items-stretch mb-4">
                <div className="flex flex-col items-start justify-center rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">{tokenSymbol} PRICE</h1>
                    <h1 className="font-bold text-xl leading-tight">${' '}{renderPriceValue()}</h1>
                </div>
                <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">Marketcap</h1>
                    <h1 className="font-bold text-base">${formatLargeNumber(marketCap)}</h1>
                </div>
                <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">FDV</h1>
                    <h1 className="font-bold text-base">${formatLargeNumber(fdv)}</h1>
                </div>
                <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">Liquidity</h1>
                    <div className="flex flex-row items-center justify-center gap-1">
                        <h1 className="font-bold text-base">${formatLargeNumber(liquidity)}</h1>
                        <LiquidityLocker chain={chain} contractAddress={contractAddress} />
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">
                        In {nativeLabel}
                    </h1>
                    <h1 className="font-bold text-base">
                        {renderNativeValue()}{' '}
                        <span className="text-xs font-normal">{nativeSymbol}</span>
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center bg-orange-600 rounded-md p-3 h-full">
                    <h1 className="text-xs uppercase font-semibold text-white/80">Holders</h1>
                    <h1 className="font-bold text-base">{formatWholeNumber(holdersCount)}</h1>
                </div>
            </div>
        </>
    );
};

export default TokenStatsGrid;
