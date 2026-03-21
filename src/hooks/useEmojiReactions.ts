import { useState, useEffect, useCallback } from 'react';

interface ReactionCounts {
  [key: number]: number;
}

interface UseEmojiReactionsReturn {
  counts: ReactionCounts;
  loading: boolean;
  error: string | null;
  hasReactedToday: boolean;
  handleEmojiClick: (emojiId: number) => Promise<void>;
  resetCounts: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

/**
 * Get today's date as a string in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Check if user has already reacted today for a given contract address
 */
function checkHasReactedToday(contractAddress: string): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const storageKey = `emoji_reaction_${contractAddress.toLowerCase()}`;
    const storedDate = localStorage.getItem(storageKey);
    const today = getTodayDateString();
    
    return storedDate === today;
  } catch (error) {
    console.error('Error checking local storage:', error);
    return false;
  }
}

/**
 * Mark that user has reacted today for a given contract address
 */
function markAsReactedToday(contractAddress: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storageKey = `emoji_reaction_${contractAddress.toLowerCase()}`;
    const today = getTodayDateString();
    localStorage.setItem(storageKey, today);
  } catch (error) {
    console.error('Error saving to local storage:', error);
  }
}

/**
 * Custom hook to manage emoji reactions for a token
 * @param contractAddress - The contract address of the token
 * @returns Object with counts, loading, error, and handlers
 */
export function useEmojiReactions(contractAddress: string | null): UseEmojiReactionsReturn {
  const [counts, setCounts] = useState<ReactionCounts>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReactedToday, setHasReactedToday] = useState(false);

  // Check if user has already reacted today when contract address changes
  useEffect(() => {
    if (contractAddress) {
      setHasReactedToday(checkHasReactedToday(contractAddress));
    } else {
      setHasReactedToday(false);
    }
  }, [contractAddress]);

  // Check if it's a new day when window regains focus (e.g., user comes back after midnight)
  useEffect(() => {
    if (!contractAddress) return;

    const handleFocus = () => {
      setHasReactedToday(checkHasReactedToday(contractAddress));
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [contractAddress]);

  // Fetch reactions from server on mount or when contractAddress changes
  const syncFromServer = useCallback(async () => {
    if (!contractAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reactions/${contractAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch reactions');
      }

      const data = await response.json();
      setCounts(data.reactions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error syncing reactions:', err);
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  // Initial sync when component mounts or contractAddress changes
  useEffect(() => {
    syncFromServer();
  }, [contractAddress, syncFromServer]);

  // Handle emoji click - increment count and sync to server
  const handleEmojiClick = useCallback(
    async (emojiId: number) => {
      if (!contractAddress) return;

      // Check if user has already reacted today
      if (checkHasReactedToday(contractAddress)) {
        setError('You have already reacted today. Please come back tomorrow!');
        return;
      }

      // Optimistic update
      setCounts(prev => ({
        ...prev,
        [emojiId]: prev[emojiId] + 1,
      }));

      try {

        markAsReactedToday(contractAddress);
        setHasReactedToday(true);
        const updatedCounts = {
          ...counts,
          [emojiId]: counts[emojiId] + 1,
        };

        const response = await fetch(`/api/reactions/${contractAddress}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reactions: updatedCounts }),
        });

        if (!response.ok) {
          throw new Error('Failed to update reactions');
        }

        const data = await response.json();
        setCounts(data.reactions);
        
        // Mark as reacted today in local storage
        
        setError(null);
      } catch (err) {
        // Revert on error
        setCounts(prev => ({
          ...prev,
          [emojiId]: prev[emojiId] - 1,
        }));
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Error updating reaction:', err);
      }
    },
    [contractAddress, counts]
  );

  // Reset all counts to 0
  const resetCounts = useCallback(async () => {
    if (!contractAddress) return;

    // Optimistic update
    setCounts({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    });

    try {
      const response = await fetch(`/api/reactions/${contractAddress}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reactions: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset reactions');
      }

      const data = await response.json();
      setCounts(data.reactions);
    } catch (err) {
      // Revert on error
      setCounts(counts);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Error resetting reactions:', err);
    }
  }, [contractAddress, counts]);

  return {
    counts,
    loading,
    error,
    hasReactedToday,
    handleEmojiClick,
    resetCounts,
    syncFromServer,
  };
}
