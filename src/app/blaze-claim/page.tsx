'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBlazeClaim } from '@/hooks/useBlazeClaim';
import { useState } from 'react';
import { Clock, Zap, AlertCircle, Flame } from 'lucide-react';
import Link from 'next/link';
import LoadingWithLogo from '@/components/LoadingWithLogo';

export default function BlazeClaimPage() {
  const { user, isAuthenticated } = useAuth();
  const { loading, claiming, error, balance, streak, claim } = useBlazeClaim(user?.id);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimAmount] = useState(10);

  // Mock data for initial render
  const displayStreak = streak.data.length > 0 ? streak : {
    data: [
      { dayNumber: 1, date: 'Today', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 2, date: 'Tomorrow', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 3, date: 'Day 3', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 4, date: 'Day 4', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 5, date: 'Day 5', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 6, date: 'Day 6', claimed: false, amount: 10, claimedAt: null },
      { dayNumber: 7, date: 'Day 7', claimed: false, amount: 10, claimedAt: null },
    ],
    claimedDays: 0,
    totalDays: 7,
    currentStreakDay: 1,
    canClaim: true,
    timeUntilNextClaim: '',
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!loading && streak.data.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Failed to load your rewards</p>
              <p className="text-gray-500 text-sm">{error || 'Please try refreshing the page'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleClaim = async () => {
    const result = await claim();
    if (result?.success) {
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 5000);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className=" mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Daily Rewards 🔥</h1>
            <p className="text-gray-400">Claim your daily BLAZE points</p>
          </div>
        </div>

      

        {/* Main Claim Section */}
        {loading ? (
          <LoadingWithLogo />
        ) : (
          <>
            <div className="mb-8">
              

              {/* 7 Day Grid Calendar */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-white mb-4">This Week's Streak</h3>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {displayStreak.data.map((day) => {
                    const isActiveDay = day.dayNumber === displayStreak.currentStreakDay && displayStreak.canClaim && !day.claimed;
                    const isClaimed = day.claimed;

                    return (
                      <button
                        key={day.dayNumber}
                        onClick={() => isActiveDay && !claiming && handleClaim()}
                        disabled={!isActiveDay || claiming}
                        className={`h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all transform ${
                          isActiveDay && !claiming ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-not-allowed'
                        } ${
                          isClaimed
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400/50 shadow-lg'
                            : isActiveDay
                            ? 'bg-gradient-to-br from-orange-600 via-orange-500 to-red-600 border-orange-400/50 shadow-lg hover:shadow-xl'
                            : 'bg-neutral-800 border-neutral-600/50'
                        }`}
                      >
                        <p className={`text-xs font-medium ${isClaimed ? 'text-white/90' : isActiveDay ? 'text-white/90' : 'text-gray-400'}`}>
                          Day {day.dayNumber}
                        </p>
                        {isClaimed ? (
                          <>
                            <p className="text-2xl">✓</p>
                            <p className="text-xs font-bold text-white">{day.amount}</p>
                          </>
                        ) : isActiveDay ? (
                          <>
                            <p className="text-2xl animate-bounce">🔥</p>
                            <p className="text-xs text-white font-semibold">Claim</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xl opacity-30">🔥</p>
                            <p className="text-xs text-gray-500">Locked</p>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cooldown Message */}
              {!displayStreak.canClaim && (
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-2xl border border-neutral-700/50 p-8 mb-8">
                  <div className="flex items-center justify-center gap-3 text-white/90 text-sm font-medium mb-4">
                    <Clock size={24} className="text-orange-400" />
                    <span>Next claim in: <span className="font-bold text-2xl text-orange-400">{displayStreak.timeUntilNextClaim}</span></span>
                  </div>
                  <p className="text-center text-gray-400">You've already claimed today. Come back tomorrow!</p>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2"></div>
                <div className="space-y-4">
                {/* Total Claimed */}
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 p-6 hover:border-neutral-600 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-400 text-sm font-medium">POINTS EARNED</p>
                    <Zap size={20} className="text-orange-400" />
                  </div>
                  <p className="text-3xl font-bold text-orange-400">{balance.totalBlaze.toLocaleString()}</p>
                  <p className="text-gray-500 text-xs mt-2">All-time total</p>
                </div>

                {/* Streak */}
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 p-6 hover:border-neutral-600 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-400 text-sm font-medium">CURRENT STREAK</p>
                    <Flame size={20} className="text-orange-400" />
                  </div>
                  <p className="text-3xl font-bold text-orange-400">{displayStreak.claimedDays}/{displayStreak.totalDays}</p>
                  <p className="text-gray-500 text-xs mt-2">Days claimed this week</p>
                </div>

                {/* Last Claim */}
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 p-6 hover:border-neutral-600 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-400 text-sm font-medium">LAST CLAIM</p>
                    <Clock size={20} className="text-orange-400" />
                  </div>
                  {balance.lastClaimAt ? (
                    <>
                      <p className="text-orange-400 font-semibold text-sm">{new Date(balance.lastClaimAt).toLocaleTimeString()}</p>
                      <p className="text-gray-500 text-xs mt-2">{new Date(balance.lastClaimAt).toLocaleDateString()}</p>
                    </>
                  ) : (
                    <p className="text-gray-400 text-sm">Never claimed</p>
                  )}
                </div>
              </div>
            </div>
            </div>


            {/* Info Box */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-8">
              <div className="flex gap-4">
                <div className="text-3xl">🎁</div>
                <div>
                  <h4 className="text-orange-400 font-semibold mb-3 text-lg">About BLAZE Points</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold mt-0.5">•</span>
                      <span>Earn <strong>10 BLAZE points</strong> every day when you claim</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold mt-0.5">•</span>
                      <span>You can claim once every <strong>24 hours</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold mt-0.5">•</span>
                      <span>Build your <strong>7-day streak</strong> for bonus rewards</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 font-bold mt-0.5">•</span>
                      <span><strong>Coming Soon:</strong> Convert BLAZE points to tokens or redeem exclusive rewards</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
