'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  /** Kept for existing call sites; derived from isDeveloper. */
  userType: 'dev' | 'user';
  isDeveloper: boolean;
  created_at?: string;
  is_active?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDeveloper: boolean;
  login: (user: Omit<AuthUser, 'userType' | 'isDeveloper'> & Partial<Pick<AuthUser, 'userType' | 'isDeveloper'>>) => void;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * One account per person.
 *
 * Regular users and developers are the same kind of account now — a Supabase Auth user
 * plus a `profiles` row, where `is_developer` is a capability rather than a separate
 * login. That removes the old dual-session problem entirely: there is only one session
 * to hold, so it is no longer possible to be signed in as two different people, and no
 * exclusivity logic is needed to prevent it.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string): Promise<AuthUser | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, is_developer, is_active, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    // A deactivated account is treated as signed out.
    if (data.is_active === false) return null;

    return {
      id: data.id,
      username: data.username,
      email: data.email,
      isDeveloper: !!data.is_developer,
      userType: data.is_developer ? 'dev' : 'user',
      created_at: data.created_at,
      is_active: data.is_active,
    };
  }, []);

  useEffect(() => {
    let active = true;

    const sync = async (userId: string | undefined) => {
      if (!userId) {
        if (active) setUser(null);
        return;
      }
      const profile = await loadProfile(userId);
      if (active) setUser(profile);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await sync(session?.user?.id);
      if (active) setIsLoading(false);
    });

    // Keeps every tab in step: signing out in one signs out the rest.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      sync(session?.user?.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Called right after login so the UI updates without waiting for the auth listener.
  const login: AuthContextType['login'] = (newUser) => {
    const isDeveloper = newUser.isDeveloper ?? newUser.userType === 'dev';
    setUser({ ...newUser, isDeveloper, userType: isDeveloper ? 'dev' : 'user' });
    setIsLoading(false);
  };

  const logout = async () => {
    const destination = user?.isDeveloper ? '/dev/auth' : '/auth/login';
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Legacy keys from the pre-merge dual-session system; harmless to clear.
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('activeSession');
      setUser(null);
      window.location.href = destination;
    }
  };

  const refetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setUser(null);
      return;
    }
    setUser(await loadProfile(session.user.id));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        isDeveloper: !!user?.isDeveloper,
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
