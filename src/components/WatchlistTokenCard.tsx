'use client';

import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Token } from '@/lib/tokenFormatting';
import TokenCard from './TokenCard';

interface WatchlistTokenCardProps {
  token: Token;
  onRemove: (address: string) => void;
}

/**
 * Watchlist-specific wrapper that adds swipe-to-delete functionality to TokenCard
 * Reuses the same TokenCard component from the home page for consistency
 */
const WatchlistTokenCard = React.memo(function WatchlistTokenCard({
  token,
  onRemove,
}: WatchlistTokenCardProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      {/* Background Layer (Red/Delete) */}
      <div className="absolute inset-0 flex items-center justify-start pl-6 rounded-lg">
        <Trash2 className="text-white" size={24} />
      </div>

      {/* Sliding Card Layer */}
      <motion.div
        className="relative h-full w-full z-10"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
          // Swipe Right to Remove (positive x)
          if (info.offset.x > 100) {
            onRemove(token.address);
          }
        }}
        whileTap={{ cursor: 'grabbing' }}
        style={{ touchAction: 'none' }}
      >
        <TokenCard token={token} />
      </motion.div>
    </div>
  );
});

WatchlistTokenCard.displayName = 'WatchlistTokenCard';

export default WatchlistTokenCard;
