import { useState, useEffect } from 'react';

export interface StreakDay {
  dayNumber: number;
  date: string;
  claimed: boolean;
  amount: number;
  claimedAt: string | null;
}

export interface BlazeBalance {
  totalBlaze: number;
  lastClaimAt: string | null;
}

export interface StreakData {
  data: StreakDay[];
  claimedDays: number;
  totalDays: number;
  currentStreakDay: number;
  canClaim: boolean;
  timeUntilNextClaim: string;
}

export interface BlazeClaimResponse {
  success: boolean;
  message: string;
  claim: {
    id: string;
    amount: number;
    claimedAt: string;
  };
  balance: number;
}

export function useBlazeClaim(userId: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BlazeBalance>({ totalBlaze: 0, lastClaimAt: null });
  const [streak, setStreak] = useState<StreakData>({
    data: [],
    claimedDays: 0,
    totalDays: 7,
    currentStreakDay: 1,
    canClaim: true,
    timeUntilNextClaim: '',
  });

  // Fetch claim history on mount
  useEffect(() => {
    if (!userId) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/blaze/history?userId=${userId}&days=7`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch history');
          return;
        }

        setBalance(data.balance);
        setStreak(data.streak);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to fetch claim data');
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchHistory();

    // Setup countdown timer - refetch every 30 seconds instead of every 1 second to reduce API calls
    const interval = setInterval(() => {
      fetchHistory();
    }, 30000);

    return () => clearInterval(interval);
  }, [userId]);

  const claim = async () => {
    if (!userId || !streak.canClaim) return;

    setClaiming(true);
    setError(null);

    try {
      const response = await fetch('/api/blaze/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to claim');
        return;
      }

      // Update local state
      setBalance((prev) => ({
        ...prev,
        totalBlaze: data.balance,
        lastClaimAt: data.claim.claimedAt,
      }));

      // Refetch history to update streak
      const historyResponse = await fetch(`/api/blaze/history?userId=${userId}&days=7`);
      const historyData = await historyResponse.json();
      setStreak(historyData.streak);

      return data as BlazeClaimResponse;
    } catch (err) {
      console.error('Claim error:', err);
      setError('An error occurred while claiming');
    } finally {
      setClaiming(false);
    }
  };

  return {
    loading,
    claiming,
    error,
    balance,
    streak,
    claim,
  };
}
