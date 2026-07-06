'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBlazeClaim } from '@/hooks/useBlazeClaim';
import { useState, useEffect } from 'react';
import { Zap, Gift, Flame, Lock } from 'lucide-react';
import Link from 'next/link';
import LoadingWithLogo from '@/components/LoadingWithLogo';

interface Reward {
  id: string;
  name: string;
  description: string;
  type: 'fcfs' | 'ticket' | 'instant';
  cost: number;
  stock?: number;
  claimed?: number;
  icon: string;
  color: 'orange' | 'purple' | 'blue' | 'green';
  badge?: string;
}

const REWARD_TYPE_LABELS = {
  fcfs: 'First Come, First Served',
  ticket: 'Raffle/Lottery Ticket',
  instant: 'Instant Reward',
};

const REWARD_COLORS = {
  orange: 'from-orange-600 to-orange-500',
  purple: 'from-purple-600 to-purple-500',
  blue: 'from-blue-600 to-blue-500',
  green: 'from-green-600 to-green-500',
};

function RewardCard({ reward, userBalance, isRedeeming, hasClaimed, onRedeem }: { reward: Reward; userBalance: number; isRedeeming: boolean; hasClaimed: boolean; onRedeem: (reward: Reward) => void }) {
  const canAfford = userBalance >= reward.cost;
  const isOutOfStock = reward.type === 'fcfs' && reward.stock && reward.claimed && reward.claimed >= reward.stock;
  const isClaimable = !hasClaimed && canAfford && !isOutOfStock && !isRedeeming;

  const stockPercentage = reward.stock && reward.claimed ? (reward.claimed / reward.stock) * 100 : 0;

  return (
    <div className={`relative rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
      isClaimable
        ? 'border-neutral-700/50 hover:border-orange-500/30 bg-neutral-800/50 hover:bg-neutral-800'
        : 'border-neutral-700/30 bg-neutral-900/30 opacity-60'
    }`}>
      {/* Header with background gradient */}
      <div className={`h-24 bg-gradient-to-br ${REWARD_COLORS[reward.color]} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-20 bg-grid-pattern"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl">{reward.icon}</span>
        </div>

        {/* Badge */}
        {reward.badge && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {reward.badge}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-white mb-1 text-lg">{reward.name}</h3>
        <p className="text-gray-400 text-sm mb-4">{reward.description}</p>

        {/* Type badge */}
        <div className="inline-block bg-neutral-700/50 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-full mb-4">
          {REWARD_TYPE_LABELS[reward.type]}
        </div>

        {/* Stock bar for FCFS */}
        {reward.type === 'fcfs' && reward.stock && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-400">Stock Available</span>
              <span className="text-xs font-semibold text-orange-400">{reward.stock - (reward.claimed || 0)}/{reward.stock}</span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Cost section */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-700/50">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-orange-400" />
            <span className="font-bold text-white text-lg">{reward.cost}</span>
            <span className="text-gray-400 text-sm">Points</span>
          </div>

          <button
            onClick={() => onRedeem(reward)}
            disabled={!isClaimable}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all transform ${
              isClaimable
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/50 active:scale-95 cursor-pointer'
                : hasClaimed
                ? 'bg-green-500/20 border border-green-500/50 text-green-400 cursor-default'
                : 'bg-neutral-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isRedeeming ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
                Redeeming...
              </>
            ) : hasClaimed ? (
              <>
                ✓ Claimed
              </>
            ) : isOutOfStock ? (
              <>
                <Lock size={14} className="inline mr-1" />
                Sold Out
              </>
            ) : !canAfford ? (
              <>
                <Lock size={14} className="inline mr-1" />
                Locked
              </>
            ) : (
              'Redeem'
            )}
          </button>
        </div>

        {!canAfford && (
          <p className="text-red-400 text-xs mt-2">
            Need {reward.cost - userBalance} more points
          </p>
        )}
      </div>
    </div>
  );
}

export default function RewardsPage() {
  const { user, isAuthenticated } = useAuth();
  const { loading, balance, loading: balanceLoading } = useBlazeClaim(user?.id);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [userClaimedIds, setUserClaimedIds] = useState<string[]>([]);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [pendingReward, setPendingReward] = useState<Reward | null>(null);

  // Fetch rewards on mount
  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setLoadingRewards(true);
        setRewardsError(null);
        const response = await fetch('/api/rewards');

        if (!response.ok) {
          throw new Error('Failed to fetch rewards');
        }

        const data = await response.json();
        setRewards(data.rewards || []);
      } catch (err) {
        console.error('Fetch rewards error:', err);
        setRewardsError(err instanceof Error ? err.message : 'Failed to fetch rewards');
      } finally {
        setLoadingRewards(false);
      }
    };

    fetchRewards();
  }, []);

  // Fetch user's claimed rewards
  useEffect(() => {
    if (!user?.id) return;

    const fetchUserClaims = async () => {
      try {
        const response = await fetch('/api/rewards/user-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (response.ok) {
          const data = await response.json();
          setUserClaimedIds(data.claimedRewardIds || []);
        }
      } catch (err) {
        console.error('Fetch user claims error:', err);
      }
    };

    fetchUserClaims();
  }, [user?.id]);


  const handleRedeem = (reward: Reward) => {
    if (!user) return;
    setPendingReward(reward);
    setWalletModalOpen(true);
    setWalletAddress('');
    setRedeemError(null);
  };

  const handleWalletSubmit = async () => {
    if (!user || !pendingReward || !walletAddress.trim()) {
      setRedeemError('Please enter a wallet address');
      return;
    }

    setRedeemingId(pendingReward.id);

    try {
      const response = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          rewardId: pendingReward.id,
          walletAddress: walletAddress.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRedeemError(data.error || 'Failed to redeem reward');
        return;
      }

      setRedeemSuccess(true);
      setWalletModalOpen(false);
      setWalletAddress('');
      setPendingReward(null);
      setTimeout(() => setRedeemSuccess(false), 5000);

      // Refetch rewards to update claimed counts and user claims
      const rewardsResponse = await fetch('/api/rewards');
      if (rewardsResponse.ok) {
        const rewardsData = await rewardsResponse.json();
        setRewards(rewardsData.rewards || []);
      }

      // Refresh user's claimed rewards
      if (user?.id) {
        const claimsResponse = await fetch('/api/rewards/user-claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (claimsResponse.ok) {
          const claimsData = await claimsResponse.json();
          setUserClaimedIds(claimsData.claimedRewardIds || []);
        }
      }
    } catch (err) {
      console.error('Redeem error:', err);
      setRedeemError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRedeemingId(null);
    }
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

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Rewards Store</h1>
              <p className="text-gray-400">Spend your BLAZE points on exclusive rewards</p>
            </div>
            <Link
              href="/blaze-claim"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Claim More Points
            </Link>
          </div>
        </div>

        {/* Balance Card */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-orange-600/20 to-orange-500/10 border border-orange-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Your BLAZE Points</p>
                  <p className="text-4xl font-bold text-orange-400">{balance.totalBlaze.toLocaleString()}</p>
                </div>
              </div>
            
            </div>
          </div>
        )}

        {/* Success notification */}
        {redeemSuccess && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
            <div className="text-2xl">✅</div>
            <div>
              <p className="text-green-400 font-semibold">Reward Redeemed!</p>
              <p className="text-green-300 text-sm">Check your email for redemption details</p>
            </div>
          </div>
        )}

        {/* Error notification */}
        {redeemError && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <div className="text-2xl">❌</div>
            <div>
              <p className="text-red-400 font-semibold">Redemption Failed</p>
              <p className="text-red-300 text-sm">{redeemError}</p>
            </div>
          </div>
        )}

        {/* All Rewards */}
        {loadingRewards ? (
          <LoadingWithLogo />
        ) : rewardsError ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-8">
            <p className="text-red-400">{rewardsError}</p>
          </div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No rewards available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userBalance={balance.totalBlaze}
                isRedeeming={redeemingId === reward.id}
                hasClaimed={userClaimedIds.includes(reward.id)}
                onRedeem={handleRedeem}
              />
            ))}
          </div>
        )}

        
      </div>

      {/* Wallet Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Enter Wallet Address</h2>
            <p className="text-gray-400 text-sm mb-4">
              Please provide your wallet address where we'll send your reward:
            </p>
            {pendingReward && (
              <div className="bg-neutral-700/50 rounded-lg p-3 mb-4">
                <p className="text-gray-300 text-sm">{pendingReward.name}</p>
              </div>
            )}
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f42fda"
              className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500 mb-4"
            />
            {redeemError && (
              <div className="text-red-400 text-sm mb-4">{redeemError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleWalletSubmit}
                disabled={!walletAddress.trim() || redeemingId === pendingReward?.id}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold transition-colors hover:shadow-lg hover:shadow-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {redeemingId === pendingReward?.id ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Redeeming...
                  </>
                ) : (
                  'Confirm & Redeem'
                )}
              </button>
              <button
                onClick={() => {
                  setWalletModalOpen(false);
                  setWalletAddress('');
                  setPendingReward(null);
                  setRedeemError(null);
                }}
                disabled={redeemingId === pendingReward?.id}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
