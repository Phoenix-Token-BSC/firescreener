'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SignupFormContent: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState<'signup' | 'verification'>('signup');
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(900);

  useEffect(() => {
    if (step !== 'verification') return;
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (!agreedToTerms) {
      setError('You must agree to the terms and conditions');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = Array.isArray(data.details)
          ? data.details.join(', ')
          : data.error || 'Signup failed';
        setError(errorMessage);
        return;
      }

      if (data.requiresVerification) {
        setUserId(data.user.id);
        setStep('verification');
        setTimeLeft(900);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      setError('An error occurred during verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to resend code');
        return;
      }

      setVerificationCode('');
      setTimeLeft(900);
    } catch (err) {
      setError('An error occurred while resending the code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full lg:w-1/2 bg-gradient-to-br from-[#2d0a0a] to-[#4a0e0e] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {step === 'signup' ? (
          <>
            <h1 className="text-orange-500 text-4xl font-bold mb-2">Get Started</h1>
            <p className="text-gray-300 text-sm mb-8">
              Get access to real-time crypto analytics to start tracking
            </p>

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-green-500 text-sm">Account created! Redirecting...</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-red-500 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <label htmlFor="username" className="text-white text-sm font-medium block mb-2">
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                  disabled={loading}
                />
                <p className="text-gray-400 text-xs mt-1">3-50 characters, letters, numbers, hyphens, underscores</p>
              </div>

              <div>
                <label htmlFor="email" className="text-white text-sm font-medium block mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
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
                    placeholder="Enter password"
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

              <div>
                <label htmlFor="confirmPassword" className="text-white text-sm font-medium block mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-orange-500"
                  disabled={loading}
                />
                <span className="text-gray-300 text-sm">
                  I agree to the{' '}
                  <a href="#" className="text-orange-400 hover:text-orange-300">
                    terms of service
                  </a>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>

              <p className="text-center text-gray-300 text-sm">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-orange-400 hover:text-orange-300 font-medium">
                  Log in
                </Link>
              </p>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-orange-500 text-4xl font-bold mb-2">Verify Email</h1>
            <p className="text-gray-300 text-sm mb-8">
              Enter the 6-digit code sent to your email
            </p>

            {success && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                <CheckCircle size={20} className="text-green-500" />
                <span className="text-green-500 text-sm">Email verified! Redirecting to login...</span>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-red-500 text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label className="text-white text-sm font-medium block mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest font-mono"
                  required
                  disabled={loading}
                />
              </div>

              <div className="text-center text-sm text-gray-400">
                {timeLeft > 0 ? (
                  <>Code expires in: <span className="font-bold text-orange-400">{formatTime(timeLeft)}</span></>
                ) : (
                  <span className="text-red-400">Code expired. Please request a new one.</span>
                )}
              </div>

              <p className="text-center text-sm text-gray-400">
                Didn&apos;t receive the code?{' '}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-orange-400 hover:text-orange-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Resend code
                </button>
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SignupFormContent;
