'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useBlazeClaim } from '@/hooks/useBlazeClaim';
import { useState } from 'react';
import { Zap, Gift, Flame, Lock, ChevronDown } from 'lucide-react';
import Link from 'next/link';

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

const DEMO_REWARDS: Reward[] = [
  {
    id: 'early-bird-eth',
    name: 'Early Bird ETH Bundle',
    description: 'Limited FCFS - Get 0.01 ETH before it runs out',
    type: 'fcfs',
    cost: 500,
    stock: 10,
    claimed: 7,
    icon: '💎',
    color: 'blue',
    badge: 'LIMITED',
  },
  {
    id: 'mystery-token-10x',
    name: 'Mystery Token 10x Entry',
    description: 'Get early access to a mystery token with 10x potential',
    type: 'fcfs',
    cost: 250,
    stock: 25,
    claimed: 18,
    icon: '🎰',
    color: 'purple',
    badge: 'HOT',
  },
  {
    id: 'ticket-binance-listing',
    name: 'Binance Listing Lottery Ticket',
    description: 'Win a chance at exclusive Binance listing presale',
    type: 'ticket',
    cost: 150,
    icon: '🎟️',
    color: 'orange',
  },
  {
    id: 'ticket-solana-nft',
    name: 'Solana NFT Collection Pass',
    description: 'Enter raffle for exclusive Solana NFT collection',
    type: 'ticket',
    cost: 200,
    icon: '🎨',
    color: 'green',
  },
  {
    id: 'instant-bsc-token',
    name: 'Instant BSC Token Airdrop',
    description: 'Instantly receive 1000 BSC chain tokens',
    type: 'instant',
    cost: 100,
    icon: '⚡',
    color: 'orange',
  },
  {
    id: 'premium-analytics',
    name: 'Premium Analytics (30 Days)',
    description: 'Unlock advanced price prediction and analytics tools',
    type: 'instant',
    cost: 300,
    icon: '📊',
    color: 'blue',
  },
];

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

function RewardCard({ reward, userBalance, onRedeem }: { reward: Reward; userBalance: number; onRedeem: (reward: Reward) => void }) {
  const canAfford = userBalance >= reward.cost;
  const isOutOfStock = reward.type === 'fcfs' && reward.stock && reward.claimed && reward.claimed >= reward.stock;
  const isClaimable = canAfford && !isOutOfStock;

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
                : 'bg-neutral-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isOutOfStock ? (
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
  const { loading, balance } = useBlazeClaim(user?.id);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('fcfs');

  const fcfsRewards = DEMO_REWARDS.filter(r => r.type === 'fcfs');
  const ticketRewards = DEMO_REWARDS.filter(r => r.type === 'ticket');
  const instantRewards = DEMO_REWARDS.filter(r => r.type === 'instant');

  const handleRedeem = (reward: Reward) => {
    if (balance.totalBlaze >= reward.cost) {
      setRedeemSuccess(true);
      setTimeout(() => setRedeemSuccess(false), 5000);
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
              <h1 className="text-4xl font-bold text-white mb-2">Rewards Store 🎁</h1>
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
                <div className="text-4xl">💰</div>
                <div>
                  <p className="text-gray-400 text-sm font-medium mb-1">Your BLAZE Points</p>
                  <p className="text-4xl font-bold text-orange-400">{balance.totalBlaze.toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm mb-2">Total Available</p>
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-orange-400" />
                  <span className="text-2xl font-bold text-white">{balance.totalBlaze}</span>
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

        {/* Rewards by Category */}
        <div className="space-y-8">
          {/* FCFS Rewards */}
          <div>
            <button
              onClick={() => setExpandedCategory(expandedCategory === 'fcfs' ? null : 'fcfs')}
              className="w-full flex items-center justify-between mb-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💎</div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    Limited FCFS Rewards
                  </h2>
                  <p className="text-gray-400 text-sm">Grab these before they sell out!</p>
                </div>
              </div>
              <ChevronDown
                size={24}
                className={`text-gray-400 transition-transform ${expandedCategory === 'fcfs' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedCategory === 'fcfs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fcfsRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userBalance={balance.totalBlaze}
                    onRedeem={handleRedeem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Ticket Rewards */}
          <div>
            <button
              onClick={() => setExpandedCategory(expandedCategory === 'ticket' ? null : 'ticket')}
              className="w-full flex items-center justify-between mb-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🎟️</div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    Raffle & Lottery Tickets
                  </h2>
                  <p className="text-gray-400 text-sm">Enter for a chance to win big prizes</p>
                </div>
              </div>
              <ChevronDown
                size={24}
                className={`text-gray-400 transition-transform ${expandedCategory === 'ticket' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedCategory === 'ticket' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ticketRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userBalance={balance.totalBlaze}
                    onRedeem={handleRedeem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Instant Rewards */}
          <div>
            <button
              onClick={() => setExpandedCategory(expandedCategory === 'instant' ? null : 'instant')}
              className="w-full flex items-center justify-between mb-4 group"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">⚡</div>
                <div className="text-left">
                  <h2 className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                    Instant Rewards
                  </h2>
                  <p className="text-gray-400 text-sm">Get instant benefits applied to your account</p>
                </div>
              </div>
              <ChevronDown
                size={24}
                className={`text-gray-400 transition-transform ${expandedCategory === 'instant' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedCategory === 'instant' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instantRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    userBalance={balance.totalBlaze}
                    onRedeem={handleRedeem}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Gift size={24} className="text-orange-400" />
                How It Works
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold min-w-fit">1.</span>
                  <span className="text-gray-300">Claim BLAZE points daily from the rewards page</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold min-w-fit">2.</span>
                  <span className="text-gray-300">Browse exclusive rewards in this store</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold min-w-fit">3.</span>
                  <span className="text-gray-300">Redeem your points for tokens, tickets, or premiums</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold min-w-fit">4.</span>
                  <span className="text-gray-300">Enjoy your rewards instantly or participate in raffles</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Flame size={24} className="text-orange-400" />
                Reward Types
              </h3>
              <ul className="space-y-3">
                <li className="text-gray-300">
                  <span className="font-semibold text-orange-400">FCFS:</span> Limited quantity rewards, first come first served
                </li>
                <li className="text-gray-300">
                  <span className="font-semibold text-orange-400">Tickets:</span> Lottery/raffle tickets for big prize pools
                </li>
                <li className="text-gray-300">
                  <span className="font-semibold text-orange-400">Instant:</span> Immediately applied to your account
                </li>
                <li className="text-gray-300">
                  <span className="font-semibold text-orange-400">Upcoming:</span> Custom admin-managed reward categories
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
