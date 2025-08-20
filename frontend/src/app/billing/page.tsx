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

export default function BillingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('free');
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

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'month',
      description: 'Perfect for getting started',
      features: [
        'Up to 10 document processing per month',
        'Basic PDF extraction',
        'Standard support',
        'Export to CSV, JSON'
      ],
      current: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29',
      period: 'month',
      description: 'For professionals and small teams',
      features: [
        'Up to 500 document processing per month',
        'Advanced AI extraction',
        'Priority support',
        'All export formats (CSV, JSON, XLSX, TXT)',
        'API access',
        'Custom parsing rules'
      ],
      current: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '$99',
      period: 'month',
      description: 'For large organizations',
      features: [
        'Unlimited document processing',
        'Advanced AI with custom models',
        '24/7 dedicated support',
        'All export formats',
        'Full API access',
        'Custom integrations',
        'SLA guarantee',
        'On-premise deployment option'
      ],
      current: false
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C7BE] mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <Image
                  src="/images/pandiver-logo.svg"
                  alt="PandiVer"
                  width={120}
                  height={32}
                  className="h-8 w-auto"
                />
              </Link>
            </div>
            <Link 
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-[#00C7BE] transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Billing & Plans</h1>
            <p className="mt-2 text-gray-600">Choose the plan that best fits your needs</p>
          </div>

          {/* Current Plan */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Current Plan</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Free Plan</h3>
                  <p className="text-gray-600">You're currently on the free plan</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">$0<span className="text-sm font-normal text-gray-500">/month</span></div>
                  <p className="text-sm text-gray-500">Next billing: N/A</p>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Usage This Month</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#00C7BE]">3</div>
                  <p className="text-sm text-gray-600">Documents Processed</p>
                  <p className="text-xs text-gray-500">of 10 included</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#086C67]">7</div>
                  <p className="text-sm text-gray-600">Remaining</p>
                  <p className="text-xs text-gray-500">this month</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">30%</div>
                  <p className="text-sm text-gray-600">Usage</p>
                  <p className="text-xs text-gray-500">of monthly limit</p>
                </div>
              </div>
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] h-2 rounded-full" style={{width: '30%'}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div 
                  key={plan.id}
                  className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 ${
                    plan.current 
                      ? 'border-[#00C7BE] ring-2 ring-[#00C7BE]/20' 
                      : 'border-gray-200 hover:border-[#00C7BE]/50'
                  }`}
                >
                  <div className="p-6">
                    {plan.current && (
                      <div className="mb-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#00C7BE] text-white">
                          Current Plan
                        </span>
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="text-gray-600">{plan.description}</p>
                    </div>
                    <div className="mb-6">
                      <div className="text-3xl font-bold text-gray-900">
                        {plan.price}
                        <span className="text-lg font-normal text-gray-500">/{plan.period}</span>
                      </div>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <svg className="w-5 h-5 text-[#00C7BE] mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                        plan.current
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white hover:shadow-lg'
                      }`}
                      disabled={plan.current}
                      onClick={() => {
                        if (!plan.current) {
                          alert('Upgrade functionality will be implemented soon!');
                        }
                      }}
                    >
                      {plan.current ? 'Current Plan' : 'Upgrade to ' + plan.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Billing History</h2>
            </div>
            <div className="p-6">
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No billing history</h3>
                <p className="text-gray-600">You're currently on the free plan, so there's no billing history to show.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}