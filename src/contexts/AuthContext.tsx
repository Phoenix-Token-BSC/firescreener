'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  readActiveSession,
  clearUserSession,
  clearDevSession,
  endAllSessions,
} from '@/lib/session';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  userType: 'dev' | 'user'; // 'dev' = developer_accounts, 'user' = auth_users
  created_at?: string;
  last_login?: string;
  is_active?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: Omit<AuthUser, 'userType'> & { userType?: AuthUser['userType'] }) => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verify the stored session in the background — the UI renders optimistically
    // and is only logged out if the server says the session is invalid.
    const verifySessionInBackground = async (storedUser: AuthUser) => {
      try {
        const response = await fetch('/api/auth/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: storedUser.id }),
        });

        if (response.ok) {
          const data = await response.json();
          setUser({
            ...storedUser,
            userType: data.userType || 'user',
          });
        } else {
          console.log('User session invalid, clearing auth');
          // Goes through the shared helper so the auth_token cookie and the
          // activeSession marker are cleared too, not just the localStorage entries.
          await endAllSessions();
          setUser(null);
        }
      } catch (fetchError) {
        // On network error, keep the optimistic user (might be offline)
        console.error('Failed to verify session:', fetchError);
      }
    };

    /**
     * Resolves a Supabase Auth session into a developer account.
     *
     * Reads the real username from developer_accounts rather than guessing it from
     * user_metadata or the email local-part, and confirms the account actually exists —
     * a Supabase auth user with no developer_accounts row is not a developer.
     */
    const resolveDevSession = async (sessionUser: {
      id: string;
      email?: string;
    }): Promise<AuthUser | null> => {
      try {
        const res = await fetch('/api/auth/user-type', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: sessionUser.id, email: sessionUser.email }),
        });
        if (!res.ok) return null;

        const data = await res.json();
        if (data.userType !== 'dev') return null;

        return {
          id: data.id ?? sessionUser.id,
          username: data.username || sessionUser.email?.split('@')[0] || 'developer',
          email: data.email || sessionUser.email || '',
          userType: 'dev',
        };
      } catch {
        return null;
      }
    };

    const initializeAuth = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase =
          supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

        const storedUser = localStorage.getItem('user');
        const { data: { session } = { session: null } } =
          (await supabase?.auth.getSession()) ?? { data: { session: null } };

        // Both present: only one may survive. Prefer whichever was established most
        // recently; sessions predating the activeSession marker fall back to the
        // regular user, which is what the old code did.
        if (storedUser && session?.user) {
          const active = readActiveSession();
          if (active?.kind === 'dev') {
            await clearUserSession();
            const devUser = await resolveDevSession(session.user);
            setUser(devUser);
            if (!devUser) await clearDevSession();
            return;
          }
          await clearDevSession();
        }

        // Regular user: hydrate from localStorage immediately so the dashboard can
        // render without waiting on any network round trip.
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          const optimisticUser = { ...parsed, userType: parsed.userType || 'user' };
          setUser(optimisticUser);
          setIsLoading(false);
          verifySessionInBackground(optimisticUser);
          return;
        }

        if (session?.user) {
          const devUser = await resolveDevSession(session.user);
          if (devUser) {
            setUser(devUser);
          } else {
            // Authenticated with Supabase but not a developer — not a session this app
            // recognises, so do not present it as one.
            await clearDevSession();
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Called right after a successful login so the context reflects the new
  // session immediately — the provider's init effect only runs on first mount.
  const login = (newUser: Omit<AuthUser, 'userType'> & { userType?: AuthUser['userType'] }) => {
    setUser({ ...newUser, userType: newUser.userType || 'user' });
    setIsLoading(false);
  };

  const logout = async () => {
    // Send the developer back to their own login page rather than the user one.
    const destination = user?.userType === 'dev' ? '/dev/auth' : '/auth/login';

    try {
      // Both sessions are cleared regardless of which one is active. Previously the
      // Supabase sign-out was skipped unless userType was 'dev', so logging out as a
      // regular user left a developer session behind — and the next page load picked it
      // up and signed you straight back in as the developer.
      await endAllSessions();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      window.location.href = destination;
    }
  };

  const refetchUser = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to refetch user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
