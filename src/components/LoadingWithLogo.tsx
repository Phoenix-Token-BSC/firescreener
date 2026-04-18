import React from 'react';
import Image from 'next/image';

interface LoadingWithLogoProps {
  tokenSymbol?: string;
}

export default function LoadingWithLogo({ tokenSymbol }: LoadingWithLogoProps) {
  return (
    <div className="flex flex-col items-center justify-center mt-8">
      <div className="text-center">
        {/* Spinning FireScreener Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-20 h-20">
            <div className="animate-ping absolute inset-0">
              <Image
                src="/logo-fixed.png"
                alt="FireScreener Loading"
                width={80}
                height={80}
                className="w-60 h-auto"
                priority
              />
            </div>
          </div>
        </div>
        
        {/* Loading Text */}
        {/* <h1 className="text-xl font-semibold text-white">
          Loading{tokenSymbol && ` ${tokenSymbol.toUpperCase()}`}...
        </h1>
        <p className="text-gray-400 text-sm mt-2">Please wait</p> */}
      </div>
    </div>
  );
}
