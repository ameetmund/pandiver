'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      
      // Store token and user info in localStorage
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFEFC] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-[#0D0D0C]">
            Pandi<span className="text-[#00C7BE]">V</span>er
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8">
          <div className="text-center mb-8">
            <h2 className="text-[#0D0D0C] text-[32px] leading-[38.4px] font-['Urbanist'] font-normal mb-2">
              Log In
            </h2>
            <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
              Welcome back! Please enter your credentials.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-medium mb-2">
                Email*
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3 border border-[#0D0D0C]/20 rounded-xl focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors text-[#0D0D0C] bg-white"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-medium">
                  Password*
                </label>
                <Link 
                  href="/auth/forgot-password"
                  className="text-[14px] text-[#0D0D0C]/60 hover:text-[#00C7BE] underline transition-colors"
                >
                  Forgot your password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 border border-[#0D0D0C]/20 rounded-xl focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors text-[#0D0D0C] bg-white"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Logging in...' : 'Log in'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#0D0D0C]/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#0D0D0C]/60">or</span>
              </div>
            </div>

            <div>
              <button
                type="button"
                disabled={isLoading}
                className="w-full bg-white text-[#0D0D0C] py-3 px-6 rounded-[20px] border border-[#0D0D0C]/20 hover:bg-[#F9FEFE] transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Log in with Google</span>
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-[#00C7BE] hover:text-[#086C67] underline font-medium">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 