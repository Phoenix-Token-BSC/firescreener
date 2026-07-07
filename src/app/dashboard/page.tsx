'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBlazeClaim } from '@/hooks/useBlazeClaim';
import { useState } from 'react';
import { Settings, LogOut, User, Lock, Bell, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import RewardsClaimsWidget from '@/components/RewardsClaimsWidget';
import LoadingWithLogo from '@/components/LoadingWithLogo';

export default function DashboardPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const { balance, loading } = useBlazeClaim(user?.id);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const totalBlazePoints = balance.totalBlaze;

  if (!isAuthenticated || !user) {
    return <LoadingWithLogo />;
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto">
        {/* Header with Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl text-white mb-2">
            <span>Welcome back, </span>
            <span className="font-bold">{user.username}! 🔥</span>
          </h1>
          <p className="text-gray-400">Manage your account and track your rewards</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-orange-500/10 rounded-lg border border-orange-500 overflow-hidden sticky top-8">
              <div className="p-4 border-b border-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">B</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{user.username}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                  </div>
                </div>
              </div>

              <nav className="p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === 'overview'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  <TrendingUp size={18} />
                  <span className="font-medium">Overview</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === 'settings'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  <Settings size={18} />
                  <span className="font-medium">Settings</span>
                </button>

                <hr className="border-white my-2" />

                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-neutral-700 transition-all"
                >
                  <span className="font-medium text-sm">← Back to Home</span>
                </Link>

                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <LogOut size={18} />
                  <span className="font-medium">Logout</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' ? (
              <div className="space-y-6">
                {/* Total Blaze Points Card */}
                <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg border border-orange-400/50 p-8 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>

                  <div className="relative z-10">
                    <p className="text-white/80 text-sm font-medium mb-2">Total BLAZE Points Earned</p>
                    {loading ? (
                      <div className="animate-pulse">
                        <div className="h-12 bg-white/20 rounded w-1/3 mb-2"></div>
                      </div>
                    ) : (
                      <h2 className="text-5xl font-bold text-white mb-2">{totalBlazePoints.toLocaleString()}</h2>
                    )}
                    <p className="text-white/80 text-lg">Redeemable for tokens & rewards</p>
                  </div>
                </div>


                {/* Rewards Component */}
                <RewardsClaimsWidget />
              </div>
            ) : (
              /* Settings Tab */
              <div className="space-y-6">
                <div className="bg-orange-500/10 rounded-lg border border-orange-500 p-8">
                  <h3 className="text-2xl font-bold text-white mb-6">Account Settings</h3>

                  <div className="space-y-6">
                    {/* Profile Section */}
                    <div className="pb-6 border-b border-neutral-700">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-white mb-2">Profile Information</h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-gray-400 text-sm">Username</p>
                              <p className="text-white font-medium">{user.username}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-sm">Email</p>
                              <p className="text-white font-medium">{user.email}</p>
                            </div>
                        
                          </div>
                        </div>
                
                      </div>
                      <button className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm">
                          Edit
                        </button>
                    </div>

                    {/* Security Section */}
                    <div className="">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-white mb-2">Security</h4>
                          <p className="text-gray-400 text-sm mb-4">Manage your password and security settings</p>
                          <button className="px-4 py-2 border border-neutral-600 hover:border-neutral-500 text-gray-400 hover:text-white rounded-lg transition-colors text-sm">
                            Change Password
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8">
                  <h3 className="text-lg font-bold text-red-400 mb-4">Danger Zone</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    These actions cannot be undone. Please be careful.
                  </p>
                  <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-colors text-sm">
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
