'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import Header from '@/components/Header';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const LoginPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const msg = searchParams?.get('message');
    if (msg) {
      setMessage(msg);
      setTimeout(() => setMessage(''), 5000);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      setSuccess(true);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="min-h-screen flex">
        <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#2d0a0a] to-[#4a0e0e] flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <h1 className="text-orange-500 text-4xl font-bold mb-2">Welcome Back</h1>
            <p className="text-gray-300 text-sm mb-8">
              Log in to access your crypto analytics dashboard
            </p>

            {message && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-green-500 text-sm">{message}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-green-500 text-sm">Login successful! Redirecting...</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-red-500 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Login Field (Email or Username) */}
              <div>
                <label htmlFor="login" className="text-white text-sm font-medium block mb-2">
                  Email or Username
                </label>
                <input
                  type="text"
                  id="login"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Enter your email or username"
                  className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="text-white text-sm font-medium block mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-white text-sm">Remember me</span>
                </label>
                <a href="#" className="text-orange-400 hover:text-orange-300 text-sm">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || success}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-500"></div>
                <span className="text-gray-400 text-sm">OR</span>
                <div className="flex-1 h-px bg-gray-500"></div>
              </div>

              {/* Social Login */}
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#000">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                </button>
              </div>

              {/* Signup Link */}
              <p className="text-center text-gray-300 text-sm mt-6">
                Don't have an account?{' '}
                <Link href="/auth/signup" className="text-orange-400 hover:text-orange-300 font-medium">
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>

        {/* Right Side - Preview (Hidden on Mobile) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-orange-400 to-orange-500 p-12 items-center justify-center">
          <div className="max-w-xl w-full space-y-6">
            {/* Logo and Heading */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🔥</span>
                </div>
                <span className="text-white text-2xl font-bold">FireScreener</span>
              </div>
              <h2 className="text-white text-4xl font-bold leading-tight">
                Find new coins, Track every chart.
              </h2>
            </div>

            {/* Token Card */}
            <div className="bg-white rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                  <span className="text-orange-500 text-xl font-bold">P</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Phoenix Token</div>
                  <div className="text-xs text-gray-500">PHT</div>
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">$0.025900</div>
                  <div className="text-green-500 text-sm font-medium">+0.25%</div>
                </div>
                <svg className="w-24 h-12" viewBox="0 0 100 50" preserveAspectRatio="none">
                  <polyline
                    points="0,40 20,35 40,25 60,30 80,20 100,25"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            {/* Chart Card */}
            <div className="bg-gradient-to-br from-[#2d0a0a] to-[#4a0e0e] rounded-2xl p-5 shadow-xl">
              <div className="text-orange-400 text-xl font-bold mb-2">Chart</div>
              <div className="text-gray-400 text-xs mb-2">Phoenix Token / PHT</div>
              <div className="text-orange-400 text-lg font-bold mb-4">$0.028900</div>
              <svg className="w-full h-24" viewBox="0 0 300 100" preserveAspectRatio="none">
                <polyline
                  points="0,60 30,50 60,55 90,40 120,45 150,35 180,30 210,50 240,40 270,45 300,35"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Portfolio Card */}
            <div className="bg-white rounded-2xl p-5 shadow-xl">
              <div className="font-bold text-gray-900 text-xl mb-4">My Portfolio</div>

              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <span className="text-orange-500 text-xl font-bold">P</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Phoenix Token</div>
                    <div className="text-sm text-gray-600">$2,590.45</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-500 text-sm font-medium">+5.76%</div>
                  <div className="text-sm text-gray-600">100,000 PHT</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xl">🐱</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">WikiCat Coin</div>
                    <div className="text-sm text-gray-600">$1,870.00</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-500 text-sm font-medium">+2.56%</div>
                  <div className="text-xs text-gray-600">20,000,000,000 WKC</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
