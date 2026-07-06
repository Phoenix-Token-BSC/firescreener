'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

  useEffect(() => {
    const checkAdmin = async () => {
      // This is just an initial check - we don't auto-login
      // Users must manually log in
      setCheckingAuth(false);
    };

    checkAdmin();
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      if (data.success) {
        setIsAdmin(true);
        // Store admin email in localStorage for session persistence
        localStorage.setItem('adminEmail', data.admin.email);

        // Dispatch custom event to notify AdminContext
        window.dispatchEvent(new Event('admin-login'));

        // Delay to ensure localStorage is written and context checks it
        setTimeout(() => {
          router.push('/admin');
        }, 150);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-neutral-800/50 border border-neutral-700/50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 text-orange-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-gray-400">Sign in with your admin credentials</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm flex items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 text-white rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 disabled:from-orange-600/50 disabled:to-orange-500/50 text-white font-bold rounded-lg transition-all transform hover:shadow-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="bg-neutral-700/30 rounded-lg p-4">
            <h3 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
              <Shield size={16} className="text-orange-400" />
              Admin Access Required
            </h3>
            <p className="text-gray-300 text-sm mb-3">
              Your admin credentials have been set up in Supabase. Contact your team administrator if you don't have access yet.
            </p>
            <ul className="text-gray-400 text-xs space-y-1">
              <li>✓ Email must be registered in admin_users table</li>
              <li>✓ is_active must be set to true</li>
              <li>✓ Password is hashed with bcrypt in admin_users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
