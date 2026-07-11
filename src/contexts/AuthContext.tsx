'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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
          localStorage.removeItem('user');
          localStorage.removeItem('auth_token');
          setUser(null);
        }
      } catch (fetchError) {
        // On network error, keep the optimistic user (might be offline)
        console.error('Failed to verify session:', fetchError);
      }
    };

    const initializeAuth = async () => {
      try {
        // Regular user session: hydrate from localStorage immediately so the
        // dashboard can render without waiting on any network round trip.
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          const optimisticUser = { ...user, userType: user.userType || 'user' };
          setUser(optimisticUser);
          setIsLoading(false);
          verifySessionInBackground(optimisticUser);
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);

          // Check for Supabase Auth session (developer)
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            // Developer is logged in via Supabase Auth
            console.log('✅ Dev session found:', session.user.email);
            const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'dev';
            setUser({
              id: session.user.id,
              username: username,
              email: session.user.email || '',
              userType: 'dev',
            });
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
    try {
      // Logout from regular user session
      await fetch('/api/auth/logout', { method: 'POST' });

      // Also logout from Supabase if dev is logged in
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey && user?.userType === 'dev') {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/login';
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
