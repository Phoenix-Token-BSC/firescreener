'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AdminContextType {
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Identity comes from the HttpOnly admin_session cookie, which the browser sends
      // automatically. Nothing is read from localStorage — a value there proved nothing,
      // since the client could set it to any address.
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        credentials: 'same-origin',
      });

      // 401 simply means "not signed in", which is a normal state, not an error.
      if (response.status === 401) {
        setIsAdmin(false);
        return;
      }

      if (!response.ok) {
        setError('Failed to verify admin status');
        setIsAdmin(false);
        return;
      }

      const data = await response.json();
      setIsAdmin(data.isAdmin || false);
    } catch (err) {
      console.error('Admin check error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check immediately
    checkAdminStatus();

    // Listen for admin login event
    const handleAdminLogin = () => {
      // Recheck after login event
      setTimeout(() => checkAdminStatus(), 50);
    };

    window.addEventListener('admin-login', handleAdminLogin);

    return () => {
      window.removeEventListener('admin-login', handleAdminLogin);
    };
  }, []);

  return (
    <AdminContext.Provider value={{ isAdmin, isLoading, error }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};
