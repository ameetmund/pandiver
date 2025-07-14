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
    id: 'smart-pdf-parser',
    title: 'Smart PDF Parser',
    description: 'Extract text and data from PDF files with intelligent parsing. Drag and drop text blocks to create structured tables.',
    icon: '📄',
    href: '/dashboard/smart-pdf-parser',
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
          <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFEFC]">
      {/* Header */}
      <header className="bg-[#FFFEFC] py-4 px-4 md:px-16 border-b border-[#0D0D0C]/10">
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
              <div className="w-8 h-8 bg-[#00C7BE] rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-medium">
                {user?.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-[#0D0D0C] font-medium text-sm bg-transparent border border-[#0D0D0C]/20 rounded-lg hover:bg-[#F9FEFE] transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1312px] mx-auto px-4 md:px-16 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px] mb-4">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-[#0D0D0C] text-[20px] leading-[30px] font-['Hind'] font-normal">
            Choose from our powerful tools to streamline your document processing workflow.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.id} className="relative">
              {feature.isActive ? (
                <Link href={feature.href}>
                  <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-[#00C7BE] rounded-xl flex items-center justify-center text-2xl mr-4">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="text-[#0D0D0C] text-[20px] leading-[24px] font-['Urbanist'] font-medium">
                          {feature.title}
                        </h3>
                        <div className="w-8 h-1 bg-[#00C7BE] rounded-full mt-2"></div>
                      </div>
                    </div>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal mb-6">
                      {feature.description}
                    </p>
                    <div className="flex items-center text-[#00C7BE] font-medium text-sm">
                      <span>Get Started</span>
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8 opacity-60 cursor-not-allowed">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-[#0D0D0C]/20 rounded-xl flex items-center justify-center text-2xl mr-4">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-[#0D0D0C] text-[20px] leading-[24px] font-['Urbanist'] font-medium">
                        {feature.title}
                      </h3>
                      <div className="w-8 h-1 bg-[#0D0D0C]/20 rounded-full mt-2"></div>
                    </div>
                  </div>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal mb-6">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-[#0D0D0C]/40 font-medium text-sm">
                    <span>Coming Soon</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-gradient-to-r from-[#F9FEFE] to-[#EDEDED] rounded-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-[#0D0D0C] text-[32px] leading-[38.4px] font-['Urbanist'] font-normal mb-4">
              Your Account Overview
            </h2>
            <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
              Track your usage and account details
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-[#00C7BE] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-2">
                1
              </h3>
              <p className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">
                Active Features
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-[#086C67] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-2">
                Free
              </h3>
              <p className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">
                Current Plan
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-[#00C7BE] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-2">
                {new Date(user?.created_at || '').toLocaleDateString()}
              </h3>
              <p className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">
                Member Since
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 