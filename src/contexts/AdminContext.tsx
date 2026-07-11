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

      // Get admin email from localStorage
      const adminEmail = localStorage.getItem('adminEmail');
      console.log('AdminContext checking status, email:', adminEmail);

      if (!adminEmail) {
        console.log('No admin email in localStorage');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Verify with API (uses service role to bypass RLS)
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      });

      const data = await response.json();
      console.log('Admin verify response:', data);

      if (response.ok) {
        console.log('Setting isAdmin to:', data.isAdmin);
        setIsAdmin(data.isAdmin || false);
      } else {
        setError('Failed to verify admin status');
        setIsAdmin(false);
      }
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
