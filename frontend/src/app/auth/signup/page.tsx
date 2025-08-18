'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [name, setName] = useState('');
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
      const response = await fetch('http://localhost:8000/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Signup failed');
      }

      const data = await response.json();
      console.log('✅ Signup successful:', data);
      
      // Store token and user info in localStorage
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      console.log('💾 Stored auth data in localStorage');
      
      // Redirect to dashboard with a small delay to ensure state is updated
      console.log('🔄 Redirecting to dashboard...');
      setTimeout(() => {
        // Try window.location as fallback if router.push fails
        try {
          router.push('/dashboard');
        } catch (routerError) {
          console.warn('Router push failed, using window.location:', routerError);
          window.location.href = '/dashboard';
        }
      }, 100);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header with Logo */}
      <nav className="bg-white py-4 px-4 md:px-16 border-b border-gray-200">
        <div className="max-w-[1312px] mx-auto">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/pandiver-logo.svg"
                alt="PandiVer"
                width={120}
                height={31}
                className="h-8 w-auto"
              />
            </Link>
            <div className="flex items-center space-x-3">
              <span className="text-gray-600 text-sm">Already have an account?</span>
              <Link href="/auth/login">
                <button className="px-5 py-2 text-[#0D0C05] font-bold text-base bg-transparent border border-[#086C67] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors">
                  LOGIN
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Left Panel - Product Description */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#086C67] to-[#00C7BE] text-white p-12 flex-col justify-center min-h-screen">
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold mb-6 leading-tight">
              Transform Your Document Processing with AI
            </h1>
            
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Join thousands of professionals who use PandiVer to extract, analyze, and process documents 10x faster with our cutting-edge AI technology.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">AI-powered bank statement extraction</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">Smart form data processing</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">Multiple export formats</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">Enterprise-grade security</span>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <div className="flex items-center space-x-4">
                <div className="flex -space-x-2">
                  <div className="w-10 h-10 bg-white/20 rounded-full border-2 border-white"></div>
                  <div className="w-10 h-10 bg-white/20 rounded-full border-2 border-white"></div>
                  <div className="w-10 h-10 bg-white/20 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <p className="font-semibold">5,000+ happy users</p>
                  <p className="text-sm text-white/80">Processing millions of documents</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Signup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-2">
                  Create Your Account
                </h2>
                <p className="text-gray-600">
                  Start your free trial today. No credit card required.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="name" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-medium mb-2">
                    Name*
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full px-4 py-3 border border-[#0D0D0C]/20 rounded-xl focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors text-[#0D0D0C] bg-white"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-medium mb-2">
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
                  <label htmlFor="password" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-medium mb-2">
                    Password*
                  </label>
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
                    className="w-full py-3 px-6 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white font-semibold rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
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
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Sign up with Google</span>
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}