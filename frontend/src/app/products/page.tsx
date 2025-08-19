'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function Products() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFFEFC] text-[#0D0D0C]">
      {/* Navbar */}
      <nav className="bg-[#FFFEFC] py-4 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/">
                <Image
                  src="/images/pandiver-logo.svg"
                  alt="PandiVer"
                  width={120}
                  height={31}
                  className="h-8 w-auto"
                />
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <div className="relative">
                <button
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                  className="text-[#00C7BE] font-medium text-base hover:text-[#086C67] transition-colors flex items-center space-x-1"
                >
                  <span>PRODUCTS</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isProductDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-2">
                      <Link
                        href="/products"
                        className="block px-4 py-3 text-[#0D0D0C] hover:bg-[#F9FEFE] hover:text-[#00C7BE] transition-colors border-b border-gray-100"
                        onClick={() => setIsProductDropdownOpen(false)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg flex items-center justify-center">
                            <span className="text-lg">📋</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">All Products</div>
                            <div className="text-xs text-gray-500">Complete product overview</div>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="/dashboard/bank-statement-aws-textract"
                        className="block px-4 py-3 text-[#0D0D0C] hover:bg-[#F9FEFE] hover:text-[#00C7BE] transition-colors"
                        onClick={() => setIsProductDropdownOpen(false)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg flex items-center justify-center">
                            <span className="text-lg">🤖</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">AI Bank Parser</div>
                            <div className="text-xs text-gray-500">Advanced AI-powered table extraction</div>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="/dashboard/form-data-parser"
                        className="block px-4 py-3 text-[#0D0D0C] hover:bg-[#F9FEFE] hover:text-[#00C7BE] transition-colors"
                        onClick={() => setIsProductDropdownOpen(false)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-lg flex items-center justify-center">
                            <span className="text-lg">📋</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">Form Data Parser</div>
                            <div className="text-xs text-gray-500">AI-powered key-value extraction</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <Link href="/pricing" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                PRICING
              </Link>
            </div>
            
            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/auth/login">
                <button className="px-5 py-2 text-[#0D0C05] font-bold text-base bg-transparent border border-[#086C67] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors">
                  LOGIN
                </button>
              </Link>
              <Link href="/auth/signup">
                <button className="relative px-5 py-2 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors" style={{
                  border: '1px solid transparent',
                  backgroundImage: 'linear-gradient(to bottom, #00C7BE, #00C7BE), linear-gradient(to bottom, #BAF9F6, #086C67)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box'
                }}>
                  SIGN UP
                </button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-[#0D0D0C] hover:text-[#00C7BE] transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Close dropdown when clicking outside */}
      {(isProductDropdownOpen || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsProductDropdownOpen(false);
            setIsMobileMenuOpen(false);
          }}
        />
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#BAF9F6] to-[#086C67] py-20 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto text-center">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
              <span className="text-[#0D0D0C] text-sm font-semibold">Complete PDF Processing Suite</span>
            </div>
            
            {/* Main Headline */}
            <div className="space-y-6">
              <h1 className="text-[#0D0D0C] text-[48px] lg:text-[64px] leading-[1.1] font-['Poppins',sans-serif] font-bold tracking-[-0.02em] max-w-4xl mx-auto">
                Choose the Right Tool for Your
                <span className="block bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent">
                  PDF Data Extraction
                </span>
              </h1>
              <p className="text-[#0D0D0C] text-[20px] leading-[30px] font-['Poppins',sans-serif] font-normal max-w-3xl mx-auto">
                From bank statements to complex forms, our AI-powered tools extract structured data from any PDF document with precision and speed.
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center">
              <Link href="/auth/signup">
                <button className="px-10 py-5 text-white font-bold text-xl bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg">
                  Start Free Trial
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="bg-[#FFFEFC] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-16">
            <div className="text-center space-y-6">
              <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Poppins',sans-serif] font-bold tracking-[-0.4px]">
                Our Products
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal max-w-2xl mx-auto">
                Choose the perfect tool for your document processing needs. Each product is designed to handle specific data extraction requirements with maximum accuracy.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* AI Bank Parser */}
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-all duration-300">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7V10H22V7L12 2ZM4 8.5L12 4.5L20 8.5H4Z" />
                        <path d="M3 11H21V21H3V11ZM5 13V19H7V13H5ZM9 13V19H11V13H9ZM13 13V19H15V13H13ZM17 13V19H19V13H17Z" />
                        <path d="M1 21H23V22H1V21Z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[#0D0D0C] text-[28px] leading-[34px] font-['Poppins',sans-serif] font-bold">
                        AI Bank Parser
                      </h3>
                      <p className="text-[#086C67] text-[16px] font-medium">Advanced AI-Powered Table Extraction</p>
                    </div>
                  </div>

                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                    Transform bank statements into structured data with our most advanced AI technology. Perfect for financial analysis, accounting, and compliance reporting.
                  </p>

                  <div className="space-y-4">
                    <h4 className="text-[#0D0D0C] text-[18px] font-semibold">Key Features:</h4>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Automatic transaction detection and categorization</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Multi-page table stitching and boundary detection</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Support for all major bank statement formats</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">99.9% accuracy in date, amount, and description extraction</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center space-x-4 pt-4">
                    <Link href="/dashboard/bank-statement-aws-textract">
                      <button className="px-6 py-3 text-white font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors">
                        Try AI Bank Parser
                      </button>
                    </Link>
                    <span className="text-[#086C67] text-sm font-medium">Free trial available</span>
                  </div>
                </div>
              </div>

              {/* Form Data Parser */}
              <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-all duration-300">
                <div className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-2xl flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 12V14H16V12H8ZM8 16V18H13V16H8Z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[#0D0D0C] text-[28px] leading-[34px] font-['Poppins',sans-serif] font-bold">
                        Form Data Parser
                      </h3>
                      <p className="text-[#086C67] text-[16px] font-medium">AI-Powered Key-Value Extraction</p>
                    </div>
                  </div>

                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                    Extract key-value pairs from forms, invoices, and structured documents. Ideal for processing applications, surveys, and business forms.
                  </p>

                  <div className="space-y-4">
                    <h4 className="text-[#0D0D0C] text-[18px] font-semibold">Key Features:</h4>
                    <ul className="space-y-3">
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Intelligent field recognition and data extraction</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Support for complex form layouts and structures</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Checkbox, radio button, and text field detection</span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-[#00C7BE] mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[#0D0D0C] text-[14px]">Export to JSON, CSV, or structured text formats</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex items-center space-x-4 pt-4">
                    <Link href="/dashboard/form-data-parser">
                      <button className="px-6 py-3 text-white font-bold text-base bg-[#086C67] rounded-[20px] hover:bg-[#00C7BE] transition-colors">
                        Try Form Parser
                      </button>
                    </Link>
                    <span className="text-[#086C67] text-sm font-medium">Free trial available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-gradient-to-b from-[#F3FFFE] to-[#E8F0F0] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-16">
            <div className="text-center space-y-6">
              <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Poppins',sans-serif] font-bold tracking-[-0.4px]">
                Why Choose PandiVer?
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal max-w-2xl mx-auto">
                Experience the difference with our cutting-edge AI technology and user-focused design.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/>
                    <circle cx="9" cy="9" r="1.5"/>
                    <circle cx="15" cy="9" r="1.5"/>
                    <path d="M12 17C14.5 17 16.5 15 16.5 12.5H15C15 14.16 13.66 15.5 12 15.5S9 14.16 9 12.5H7.5C7.5 15 9.5 17 12 17Z"/>
                    <path d="M8 11H16V13H8V11Z"/>
                    <circle cx="12" cy="6" r="1"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[24px] leading-[30px] font-['Poppins',sans-serif] font-bold">
                  AI-Powered Accuracy
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                  Advanced machine learning ensures 99.9% accuracy in data extraction across all document types.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3C9.23 3 6.19 5.95 6 9.66L4.07 12.47C3.98 12.6 4.07 12.77 4.22 12.77H6.14L5.86 13.42C5.82 13.5 5.87 13.6 5.95 13.6H7.24L8.07 15.45C8.13 15.58 8.31 15.58 8.37 15.45L9.2 13.6H10.49C10.57 13.6 10.62 13.5 10.58 13.42L10.3 12.77H12.22C12.37 12.77 12.46 12.6 12.37 12.47L10.44 9.66C10.25 5.95 13.29 3 17.06 3H13Z"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[24px] leading-[30px] font-['Poppins',sans-serif] font-bold">
                  Lightning Fast
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                  Process documents in seconds, not hours. Get your structured data instantly with our optimized engines.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L9.25 4.28L5 3.5L6.5 8.5L2 10L5.5 14L4 19L8.5 17.5L12 23L15.5 17.5L20 19L18.5 14L22 10L17.5 8.5L19 3.5L14.75 4.28L12 1Z"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[24px] leading-[30px] font-['Poppins',sans-serif] font-bold">
                  Multiple Formats
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                  Export to Excel, CSV, JSON, or TXT. Seamless integration with your existing workflows and tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#FFFEFC] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto text-center">
          <div className="space-y-8">
            <div className="space-y-6">
              <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Poppins',sans-serif] font-bold tracking-[-0.4px]">
                Ready to Transform Your Document Processing?
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal max-w-2xl mx-auto">
                Join thousands of users who trust PandiVer for accurate, fast, and reliable PDF data extraction.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/auth/signup">
                <button className="px-8 py-4 text-white font-bold text-lg bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg">
                  Start Free Trial
                </button>
              </Link>
              <Link href="/auth/login">
                <button className="px-8 py-4 text-[#086C67] font-bold text-lg bg-transparent border-2 border-[#086C67] rounded-full hover:bg-[#086C67] hover:text-white transition-colors">
                  Login to Account
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#BAF9F6] to-[#086C67] py-20 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="text-center space-y-8">
            <Link href="/">
              <Image
                src="/images/pandiver-logo.svg"
                alt="PandiVer"
                width={120}
                height={31}
                className="h-8 w-auto mx-auto"
              />
            </Link>
            <div className="flex flex-wrap justify-center items-center space-x-6">
              <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal">© 2025 PandiVer. All rights reserved.</span>
              <Link href="#" className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Privacy Policy</Link>
              <Link href="#" className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}