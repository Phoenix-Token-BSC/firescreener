import { Suspense } from 'react';
import LoginFormContent from '@/components/LoginFormContent';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100dvh-3.25rem)] md:min-h-dvh flex items-center justify-center">Loading...</div>}>
      {/* On lg the row is exactly one viewport tall and each column scrolls on its
          own, so the tall preview panel can't drag the form below the fold.
          Below lg it collapses to normal document flow. */}
      <div className="flex flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
        <LoginFormContent />

        {/* Right Side - Preview (Hidden on Mobile) */}
       <div className="hidden lg:flex lg:flex-col w-1/2 lg:h-full lg:overflow-y-auto no-scrollbar bg-gradient-to-br from-orange-400 to-orange-500 p-12">
                {/* my-auto centres while there is room and collapses to 0 when there
                    isn't — unlike items-center, which makes overflow unreachable. */}
                <div className="max-w-xl w-full mx-auto my-auto space-y-6">
                  {/* Logo and Heading */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="bg-black rounded-lg flex items-center justify-center">
                        <Image src="/logo-fixed.png" alt='FireScreener logo' width={500} height={500} className='w-8 h-auto p-2' />
                      </div>
                      <span className="text-black text-2xl font-bold">FireScreener</span>
                    </div>
                    <h2 className="text-black text-4xl font-bold leading-tight">
                      Find new coins, Track every chart.
                    </h2>
                  </div>
      
                  <Image src="/images/markets-dashboard.png" alt="Tokens list page" width={500} height={500} className='rounded-2xl' />
      
                  {/* Chart Card */}
                  <div className="bg-gradient-to-br from-[#2d0a0a] to-[#4a0e0e] rounded-2xl p-5 shadow-xl">
                    <div className="text-orange-400 text-xl font-bold mb-2">Chart</div>
                    <div className="text-gray-400 text-xs mb-2">Phoenix Token / PHT</div>
                    <div className="text-orange-400 text-lg font-bold mb-4">$0.028900</div>
                    <svg className="w-full h-24" viewBox="0 0 300 100" preserveAspectRatio="none">
                      <polyline
                        points="0,60 30,50 60,55 90,40 120,45 150,35 180,30 210,50 240,40 270,45 300,35"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
      
                  {/* Portfolio Card */}
               <Image src="/images/portfolio-dashboard.png" alt="Tokens list page" width={500} height={500} className='rounded-2xl' />
      
                  </div>
                </div>
      </div>
    </Suspense>
  );
}
