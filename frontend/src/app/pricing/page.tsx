'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Check, X } from 'lucide-react';

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: '$0',
      period: 'per month',
      description: 'Perfect for individuals getting started with AI document processing',
      features: [
        '10 document uploads per month',
        'AI Bank Parser access',
        'Form Data Parser access',
        'Basic export formats (CSV, PDF)',
        'Email support',
        '2GB storage',
      ],
      limitations: [
        'Limited to 10 pages per document',
        'No priority processing',
        'No API access',
        'No custom integrations',
      ],
      buttonText: 'Get Started Free',
      buttonStyle: 'border border-[#086C67] text-[#086C67] hover:bg-[#086C67] hover:text-white',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$29',
      period: 'per month',
      description: 'Ideal for businesses and professionals who need enhanced capabilities',
      features: [
        '500 document uploads per month',
        'All AI parsing tools',
        'Advanced export formats (XLSX, JSON)',
        'Priority processing',
        'API access (10,000 calls/month)',
        '50GB storage',
        'Custom field selection',
        'Batch processing',
        'Priority email support',
      ],
      limitations: [
        'Limited to 100 pages per document',
        'No white-label options',
      ],
      buttonText: 'Start Professional',
      buttonStyle: 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white hover:shadow-lg transform hover:scale-105',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'pricing',
      description: 'Comprehensive solution for large organizations with custom requirements',
      features: [
        'Unlimited document uploads',
        'All AI parsing tools',
        'All export formats',
        'Highest priority processing',
        'Unlimited API access',
        'Unlimited storage',
        'Custom integrations',
        'White-label options',
        'Dedicated account manager',
        'Custom training & onboarding',
        '24/7 phone & email support',
        'SLA guarantees',
        'Advanced analytics & reporting',
      ],
      limitations: [],
      buttonText: 'Contact Sales',
      buttonStyle: 'border border-[#086C67] text-[#086C67] hover:bg-[#086C67] hover:text-white',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-sm py-4 px-4 md:px-16 border-b border-gray-200">
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
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="px-4 py-2 text-[#086C67] font-medium border border-[#086C67] rounded-full hover:bg-[#086C67] hover:text-white transition-all duration-300"
              >
                Back to Home
              </Link>
              <Link href="/auth/login">
                <button className="px-5 py-2 text-[#0D0C05] font-bold text-base bg-transparent border border-[#086C67] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors">
                  LOGIN
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="py-16 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-6">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            Unlock the power of AI-driven document processing with plans designed for every need
          </p>
          <p className="text-gray-500 mb-8">
            Start free, upgrade as you grow. No hidden fees, cancel anytime.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="pb-16 px-4 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`relative bg-white rounded-3xl shadow-xl border p-8 transition-all duration-300 hover:shadow-2xl ${
                  plan.popular 
                    ? 'border-[#00C7BE] ring-2 ring-[#00C7BE]/20 scale-105' 
                    : 'border-gray-200 hover:border-[#00C7BE]/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white px-6 py-2 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-gray-500 ml-2">{plan.period}</span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{plan.description}</p>
                </div>

                <div className="mb-8">
                  <button className={`w-full py-3 px-6 rounded-full font-semibold transition-all duration-300 ${plan.buttonStyle}`}>
                    {plan.buttonText}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-gray-200 pb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">What's included:</h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                          <span className="text-gray-600 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {plan.limitations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Limitations:</h4>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, limitationIndex) => (
                          <li key={limitationIndex} className="flex items-start">
                            <X className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                            <span className="text-gray-500 text-sm">{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Comparison */}
      <div className="py-16 px-4 md:px-16 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              Feature Comparison
            </h2>
            <p className="text-gray-600">
              Compare plans side by side to find the perfect fit for your needs
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-lg overflow-hidden">
              <thead className="bg-gradient-to-r from-[#00C7BE]/10 to-[#086C67]/10">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Features</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Starter</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Professional</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { feature: 'Document uploads/month', starter: '10', professional: '500', enterprise: 'Unlimited' },
                  { feature: 'AI Bank Parser', starter: '✓', professional: '✓', enterprise: '✓' },
                  { feature: 'Form Data Parser', starter: '✓', professional: '✓', enterprise: '✓' },
                  { feature: 'API access', starter: '✗', professional: '10K calls/month', enterprise: 'Unlimited' },
                  { feature: 'Storage', starter: '2GB', professional: '50GB', enterprise: 'Unlimited' },
                  { feature: 'Priority processing', starter: '✗', professional: '✓', enterprise: '✓' },
                  { feature: 'Custom integrations', starter: '✗', professional: '✗', enterprise: '✓' },
                  { feature: 'White-label options', starter: '✗', professional: '✗', enterprise: '✓' },
                  { feature: 'Support', starter: 'Email', professional: 'Priority Email', enterprise: '24/7 Phone & Email' },
                ].map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium text-gray-900">{row.feature}</td>
                    <td className="py-4 px-6 text-center text-gray-600">{row.starter}</td>
                    <td className="py-4 px-6 text-center text-gray-600">{row.professional}</td>
                    <td className="py-4 px-6 text-center text-gray-600">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 px-4 md:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                question: 'Can I change my plan at any time?',
                answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any billing differences.',
              },
              {
                question: 'What payment methods do you accept?',
                answer: 'We accept all major credit cards (Visa, MasterCard, American Express) and PayPal. Enterprise customers can also pay via wire transfer.',
              },
              {
                question: 'Is there a setup fee?',
                answer: 'No, there are no setup fees for any of our plans. You only pay the monthly subscription fee.',
              },
              {
                question: 'What happens to my data if I cancel?',
                answer: 'Your data is retained for 30 days after cancellation, giving you time to export it. After 30 days, it\'s permanently deleted from our servers.',
              },
              {
                question: 'Do you offer discounts for annual payments?',
                answer: 'Yes, we offer a 20% discount when you pay annually. Contact our sales team for enterprise annual pricing.',
              },
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{faq.question}</h3>
                <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 px-4 md:px-16 bg-gradient-to-r from-[#00C7BE]/10 to-[#086C67]/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
            Ready to Transform Your Document Processing?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of satisfied users who trust PandiVer for their AI document processing needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <button className="px-8 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white font-semibold rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                Start Free Trial
              </button>
            </Link>
            <Link href="/auth/login">
              <button className="px-8 py-3 border border-[#086C67] text-[#086C67] font-semibold rounded-full hover:bg-[#086C67] hover:text-white transition-all duration-300">
                View Demo
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto text-center">
          <Link href="/" className="inline-block mb-4">
            <Image
              src="/images/pandiver-logo.svg"
              alt="PandiVer"
              width={120}
              height={31}
              className="h-8 w-auto"
            />
          </Link>
          <p className="text-gray-600 text-sm">
            © 2024 PandiVer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}