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
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
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
            console.log('Setting user:', { id: session.user.id, username, email: session.user.email, userType: 'dev' });
            setUser({
              id: session.user.id,
              username: username,
              email: session.user.email || '',
              userType: 'dev',
            });
            console.log('User set complete');
            setIsLoading(false);
            return;
          }
        }

        // Check for regular user session (localStorage)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);

          // Verify user still exists in database
          try {
            const response = await fetch('/api/auth/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id }),
            });

            if (response.ok) {
              const data = await response.json();
              setUser({
                ...user,
                userType: data.userType || 'user',
              });
            } else {
              // User not found or session invalid
              console.log('User session invalid, clearing auth');
              localStorage.removeItem('user');
              localStorage.removeItem('auth_token');
            }
          } catch (fetchError) {
            console.error('Failed to verify session:', fetchError);
            // On network error, still load the user (might be offline)
            setUser(user);
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
