import { useEffect, useRef, useState } from 'react';

/**
 * Hook to preserve scroll position and prevent page refresh when navigating back
 * Stores scroll position in sessionStorage and automatically restores it
 */
export function useScrollRestoration(key: string = 'scrollPosition') {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    // Restore scroll position when component mounts
    const restoreScroll = () => {
      const savedPosition = sessionStorage.getItem(key);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          window.scrollTo(0, position);
        }, 0);
      }
    };

    // Restore on mount
    restoreScroll();

    // Save scroll position when user scrolls
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [key]);

  // Return a function to manually save current scroll position
  return () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, String(window.scrollY));
    }
  };
}

/**
 * Hook to preserve any data in sessionStorage with automatic cleanup on tab close
 * Useful for preserving tokens list, filters, etc.
 */
export function useSessionStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    // Only access sessionStorage on client side
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setStoredValue = (valueOrFn: T | ((val: T) => T)) => {
    if (valueOrFn instanceof Function) {
      // Use React's functional update so `prev` is always the current state,
      // not a stale closure value captured at hook-creation time.
      setValue(prev => {
        const next = (valueOrFn as (val: T) => T)(prev);
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(key, JSON.stringify(next));
          }
        } catch (error) {
          console.error(`Error writing to sessionStorage key "${key}":`, error);
        }
        return next;
      });
    } else {
      try {
        setValue(valueOrFn);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(key, JSON.stringify(valueOrFn));
        }
      } catch (error) {
        console.error(`Error writing to sessionStorage key "${key}":`, error);
      }
    }
  };

  return [value, setStoredValue] as const;
}

/**
 * Hook to detect if user is returning to page without triggering re-fetch
 * Uses a ref to check on first mount only - avoids re-render cycles
 */
export function useShouldSkipInitialFetch(pageKey: string): boolean {
  const shouldSkipRef = useRef(false);
  const initializedRef = useRef(false);

  // Check only once on mount
  if (!initializedRef.current) {
    initializedRef.current = true;
    // Only check sessionStorage on client side
    if (typeof window !== 'undefined') {
      shouldSkipRef.current = sessionStorage.getItem(`${pageKey}-data`) !== null;
    }
  }

  return shouldSkipRef.current;
}
