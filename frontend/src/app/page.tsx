'use client';

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Home() {
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Add testimonials scroll functionality
  useEffect(() => {
    const scrollContainer = document.querySelector('#testimonials-scroll-container');
    const prevButton = document.querySelector('#testimonial-prev');
    const nextButton = document.querySelector('#testimonial-next');

    if (scrollContainer && prevButton && nextButton) {
      const scrollDistance = 320; // Width of one testimonial card + gap

      const handlePrevClick = () => {
        scrollContainer.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
      };

      const handleNextClick = () => {
        scrollContainer.scrollBy({ left: scrollDistance, behavior: 'smooth' });
      };

      prevButton.addEventListener('click', handlePrevClick);
      nextButton.addEventListener('click', handleNextClick);

      // Cleanup event listeners
      return () => {
        prevButton.removeEventListener('click', handlePrevClick);
        nextButton.removeEventListener('click', handleNextClick);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFEFC] text-[#0D0D0C]">
      {/* Add CSS to hide scrollbar */}
      <style jsx global>{`
        #testimonials-scroll-container::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#FFFEFC] py-4 px-4 md:px-16 shadow-sm">
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
                  className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors flex items-center space-x-1"
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

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-4">
                <div>
                  <button
                    onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                    className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors flex items-center space-x-1"
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
                    <div className="mt-2 pl-4 space-y-2">
                      <Link
                        href="/products"
                        className="block py-2 text-[#0D0D0C] hover:text-[#00C7BE] transition-colors border-b border-gray-200 pb-3"
                        onClick={() => {
                          setIsProductDropdownOpen(false);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded flex items-center justify-center">
                            <span className="text-sm">📋</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">All Products</div>
                            <div className="text-xs text-gray-500">Complete product overview</div>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="/dashboard/bank-statement-aws-textract"
                        className="block py-2 text-[#0D0D0C] hover:text-[#00C7BE] transition-colors"
                        onClick={() => {
                          setIsProductDropdownOpen(false);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded flex items-center justify-center">
                            <span className="text-sm">🤖</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">AI Bank Parser</div>
                            <div className="text-xs text-gray-500">Advanced AI-powered table extraction</div>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="/dashboard/form-data-parser"
                        className="block py-2 text-[#0D0D0C] hover:text-[#00C7BE] transition-colors"
                        onClick={() => {
                          setIsProductDropdownOpen(false);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded flex items-center justify-center">
                            <span className="text-sm">📋</span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">Form Data Parser</div>
                            <div className="text-xs text-gray-500">AI-powered key-value extraction</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
                <Link href="/pricing" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                  PRICING
                </Link>
                <div className="flex flex-col space-y-3 pt-4">
                  <Link href="/auth/login">
                    <button className="w-full px-5 py-2 text-[#0D0C05] font-bold text-base bg-transparent border border-[#086C67] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors">
                      LOGIN
                    </button>
                  </Link>
                  <Link href="/auth/signup">
                    <button className="w-full relative px-5 py-2 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors" style={{
                      border: '1px solid transparent',
                      backgroundImage: 'linear-gradient(to bottom, #00C7BE, #00C7BE), linear-gradient(to bottom, #BAF9F6, #086C67)',
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box'
                    }}>
                      SIGN UP
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          )}
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
      <section className="bg-gradient-to-br from-[#BAF9F6] to-[#086C67] py-20 px-4 md:px-16 min-h-[90vh] flex items-center">
        <div className="max-w-[1312px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              {/* Badge */}
              <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-[#0D0D0C] text-sm font-semibold">AI-Powered Document Processing</span>
              </div>
              
              {/* Main Headline */}
              <div className="space-y-6">
                <h1 className="text-[#0D0D0C] text-[64px] lg:text-[72px] leading-[1.1] font-['Poppins',sans-serif] font-bold tracking-[-0.02em]">
                  Stop copy-pasting.
                  <span className="block bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent">
                    Extract PDF data
                  </span>
                  <span className="block">in minutes</span>
                </h1>
                <p className="text-[#0D0D0C] text-[20px] leading-[30px] font-['Poppins',sans-serif] font-normal max-w-[600px]">
                  Transform complex PDF documents into structured, analysis-ready data <span className="font-semibold">10× faster</span> by automatically detecting headers, stitching multi-page tables, and exporting to Excel(XLSX), CSV, JSON and TXT
                </p>
              </div>

              {/* CTA Button */}
              <div className="flex justify-start">
                <Link href="/auth/signup">
                  <button className="px-10 py-5 text-white font-bold text-xl bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg">
                    Start free
                  </button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center space-x-8 pt-6">
                <div className="text-center">
                  <div className="text-[#0D0D0C] text-2xl font-bold">5000+</div>
                  <div className="text-[#0D0D0C]/70 text-sm">Documents Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-[#0D0D0C] text-2xl font-bold">99.9%</div>
                  <div className="text-[#0D0D0C]/70 text-sm">Accuracy Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-[#0D0D0C] text-2xl font-bold">10x</div>
                  <div className="text-[#0D0D0C]/70 text-sm">Faster Processing</div>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[650px] lg:max-w-[750px]">
                {/* Floating Cards Animation */}
                <div className="absolute -top-8 -left-8 w-72 h-44 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/60 p-6 transform rotate-[-4deg] hover:rotate-[-1deg] transition-all duration-500 z-20">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7V10H22V7L12 2ZM4 8.5L12 4.5L20 8.5H4Z" />
                        <path d="M3 11H21V21H3V11ZM5 13V19H7V13H5ZM9 13V19H11V13H9ZM13 13V19H15V13H13ZM17 13V19H19V13H17Z" />
                        <path d="M1 21H23V22H1V21Z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded-full mb-2 w-3/4"></div>
                      <div className="h-2 bg-gray-200 rounded-full w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#086C67] font-bold">Bank Statement</span>
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -bottom-6 -right-8 w-72 h-44 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/60 p-6 transform rotate-[6deg] hover:rotate-[3deg] transition-all duration-500 z-20">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 5H3c-1.1 0-2 .9-2 2v9c0 .55.45 1 1 1h1c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h1c.55 0 1-.45 1-1v-3l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm10 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17 12V7H3v9h.76c.55-1.19 1.74-2 3.24-2s2.69.81 3.24 2h1.52c.55-1.19 1.74-2 3.24-2s2.69.81 3.24 2H20v-2h-3z"/>
                        <path d="M18 8l2 3h-3V8h1z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-gradient-to-r from-[#086C67] to-[#00C7BE] rounded-full mb-2"></div>
                      <div className="h-2 bg-gray-200 rounded-full mb-2 w-4/5"></div>
                      <div className="h-2 bg-gray-200 rounded-full w-2/3"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#086C67] font-bold">Logistics Invoice</span>
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <Image
                  src="/images/hero-image.png"
                  alt="AI Document Processing"
                  width={800}
                  height={800}
                  className="w-full h-auto relative z-10 drop-shadow-2xl object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gradient-to-b from-[#F3FFFE] to-[#E8F0F0] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">
                  Powerful Features
                </span>
              </div>
              <div className="space-y-6">
                <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.48px] max-w-none mx-auto">
                  Turn Complex PDFs into Clean Data
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal max-w-none mx-auto">
                  Extract, organize, and export data from any PDF document with precision. Our AI-powered technology handles the complexity so you don't have to.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center space-y-6 flex flex-col">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/>
                    <circle cx="9" cy="9" r="1.5"/>
                    <circle cx="15" cy="9" r="1.5"/>
                    <path d="M12 17C14.5 17 16.5 15 16.5 12.5H15C15 14.16 13.66 15.5 12 15.5S9 14.16 9 12.5H7.5C7.5 15 9.5 17 12 17Z"/>
                    <path d="M8 11H16V13H8V11Z"/>
                    <circle cx="12" cy="6" r="1"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.32px] min-h-[84px] flex items-center justify-center">
                  AI-Powered PDF Processing
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal flex-1">
                  Advanced machine learning algorithms automatically detect and extract text, tables, and data structures from any PDF document.
                </p>
              </div>
              
              <div className="text-center space-y-6 flex flex-col">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM14 7H16V9H18V11H16V13H14V11H12V9H14V7ZM8 7H10V13H8V7ZM8 15H18V17H8V15Z"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.32px] min-h-[84px] flex items-center justify-center">
                  Precise Data Extraction
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal flex-1">
                  Intelligently detect data boundaries, stitch multi-page content, and preserve data relationships for accurate extraction.
                </p>
              </div>
              
              <div className="text-center space-y-6 flex flex-col">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 12V14H16V12H8ZM8 16V18H13V16H8Z"/>
                  </svg>
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.32px] min-h-[84px] flex items-center justify-center">
                  Multiple Export Formats
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal flex-1">
                  Export your extracted data in few clicks to Excel (XLSX), CSV, JSON, or TXT formats for seamless integration with your existing workflows.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Link href="/auth/signup">
                <button className="px-6 py-[10px] text-white font-medium text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors">
                  Try For Free
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase 1 */}
      <section className="bg-[#FFFEFC] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex">
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">
                    Banking Solutions
                  </span>
                </div>
                <div className="space-y-6">
                  <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-normal tracking-[-0.48px]">
                    Transform Bank Statements into Structured Data
                  </h2>
                  <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal">
                    Extract transaction data from bank statements with unprecedented accuracy. Our AI automatically identifies transactions, dates, amounts, and descriptions for seamless financial analysis.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7V10H22V7L12 2ZM4 8.5L12 4.5L20 8.5H4Z" />
                        <path d="M3 11H21V21H3V11ZM5 13V19H7V13H5ZM9 13V19H11V13H9ZM13 13V19H15V13H13ZM17 13V19H19V13H17Z" />
                        <path d="M1 21H23V22H1V21Z" />
                      </svg>
                    </div>
                    <h3 className="text-[#0D0D0C] text-[20px] leading-[28px] font-['Poppins',sans-serif] font-normal tracking-[-0.2px]">
                      Smart Recognition
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                      Automatically identify transaction types, account numbers, and financial patterns with AI-powered recognition.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 11H7V9C7 8.45 7.45 8 8 8S9 8.45 9 9V11ZM13 9V11H11V9C11 8.45 11.45 8 12 8S13 8.45 13 9ZM17 9V11H15V9C15 8.45 15.45 8 16 8S17 8.45 17 9ZM19 3H18V1H16V3H8V1H6V3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z"/>
                      </svg>
                    </div>
                    <h3 className="text-[#0D0D0C] text-[20px] leading-[28px] font-['Poppins',sans-serif] font-normal tracking-[-0.2px]">
                      Precise Extraction
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                      Extract dates, amounts, descriptions, and balance information with 99.9% accuracy across all major bank formats.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-start">
                <Link href="/auth/signup">
                  <button className="px-6 py-[10px] text-white font-medium text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors">
                    Try For Free
                  </button>
                </Link>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Image
                src="/images/feature-image-1.png"
                alt="Feature Image 1"
                width={600}
                height={600}
                className="w-full h-auto max-w-[600px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase 2 */}
      <section className="bg-gradient-to-b from-[#F9FEFE] to-[#EDEDED] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="flex justify-center">
              <Image
                src="/images/feature-image-2.png"
                alt="Feature Image 2"
                width={600}
                height={600}
                className="w-full h-auto max-w-[600px]"
              />
            </div>
            
            <div className="space-y-8">
              <div className="space-y-6">
                <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Poppins',sans-serif] font-normal tracking-[-0.4px]">
                  Trusted by businesses worldwide for accurate PDF data extraction.
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal">
                  Join thousands of users who rely on PandiVer for fast, accurate, and reliable document processing. Our proven track record speaks for itself.
                </p>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-normal tracking-[-0.48px]">
                      50,000+
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                      Documents processed monthly across banking, logistics, and enterprise sectors.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-normal tracking-[-0.48px]">
                      99.9%
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                      Extraction accuracy rate with advanced AI algorithms for financial documents.
                    </p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Link href="/products">
                    <button className="px-8 py-3 text-white font-bold text-base bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-[20px] hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                      Explore Now
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Industry Solutions Section */}
      <section className="bg-gradient-to-b from-[#F9FEFE] to-[#EDEDED] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">
                  Industry Solutions
                </span>
              </div>
              <div className="space-y-6">
                <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-normal tracking-[-0.48px]">
                  Tailored for Every Industry
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal">
                  Discover how leading organizations across different sectors leverage PandiVer for their document processing needs
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Banking & Finance */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="w-full h-[200px] bg-gradient-to-br from-[#00C7BE] to-[#086C67] flex items-center justify-center">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7V10H22V7L12 2ZM4 8.5L12 4.5L20 8.5H4Z" />
                    <path d="M3 11H21V21H3V11ZM5 13V19H7V13H5ZM9 13V19H11V13H9ZM13 13V19H15V13H13ZM17 13V19H19V13H17Z" />
                    <path d="M1 21H23V22H1V21Z" />
                  </svg>
                </div>
                <div className="p-8 space-y-4">
                  <div className="inline-block">
                    <span className="text-[#00C7BE] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-semibold bg-[#F9FEFE] px-3 py-1 rounded">
                      Banking & Finance
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.24px]">
                    Bank Statement Processing
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                    Extract transaction data, account balances, and financial patterns from bank statements with 99.9% accuracy for compliance and analysis.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Transaction categorization</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Multi-page table stitching</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Compliance reporting</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Logistics & Supply Chain */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="w-full h-[200px] bg-gradient-to-br from-[#086C67] to-[#00C7BE] flex items-center justify-center">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 5H3c-1.1 0-2 .9-2 2v9c0 .55.45 1 1 1h1c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h1c.55 0 1-.45 1-1v-3l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm10 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM17 12V7H3v9h.76c.55-1.19 1.74-2 3.24-2s2.69.81 3.24 2h1.52c.55-1.19 1.74-2 3.24-2s2.69.81 3.24 2H20v-2h-3z"/>
                    <path d="M18 8l2 3h-3V8h1z"/>
                  </svg>
                </div>
                <div className="p-8 space-y-4">
                  <div className="inline-block">
                    <span className="text-[#086C67] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-semibold bg-[#F9FEFE] px-3 py-1 rounded">
                      Logistics & Supply Chain
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.24px]">
                    Invoice & Receipt Processing
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                    Automate invoice processing, track shipments, and manage supplier documents for streamlined logistics operations.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#086C67] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Invoice automation</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#086C67] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Shipment tracking</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#086C67] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Supplier management</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Legal & Healthcare */}
              <div className="bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <div className="w-full h-[200px] bg-gradient-to-br from-[#00C7BE] to-[#086C67] flex items-center justify-center">
                  <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 12V14H16V12H8ZM8 16V18H13V16H8Z"/>
                  </svg>
                </div>
                <div className="p-8 space-y-4">
                  <div className="inline-block">
                    <span className="text-[#00C7BE] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-semibold bg-[#F9FEFE] px-3 py-1 rounded">
                      Legal & Healthcare
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Poppins',sans-serif] font-semibold tracking-[-0.24px]">
                    Document & Form Processing
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-normal">
                    Extract data from legal contracts, medical forms, and regulatory documents with precision for compliance and record-keeping.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Contract analysis</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Medical form extraction</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <svg className="w-4 h-4 text-[#00C7BE] mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[#0D0D0C] text-[14px]">Regulatory compliance</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Link href="/products">
                <button className="px-8 py-3 text-white font-medium text-base bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-[20px] hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                  Explore All Solutions
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-[#FFFEFC] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            <div className="text-center space-y-6">
              <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Poppins',sans-serif] font-normal tracking-[-0.48px]">
                What Our Customers Say
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal max-w-2xl mx-auto">
                Join thousands of satisfied users who trust PandiVer for their document processing needs
              </p>
            </div>
            
            <div className="relative">
              <div className="overflow-hidden">
                <div 
                  id="testimonials-scroll-container" 
                  className="flex overflow-x-auto scroll-smooth" 
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none'
                  }}
                >
                  {/* Testimonial 1 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "PandiVer saved me hours of manual work. The accuracy is incredible and the interface is so intuitive. Best investment I've made for my workflow!"
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">S</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Sarah</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 2 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Amazing tool! I process hundreds of bank statements monthly and PandiVer handles them all perfectly. The export feature is a game changer."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">M</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Michael</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 3 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Simply outstanding! The AI recognition is spot on and saves me so much time. I can't imagine going back to manual data entry."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">E</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Emily</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 4 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Incredible accuracy and speed! PandiVer has revolutionized how we handle document processing. Highly recommend to anyone dealing with PDFs."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">D</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">David</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 5 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Perfect solution for our logistics team! Processing invoices is now effortless and error-free. The team loves how easy it is to use."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">J</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Jessica</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 6 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Game-changing technology! Our accounting department saves hours every week thanks to PandiVer's precise extraction capabilities."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">T</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Thomas</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 7 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Exceptional service and results! The interface is intuitive and the accuracy is unmatched. PandiVer has transformed our workflow completely."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">L</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Lisa</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 8 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Brilliant solution for financial document processing. The reliability is outstanding and customer support is always helpful when needed."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#086C67] to-[#00C7BE] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">M</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Mark</div>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial 9 */}
                  <div className="w-80 flex-shrink-0 px-4">
                    <div className="bg-white border border-[#0D0D0C]/10 rounded-2xl p-8 h-full flex flex-col">
                      <div className="flex items-center space-x-1 mb-4">
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Poppins',sans-serif] font-normal mb-6 flex-grow">
                        "Outstanding tool that delivers on its promises! The quality of data extraction is consistently excellent. Highly recommend for any business."
                      </p>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">J</span>
                        </div>
                        <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Jennifer</div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
              
              {/* Navigation arrows */}
              <button 
                id="testimonial-prev" 
                className="absolute left-[-28px] top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white border border-[#0D0D0C]/15 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-lg"
              >
                <svg className="w-6 h-6 text-[#0D0D0C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button 
                id="testimonial-next"
                className="absolute right-[-28px] top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white border border-[#0D0D0C]/15 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors shadow-lg"
              >
                <svg className="w-6 h-6 text-[#0D0D0C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-[#FFFEFC] via-[#F9FEFE] to-[#E8F8F7] py-28 px-4 md:px-16 relative overflow-hidden">
        <div className="max-w-[1312px] mx-auto relative z-10">
          <div className="text-center space-y-12">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
              <span className="text-[#0D0D0C] text-sm font-semibold">✨ Start Processing PDFs in Minutes</span>
            </div>
            
            {/* Main Content */}
            <div className="space-y-8">
              <h2 className="text-[#0D0D0C] text-[48px] lg:text-[56px] leading-[1.1] font-['Poppins',sans-serif] font-bold tracking-[-0.02em] max-w-4xl mx-auto">
                Ready to Transform Your 
                <span className="block bg-gradient-to-r from-[#FFFFFF] to-[#F0FDFD] bg-clip-text text-transparent">
                  Document Processing?
                </span>
              </h2>
              <p className="text-[#0D0D0C] text-[20px] leading-[30px] font-['Poppins',sans-serif] font-normal max-w-3xl mx-auto">
                Join thousands of businesses who trust PandiVer for accurate, fast, and reliable PDF data extraction. No credit card required.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
              <Link href="/auth/signup">
                <button className="px-10 py-5 text-white font-bold text-xl bg-gradient-to-r from-[#086C67] to-[#00C7BE] rounded-full hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 shadow-xl">
                  Start Free Trial
                </button>
              </Link>
              <Link href="/products">
                <button className="px-8 py-4 text-[#0D0D0C] font-bold text-lg bg-white/90 backdrop-blur-sm rounded-full hover:bg-white hover:shadow-lg transition-all duration-300 transform hover:scale-105 border border-white/30">
                  View All Products
                </button>
              </Link>
            </div>

            {/* Features Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 max-w-4xl mx-auto">
              <div className="flex items-center justify-center space-x-3 text-[#0D0D0C]">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">No Credit Card Required</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-[#0D0D0C]">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">99.9% Accuracy Guaranteed</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-[#0D0D0C]">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">Process Files in Seconds</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-[#00C7BE]/20 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-white/5 to-[#00C7BE]/5 rounded-full blur-3xl"></div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#BAF9F6] to-[#086C67] py-12 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-8">
            {/* Main Footer Content */}
            <div className="flex flex-col md:flex-row justify-between items-start space-y-8 md:space-y-0">
              {/* Logo and Description */}
              <div className="space-y-4 max-w-md">
                <div className="w-[84px] h-[36px]">
                  <Image
                    src="/images/pandiver-logo.svg"
                    alt="Pandiver Logo"
                    width={84}
                    height={36}
                    className="w-full h-full"
                  />
                </div>
                <p className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal">
                  Transform your PDFs into structured data effortlessly with our intelligent parsing technology.
                </p>
              </div>
              
              {/* Quick Links */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Product</h4>
                  <div className="space-y-2">
                    <a href="/dashboard" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Dashboard</a>
                    <a href="/pricing" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Pricing</a>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Support</h4>
                  <div className="space-y-2">
                    <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Help Center</a>
                    <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Contact Us</a>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Poppins',sans-serif] font-semibold">Legal</h4>
                  <div className="space-y-2">
                    <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Privacy Policy</a>
                    <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal hover:text-[#00C7BE] transition-colors">Terms of Service</a>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bottom Section */}
            <div className="pt-6 border-t border-[#0D0D0C]/15">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Poppins',sans-serif] font-normal">
                  © 2025 Pandiver. All rights reserved.
                </span>
                
                {/* Social Links */}
                <div className="flex items-center space-x-4">
                  <a href="#" className="w-5 h-5 hover:opacity-80 transition-opacity" aria-label="LinkedIn">
                    <Image
                      src="/images/linkedin-icon.svg"
                      alt="LinkedIn"
                      width={20}
                      height={20}
                      className="w-full h-full"
                    />
                  </a>
                  <a href="#" className="w-5 h-5 hover:opacity-80 transition-opacity" aria-label="X (Twitter)">
                    <Image
                      src="/images/x-icon.svg"
                      alt="X"
                      width={20}
                      height={20}
                      className="w-full h-full"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
