import React from 'react';
import Link from 'next/link';
import { useFlashOnChange, formatPrice, formatCompactNumber, Token } from '@/lib/tokenFormatting';

interface TokenCardProps {
  token: Token;
  onRemove?: (address: string) => void;
  showDeleteBackground?: boolean;
  isDraggable?: boolean;
  onDragEnd?: (offset: number) => void;
}

/**
 * Reusable token card component for mobile view
 * Displays token information with animated flash effects on value changes
 * Optionally supports swipe-to-delete functionality for watchlist
 */
const TokenCard = React.memo(function TokenCard({
  token,
  onRemove,
  showDeleteBackground = false,
  isDraggable = false,
  onDragEnd,
}: TokenCardProps) {
  const priceFlash = useFlashOnChange(token.price);
  const changeFlash = useFlashOnChange(token.change24h ?? 'N/A');
  const mcFlash = useFlashOnChange(token.marketCap);
  const volFlash = useFlashOnChange(token.volume);
  const liqFlash = useFlashOnChange(token.liquidity);

  const { display, isExponential, zeros, rest } = formatPrice(token.price);
  const priceDisplay = display === 'N/A' ? (
    <span className="text-neutral-400">N/A</span>
  ) : isExponential ? (
    <>
      {display}0<sub>{zeros}</sub>
      {rest}
    </>
  ) : (
    display
  );

  const cardContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="relative flex-shrink-0">
          <img
            src={`/api/${token.chain}/logo/${token.address}`}
            alt={token.symbol}
            width={36}
            height={36}
            className="rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
          />
          <img
            src={`/${token.chain}-logo.png`}
            alt={token.chain}
            width={16}
            height={16}
            className="absolute -bottom-1 rounded-sm border-2 border-black"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-white font-bold text-lg whitespace-nowrap truncate">
            {token.symbol.toUpperCase()}
          </span>
          <span className="text-neutral-200 text-xs whitespace-nowrap truncate">{token.name}</span>
        </div>
      </div>

      <div className="flex flex-col ml-3 gap-2">
        <div className="flex flex-col items-end">
          <div className="flex flex-row items-center gap-2 text-right flex-shrink-0">
            <span
              className="text-white font-semibold text-md whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: priceFlash ? 0.4 : 1 }}
            >
              {priceDisplay}
            </span>
            {token.change24h !== 'N/A' && token.change24h !== undefined && (() => {
              const change = parseFloat(String(token.change24h));
              const isPositive = change >= 0;
              return (
                <span
                  className={`text-sm transition-opacity duration-300 ${isPositive ? 'text-green-500' : 'text-red-500'}`}
                  style={{ opacity: changeFlash ? 0.4 : 1 }}
                >
                  {isPositive ? '+' : ''}
                  {change.toFixed(2)}%
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex gap-2 justify-between">
          <div className="flex flex-row gap-1 items-center">
            <div className="text-orange-500 text-xs font-medium">VOL</div>
            <div
              className="text-white text-xs font-semibold transition-opacity duration-300"
              style={{ opacity: volFlash ? 0.4 : 1 }}
            >
              ${formatCompactNumber(token.volume)}
            </div>
          </div>
          <div className="flex flex-row gap-1 items-center">
            <div className="text-orange-500 text-xs font-medium">LIQ.</div>
            <div
              className="text-white text-xs font-semibold transition-opacity duration-300"
              style={{ opacity: liqFlash ? 0.4 : 1 }}
            >
              ${formatCompactNumber(token.liquidity)}
            </div>
          </div>
          <div className="flex flex-row gap-1 items-center">
            <div className="text-orange-500 text-xs font-medium">MC</div>
            <div
              className="text-white text-xs font-semibold transition-opacity duration-300"
              style={{ opacity: mcFlash ? 0.4 : 1 }}
            >
              ${formatCompactNumber(token.marketCap)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const link = (
    <Link
      href={`/${token.chain}/${token.address}`}
      className="rounded-lg p-2 hover:border-orange-500 border-b border-orange-500 transition-all hover:shadow-lg hover:shadow-orange-500/20 block"
    >
      {cardContent}
    </Link>
  );

  // If delete background is shown, wrap with delete UI
  if (showDeleteBackground && onRemove) {
    return link;
  }

  return link;
});

TokenCard.displayName = 'TokenCard';

export default TokenCard;
