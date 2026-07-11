'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LoadingWithLogo from './LoadingWithLogo';
import { useAuth } from '@/contexts/AuthContext';

const LoginFormContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: setAuthUser } = useAuth();
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

      // Update the auth context so the dashboard sees the session immediately
      setAuthUser(data.user);
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
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

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-500"></div>
            <span className="text-gray-400 text-sm">OR</span>
            <div className="flex-1 h-px bg-gray-500"></div>
          </div>

         
          <p className="text-center text-gray-300 text-sm mt-6">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-orange-400 hover:text-orange-300 font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginFormContent;
