'use client';

import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { BarChart3, Gift, TrendingUp, Users, AlertCircle, Zap } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import Link from 'next/link';

interface AnalyticsData {
  summary: {
    totalUsers: number;
    newSignups: number;
    totalRewards: number;
    totalRedemptions: number;
    totalPointsSpent: number;
    totalPointsClaimed: number;
    averagePointsPerRedemption: number;
  };
  topRewards: Array<{
    name: string;
    icon: string;
    count: number;
  }>;
  redemptionsByType: {
    fcfs: number;
    ticket: number;
    instant: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only redirect if we've finished loading and user is not admin
    if (!adminLoading && !isAdmin) {
      console.log('Not admin, redirecting to login');
      router.push('/admin/login');
    }
  }, [isAdmin, adminLoading, router]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await adminFetch('/api/admin/analytics?days=30');

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [isAdmin, adminLoading]);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Panel 🛡️</h1>
          <p className="text-gray-400">Manage rewards, track redemptions, and view analytics</p>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/admin/rewards"
            className="p-4 bg-gradient-to-br from-orange-600/20 to-orange-500/10 border border-orange-500/30 rounded-lg hover:border-orange-500/60 transition-colors"
          >
            <Gift size={24} className="text-orange-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Manage Rewards</h3>
            <p className="text-sm text-gray-400">Create, edit, delete rewards</p>
          </Link>

          <Link
            href="/admin/redemptions"
            className="p-4 bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30 rounded-lg hover:border-blue-500/60 transition-colors"
          >
            <TrendingUp size={24} className="text-blue-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Redemptions</h3>
            <p className="text-sm text-gray-400">View user redemptions</p>
          </Link>

          <Link
            href="/admin/users"
            className="p-4 bg-gradient-to-br from-purple-600/20 to-purple-500/10 border border-purple-500/30 rounded-lg hover:border-purple-500/60 transition-colors"
          >
            <Users size={24} className="text-purple-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">User Management</h3>
            <p className="text-sm text-gray-400">Manage users and roles</p>
          </Link>

          <Link
            href="/admin/settings"
            className="p-4 bg-gradient-to-br from-green-600/20 to-green-500/10 border border-green-500/30 rounded-lg hover:border-green-500/60 transition-colors"
          >
            <BarChart3 size={24} className="text-green-400 mb-2" />
            <h3 className="font-semibold text-white mb-1">Settings</h3>
            <p className="text-sm text-gray-400">Configure admin settings</p>
          </Link>
        </div>

        {/* Analytics Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Analytics (Last 30 Days)</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-400">Loading analytics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          ) : analytics ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Total Users */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Total Users</p>
                  <Users size={20} className="text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {analytics.summary.totalUsers.toLocaleString()}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  +{analytics.summary.newSignups} signups last 30 days
                </p>
              </div>

              {/* Total Points Claimed */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Total Points Claimed</p>
                  <Zap size={20} className="text-yellow-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {analytics.summary.totalPointsClaimed.toLocaleString()}
                </p>
                <p className="text-gray-500 text-xs mt-2">All time BLAZE earned</p>
              </div>

              {/* Total Rewards */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Total Rewards</p>
                  <Gift size={20} className="text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-white">{analytics.summary.totalRewards}</p>
                <p className="text-gray-500 text-xs mt-2">Active rewards</p>
              </div>

              {/* Total Redemptions */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Total Redemptions</p>
                  <TrendingUp size={20} className="text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white">{analytics.summary.totalRedemptions}</p>
                <p className="text-gray-500 text-xs mt-2">Last 30 days</p>
              </div>

              {/* Total Points Spent */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Total Points Spent</p>
                  <Zap size={20} className="text-yellow-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {analytics.summary.totalPointsSpent.toLocaleString()}
                </p>
                <p className="text-gray-500 text-xs mt-2">Last 30 days</p>
              </div>

              {/* Average Points Per Redemption */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-400 text-sm font-medium">Avg Points/Redemption</p>
                  <BarChart3 size={20} className="text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {analytics.summary.averagePointsPerRedemption}
                </p>
                <p className="text-gray-500 text-xs mt-2">Average per redemption</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Rewards */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Top Rewards</h3>
                <div className="space-y-3">
                  {analytics.topRewards.length > 0 ? (
                    analytics.topRewards.map((reward, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-neutral-700/50 rounded">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{reward.icon}</span>
                          <div>
                            <p className="font-semibold text-white text-sm">{reward.name}</p>
                          </div>
                        </div>
                        <span className="font-bold text-orange-400">{reward.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-sm">No redemptions yet</p>
                  )}
                </div>
              </div>

              {/* Redemptions by Type */}
              <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Redemptions by Type</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-neutral-700/50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">FCFS</span>
                      <span className="text-orange-400 font-bold">{analytics.redemptionsByType.fcfs}</span>
                    </div>
                    <div className="w-full bg-neutral-600 rounded-full h-2">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{
                          width: `${
                            analytics.summary.totalRedemptions > 0
                              ? (analytics.redemptionsByType.fcfs / analytics.summary.totalRedemptions) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-700/50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Tickets</span>
                      <span className="text-blue-400 font-bold">{analytics.redemptionsByType.ticket}</span>
                    </div>
                    <div className="w-full bg-neutral-600 rounded-full h-2">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${
                            analytics.summary.totalRedemptions > 0
                              ? (analytics.redemptionsByType.ticket / analytics.summary.totalRedemptions) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-3 bg-neutral-700/50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">Instant</span>
                      <span className="text-green-400 font-bold">{analytics.redemptionsByType.instant}</span>
                    </div>
                    <div className="w-full bg-neutral-600 rounded-full h-2">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${
                            analytics.summary.totalRedemptions > 0
                              ? (analytics.redemptionsByType.instant / analytics.summary.totalRedemptions) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
