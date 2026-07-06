'use client';

import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SignUpPage: React.FC = () => {
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
      console.log('Signup response:', { status: response.status, data });

      if (!response.ok) {
        const errorMessage = Array.isArray(data.details)
          ? data.details.join(', ')
          : data.error || 'Signup failed';
        console.error('Signup error:', errorMessage);
        setError(errorMessage);
        return;
      }

      console.log('User data:', data.user);

      if (data.requiresVerification) {
        setUserId(data.user.id);
        setStep('verification');
        setTimeLeft(900);
      } else {
        // Skip verification for now
        setSuccess(true);
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    } catch (err) {
      console.error('Signup fetch error:', err);
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
      console.error(err);
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
    <div>
      <div className="min-h-screen flex">
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
                        placeholder="Enter Password"
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
                    <p className="text-gray-400 text-xs mt-1">Min 8 chars, uppercase, lowercase, number</p>
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

                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      required
                      disabled={loading}
                    />
                    <label htmlFor="terms" className="text-white text-sm">
                      By creating an account, you agree to{' '}
                      <a href="#" className="text-orange-400 hover:text-orange-300 underline">
                        terms & condition
                      </a>{' '}
                      and{' '}
                      <a href="#" className="text-orange-400 hover:text-orange-300 underline">
                        privacy policy
                      </a>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || success}
                    className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>

                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-gray-500"></div>
                    <span className="text-gray-400 text-sm">OR</span>
                    <div className="flex-1 h-px bg-gray-500"></div>
                  </div>

                  <p className="text-center text-gray-300 text-sm mt-6">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="text-orange-400 hover:text-orange-300 font-medium">
                      Login
                    </Link>
                  </p>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-orange-500 text-4xl font-bold mb-2">Verify Email</h1>
                <p className="text-gray-300 text-sm mb-8">
                  We sent a verification code to<br />
                  <span className="text-orange-400 font-medium">{email}</span>
                </p>

                {success && (
                  <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-500" />
                    <span className="text-green-500 text-sm">Email verified! Redirecting...</span>
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
                    <label htmlFor="code" className="text-white text-sm font-medium block mb-2">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      id="code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-center text-2xl tracking-widest font-mono"
                      required
                      disabled={loading}
                    />
                    <p className="text-gray-400 text-xs mt-1">Enter the 6-digit code sent to your email</p>
                  </div>

                  <div className="text-center">
                    <p className="text-gray-400 text-sm">
                      Code expires in <span className="text-orange-400 font-semibold">{formatTime(timeLeft)}</span>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || success || verificationCode.length !== 6}
                    className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : 'Verify Email'}
                  </button>

                  <div className="text-center">
                    <p className="text-gray-400 text-sm">
                      Didn't receive the code?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setStep('signup');
                          setVerificationCode('');
                          setError('');
                        }}
                        className="text-orange-400 hover:text-orange-300 font-medium"
                      >
                        Back to signup
                      </button>
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Right Side - Preview (Hidden on Mobile) */}
        <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-orange-400 to-orange-500 p-12 items-center justify-center">
          <div className="max-w-xl w-full space-y-6">
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

export default SignUpPage;
