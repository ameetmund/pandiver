'use client';

import React from 'react';
import Link from 'next/link';
import DashboardLayout from '../../components/DashboardLayout';

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
    id: 'intelligent-data-parser',
    title: 'Intelligent Data Parser',
    description: 'Combined intelligent table and key-value extraction. Single API call to extract both tabular data and form fields efficiently.',
    icon: '🔶',
    href: '/dashboard/intelligent-data-parser',
    isActive: true
  },
  {
    id: 'pdf-splitter',
    title: 'PDF Page Splitter',
    description: 'Split PDF documents by selecting specific pages. Extract and save individual pages or page ranges as separate PDF files.',
    icon: '📄',
    href: '/dashboard/pdf-splitter',
    isActive: true
  },
  {
    id: 'pdf-compressor',
    title: 'PDF Compressor & Optimizer',
    description: 'Reduce PDF file sizes with multiple compression levels. Optimize images, remove metadata, and achieve up to 70% file size reduction.',
    icon: '📦',
    href: '/dashboard/pdf-compressor-optimizer',
    isActive: true
  },
  {
    id: 'pdf-translator',
    title: 'PDF Translator',
    description: 'Translate PDF documents to multiple languages while preserving formatting. Support for 100+ languages with Azure AI.',
    icon: '🌐',
    href: '/dashboard/pdf-translator',
    isActive: true
  },
  {
    id: 'api-dashboard',
    title: 'API Dashboard',
    description: 'Create API keys, process files programmatically, monitor usage, and download results. Full REST API access to all parsing features.',
    icon: '🚀',
    href: '/dashboard/api',
    isActive: true
  }
];

export default function DashboardPage() {
  return (
    <DashboardLayout title="Dashboard">
      {/* Main Content Area */}
      <div className="p-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to PandiVer!
          </h1>
          <p className="text-gray-600">
            Choose from our powerful tools to streamline your document processing workflow.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 max-w-6xl">
          {features.map((feature) => (
            <Link key={feature.id} href={feature.href}>
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 hover:border-[#00C7BE]/30 group cursor-pointer">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg flex items-center justify-center mr-4">
                    <span className="text-xl">{feature.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#00C7BE] transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-[#00C7BE] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">4</p>
                <p className="text-sm text-gray-600">Active Features</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">Free</p>
                <p className="text-sm text-gray-600">Current Plan</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">Ready</p>
                <p className="text-sm text-gray-600">System Status</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}