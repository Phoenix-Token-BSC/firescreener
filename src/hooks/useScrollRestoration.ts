import { useEffect, useRef, useState } from 'react';

/**
 * Hook to preserve scroll position and prevent page refresh when navigating back
 * Stores scroll position in sessionStorage and automatically restores it
 */
export function useScrollRestoration(key: string = 'scrollPosition') {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
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
    sessionStorage.setItem(key, String(window.scrollY));
  };
}

/**
 * Hook to preserve any data in sessionStorage with automatic cleanup on tab close
 * Useful for preserving tokens list, filters, etc.
 */
export function useSessionStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
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
    try {
      const valueToStore = valueOrFn instanceof Function ? valueOrFn(value) : valueOrFn;
      setValue(valueToStore);
      sessionStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error writing to sessionStorage key "${key}":`, error);
    }
  };

  return [value, setStoredValue] as const;
}
