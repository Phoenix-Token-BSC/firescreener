'use client';

import { useAdmin } from '@/contexts/AdminContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  status: string;
  created_at: string;
  auth_users: {
    username: string;
    email: string;
  };
  rewards: {
    name: string;
    type: string;
  };
}

export default function AdminRedemptionsPage() {
  const router = useRouter();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      router.push('/admin/login');
    }
  }, [isAdmin, adminLoading, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (!isAdmin) return;
    fetchRedemptions();
  }, [isAdmin, offset]);

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      const response = await adminFetch(`/api/admin/redemptions?limit=${limit}&offset=${offset}`);

      if (!response.ok) throw new Error('Failed to fetch redemptions');

      const data = await response.json();
      setRedemptions(data.redemptions || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching redemptions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Redemptions</h1>
          <p className="text-gray-400">View and track user reward redemptions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total Redemptions</p>
            <p className="text-3xl font-bold text-white">{total}</p>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Showing</p>
            <p className="text-3xl font-bold text-white">{redemptions.length}</p>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Page</p>
            <p className="text-3xl font-bold text-white">{Math.floor(offset / limit) + 1}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
              <p className="text-gray-400">Loading redemptions...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-800 border-b border-neutral-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">User</th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">Email</th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">Reward</th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">Type</th>
                      <th className="px-6 py-3 text-left text-gray-300 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {redemptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                          No redemptions yet
                        </td>
                      </tr>
                    ) : (
                      redemptions.map((redemption) => (
                        <tr key={redemption.id} className="hover:bg-neutral-700/30 transition-colors">
                          <td className="px-6 py-4 text-white font-medium">{redemption.auth_users?.username}</td>
                          <td className="px-6 py-4 text-gray-400">{redemption.auth_users?.email}</td>
                          <td className="px-6 py-4 text-white">{redemption.rewards?.name}</td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-neutral-700/50 text-gray-300">
                              {redemption.rewards?.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {new Date(redemption.created_at).toLocaleDateString()} at{' '}
                            {new Date(redemption.created_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-gray-400">
                  {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
                </span>

                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
