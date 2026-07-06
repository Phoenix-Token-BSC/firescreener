'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Gift, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'fcfs' | 'ticket' | 'instant';
  icon: string;
  color: string;
}

interface RewardClaim {
  id: string;
  reward_id: string;
  cost_paid: number;
  wallet_address: string;
  claimed_at: string;
  rewards: Reward;
}

export default function RewardsClaimsWidget() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchClaims = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/user/rewards-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rewards claims');
        }

        const data = await response.json();
        setClaims(data.claims || []);
      } catch (err) {
        console.error('Fetch claims error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch claims');
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, [user?.id]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRewardTypeColor = (type: string) => {
    switch (type) {
      case 'fcfs':
        return 'text-orange-400';
      case 'ticket':
        return 'text-orange-400';
      case 'instant':
        return 'text-orange-400';
      default:
        return 'text-orange-400';
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case 'fcfs':
        return 'First Come, First Served';
      case 'ticket':
        return 'Raffle/Lottery';
      case 'instant':
        return 'Instant Reward';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="bg-orange-800 rounded-lg border border-neutral-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Gift size={24} className="text-orange-400" />
          <h3 className="text-2xl font-bold text-white">Your Rewards</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-orange-800 rounded-lg border border-neutral-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Gift size={24} className="text-orange-400" />
          <h3 className="text-2xl font-bold text-white">Your Rewards</h3>
        </div>
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-orange-500/10 rounded-lg border border-orange-400 p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          
          <h3 className="text-2xl font-bold text-white">My Rewards</h3>
        </div>
        
      </div>

      {claims.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">You haven't claimed any rewards yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-black/50 rounded-lg p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-3xl">{claim.rewards.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold">{claim.rewards.name}</h4>
                    <p className="text-gray-400 text-sm">{claim.rewards.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-xs font-medium ${getRewardTypeColor(claim.rewards.type)}`}>
                        {getRewardTypeLabel(claim.rewards.type)}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-orange-400">{claim.cost_paid} points</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ))}

          <div className="mt-6 pt-6 border-t border-neutral-600">
            <p className="text-sm text-gray-400 mb-3">Want to claim more rewards?</p>
            <Link
              href="/rewards"
              className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
            >
              Browse Rewards
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
