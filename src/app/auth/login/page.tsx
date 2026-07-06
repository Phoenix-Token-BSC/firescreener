import { Suspense } from 'react';
import LoginFormContent from '@/components/LoginFormContent';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <div className="min-h-screen flex">
        <LoginFormContent />

        {/* Right Side - Preview (Hidden on Mobile) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-orange-400 to-orange-500 p-12 items-center justify-center">
          <div className="max-w-xl w-full space-y-6">
            {/* Logo and Heading */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🔥</span>
                </div>
                <span className="text-white text-2xl font-bold">FireScreener</span>
              </div>
              <h2 className="text-white text-4xl font-bold leading-tight">
                Find new coins, Track every chart.
              </h2>
            </div>

            {/* Token Card */}
            <div className="bg-white rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-orange-500 text-xl font-bold">P</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Phoenix Token</div>
                  <div className="text-xs text-gray-500">PHT</div>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">$0.025900</div>
                  <div className="text-green-500 text-sm font-medium">+0.25%</div>
                </div>
                <svg className="w-24 h-12" viewBox="0 0 100 50" preserveAspectRatio="none">
                  <polyline
                    points="0,40 20,35 40,25 60,30 80,20 100,25"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

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
            <div className="bg-white rounded-2xl p-5 shadow-xl">
              <div className="font-bold text-gray-900 text-xl mb-4">My Portfolio</div>

              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <span className="text-orange-500 text-xl font-bold">P</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Phoenix Token</div>
                    <div className="text-sm text-gray-600">$2,590.45</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-500 text-sm font-medium">+5.76%</div>
                  <div className="text-sm text-gray-600">100,000 PHT</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xl">🐱</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">WikiCat Coin</div>
                    <div className="text-sm text-gray-600">$1,870.00</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-500 text-sm font-medium">+2.56%</div>
                  <div className="text-xs text-gray-600">20,000,000,000 WKC</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
