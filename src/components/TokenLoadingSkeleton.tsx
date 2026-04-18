import React from 'react';

interface TokenLoadingSkeletonProps {
  count?: number;
}

export default function TokenLoadingSkeleton({ count = 6 }: TokenLoadingSkeletonProps) {
  return (
    <>
      {/* Mobile: Card Layout Skeleton */}
      <div className="md:hidden flex flex-col gap-2">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg p-2 border-b border-orange-500/30 animate-pulse"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between">
              {/* Left: Token Icon and Info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Token Icon with Chain Badge */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 bg-neutral-700 rounded-md" />
                  <div className="w-4 h-4 bg-neutral-700 rounded-sm absolute -bottom-1 border-2 border-black" />
                </div>

                {/* Token Symbol and Name */}
                <div className="flex flex-col min-w-0 flex-1 gap-1">
                  <div className="w-16 h-5 bg-neutral-700 rounded" />
                  <div className="w-24 h-3 bg-neutral-700 rounded" />
                </div>
              </div>

              {/* Right: Price */}
              <div className="flex flex-col ml-3 gap-2">
                <div className="flex flex-col items-end gap-1">
                  <div className="w-20 h-5 bg-neutral-700 rounded" />
                  <div className="w-12 h-3 bg-neutral-700 rounded" />
                </div>

                {/* Metrics Row */}
                <div className="flex gap-2 justify-between">
                  {/* Volume */}
                  <div className="flex flex-col gap-1 items-center">
                    <div className="w-10 h-3 bg-neutral-700 rounded" />
                    <div className="w-14 h-3 bg-neutral-700 rounded" />
                  </div>

                  {/* Liquidity */}
                  <div className="flex flex-col gap-1 items-center">
                    <div className="w-12 h-3 bg-neutral-700 rounded" />
                    <div className="w-14 h-3 bg-neutral-700 rounded" />
                  </div>

                  {/* Market Cap */}
                  <div className="flex flex-col gap-1 items-center">
                    <div className="w-8 h-3 bg-neutral-700 rounded" />
                    <div className="w-14 h-3 bg-neutral-700 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table Layout Skeleton */}
      <div className="hidden md:block shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-orange-500">
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left sticky left-0 bg-orange-500 z-20 min-w-[150px]">
                  Token
                </th>
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                  Price
                </th>
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                  24H Change
                </th>
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                  Market Cap
                </th>
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                  Liquidity
                </th>
                <th className="text-md font-semibold text-white uppercase tracking-wider px-5 py-3 text-left min-w-[120px]">
                  24H Volume
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: count }).map((_, idx) => (
                <tr key={idx} className="border-b border-orange-500/30 animate-pulse">
                  {/* Token column - sticky on mobile */}
                  <td className="px-5 py-2 text-sm sticky left-0 z-10 min-w-[150px] bg-neutral-900">
                    <div className="flex items-center gap-3">
                      {/* Token Icon with Chain Badge */}
                      <div className="relative flex-shrink-0">
                        <div className="w-6 h-6 bg-neutral-700 rounded-full" />
                        <div className="w-3 h-3 bg-neutral-700 rounded-sm absolute -bottom-1 -right-1 border-2 border-black" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="w-12 h-4 bg-neutral-700 rounded" />
                        <div className="w-20 h-3 bg-neutral-700 rounded" />
                      </div>
                    </div>
                  </td>

                  {/* Price column */}
                  <td className="px-5 py-2 text-sm min-w-[120px]">
                    <div className="w-16 h-4 bg-neutral-700 rounded" />
                  </td>

                  {/* 24h Change column */}
                  <td className="px-5 py-2 text-xs min-w-[120px]">
                    <div className="w-12 h-4 bg-neutral-700 rounded" />
                  </td>

                  {/* Market Cap column */}
                  <td className="px-5 py-2 text-sm min-w-[120px]">
                    <div className="w-16 h-4 bg-neutral-700 rounded" />
                  </td>

                  {/* Liquidity column */}
                  <td className="px-5 py-2 text-sm min-w-[120px]">
                    <div className="w-16 h-4 bg-neutral-700 rounded" />
                  </td>

                  {/* Volume column */}
                  <td className="px-5 py-2 text-sm min-w-[120px]">
                    <div className="w-16 h-4 bg-neutral-700 rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
