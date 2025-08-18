'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  isActive: boolean;
}

const features: Feature[] = [
  {
    id: 'ai-parser',
    title: 'AI Bank Parser',
    description: 'Advanced AI-powered table extraction technology. Automatically detect and extract all table data with intelligent algorithms.',
    icon: '🤖',
    href: '/dashboard/bank-statement-aws-textract',
    isActive: true
  },
  {
    id: 'form-data-parser',
    title: 'Form Data Parser',
    description: 'AI-powered key-value extraction from PDF forms. Automatically detect and extract all form fields and their values.',
    icon: '📋',
    href: '/dashboard/form-data-parser',
    isActive: true
  },
  // Future features can be added here
  {
    id: 'document-analyzer',
    title: 'Document Analyzer',
    description: 'Analyze documents for insights, keywords, and content structure. Coming soon.',
    icon: '📊',
    href: '#',
    isActive: false
  },
  {
    id: 'data-visualizer',
    title: 'Data Visualizer',
    description: 'Create charts and visualizations from your extracted data. Coming soon.',
    icon: '📈',
    href: '#',
    isActive: false
  }
];

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/auth/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/auth/login');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFEFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C7BE] mx-auto mb-4"></div>
          <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm py-4 px-4 md:px-16 border-b border-gray-200">
        <div className="max-w-[1312px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/pandiver-logo.svg"
              alt="PandiVer"
              width={120}
              height={31}
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[#086C67] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-medium">
                {user?.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white font-medium rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1312px] mx-auto px-4 md:px-16 py-12">
        {/* Welcome Section */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose from our powerful tools to streamline your document processing workflow.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.id} className="relative">
              {feature.isActive ? (
                <Link href={feature.href}>
                  <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-4">
                        <span className="text-2xl">{feature.icon}</span>
                      </div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-2">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-gray-600 text-center mb-6">
                      {feature.description}
                    </p>
                    <div className="text-center">
                      <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                        <span>Get Started</span>
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 opacity-60 cursor-not-allowed">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-200 rounded-full mb-4">
                      <span className="text-2xl">{feature.icon}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-500 mb-2">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-500 text-center mb-6">
                    {feature.description}
                  </p>
                  <div className="text-center">
                    <div className="inline-flex items-center px-6 py-3 bg-gray-300 text-gray-500 rounded-full font-semibold">
                      <span>Coming Soon</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-gradient-to-br from-[#00C7BE]/5 to-[#086C67]/5 rounded-3xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              Your Account Overview
            </h2>
            <p className="text-gray-600">
              Track your usage and account details
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-2">
                2
              </h3>
              <p className="text-gray-600 font-medium">
                Active Features
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-[#086C67] to-[#00C7BE] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-2">
                Free
              </h3>
              <p className="text-gray-600 font-medium">
                Current Plan
              </p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg border border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-2">
                {new Date(user?.created_at || '').toLocaleDateString()}
              </h3>
              <p className="text-gray-600 font-medium">
                Member Since
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 