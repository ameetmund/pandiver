'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ManualBankStatementParser from '../../../components/pdf/ManualBankStatementParser';
import dynamic from 'next/dynamic';

function BankStatementParser() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        window.location.href = '/auth/login';
        return;
      }
      try {
        const response = await fetch('http://localhost:8000/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Auth failed');
        const user = await response.json();
        setIsAuthenticated(true);
        setUserName(user.name || 'User');
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    };
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FFFEFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#00C7BE] mx-auto"></div>
          <p className="mt-4 text-[#0D0D0C]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFEFC] text-[#0D0D0C]">
      {/* Header */}
      <nav className="bg-[#FFFEFC] py-4 px-4 md:px-16 border-b border-gray-200">
        <div className="max-w-[1312px] mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <Image
              src="/images/pandiver-logo.svg"
              alt="PandiVer"
              width={120}
              height={31}
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center space-x-4">
            <span className="text-[#0D0D0C] font-medium">Welcome, {userName}</span>
            <button
              onClick={() => { localStorage.removeItem('accessToken'); window.location.href = '/auth/login'; }}
              className="px-4 py-2 text-[#0D0D0C] font-medium border border-[#086C67] rounded-lg hover:bg-[#086C67] hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-[1312px] mx-auto py-8 px-4 md:px-16">
        <div className="mb-8">
          <h1 className="text-[#0D0D0C] text-[32px] font-bold font-['Urbanist'] mb-4">
            Manual Bank Statement Parser
          </h1>
          <p className="text-[#0D0D0C] text-base font-['Hind'] mb-6">
            Extract transaction data with full user control - no AI guessing, exact field preservation.
          </p>
        </div>

        {/* Render new manual parser */}
        <ManualBankStatementParser />
      </div>
    </div>
  );
} 

export default dynamic(() => Promise.resolve(BankStatementParser), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#FFFEFC] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#00C7BE] mx-auto"></div>
        <p className="mt-4 text-[#0D0D0C]">Loading Bank Statement Parser...</p>
      </div>
    </div>
  )
});