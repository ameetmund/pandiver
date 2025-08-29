'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import KeyValueParser from '../../../components/pdf/KeyValueParser';
import dynamic from 'next/dynamic';

function KeyValueParserPage() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
        await response.json();
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/auth/login';
      }
    };
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00C7BE] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#086C67] font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Image
                src="/images/pandiver-logo.svg"
                alt="PandiVer"
                width={120}
                height={31}
                className="h-8 w-auto"
              />
            </Link>
            
            <div className="flex items-center space-x-6">
              <Link href="/dashboard" className="px-4 py-2 text-[#086C67] font-medium border border-[#086C67] rounded-full hover:bg-[#086C67] hover:text-white transition-all duration-300">
                Dashboard
              </Link>
              <button
                onClick={() => { 
                  localStorage.removeItem('accessToken'); 
                  window.location.href = '/auth/login'; 
                }}
                className="px-6 py-2 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white font-medium rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pb-12">
        <KeyValueParser />
      </div>
    </div>
  );
} 

export default dynamic(() => Promise.resolve(KeyValueParserPage), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-[#00C7BE] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[#086C67] font-semibold">Loading Key Value Parser...</p>
      </div>
    </div>
  )
});