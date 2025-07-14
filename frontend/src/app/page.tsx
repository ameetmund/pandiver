'use client';

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

export default function Home() {
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
                        href="/dashboard/smart-pdf-parser"
                        className="block px-4 py-3 text-[#0D0D0C] hover:bg-[#F9FEFE] hover:text-[#00C7BE] transition-colors"
                        onClick={() => setIsProductDropdownOpen(false)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-[#00C7BE] rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium text-sm">Smart PDF Parser</div>
                            <div className="text-xs text-gray-500">Extract and organize PDF data</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <a href="#" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                TEMPLATES
              </a>
              <a href="#" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                PRICING
              </a>
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
                    <div className="mt-2 pl-4">
                      <Link
                        href="/dashboard/smart-pdf-parser"
                        className="block py-2 text-[#0D0D0C] hover:text-[#00C7BE] transition-colors"
                        onClick={() => {
                          setIsProductDropdownOpen(false);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-[#00C7BE] rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium text-sm">Smart PDF Parser</div>
                            <div className="text-xs text-gray-500">Extract and organize PDF data</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
                <a href="#" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                  TEMPLATES
                </a>
                <a href="#" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                  PRICING
                </a>
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
      <section className="bg-gradient-to-b from-[#BAF9F6] to-[#086C67] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-[#0D0D0C] text-[56px] leading-[67.2px] font-['Urbanist'] font-normal tracking-[-0.56px]">
                  Transform Your Workflow with Our Innovative SaaS
                </h1>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                  Experience seamless integration and unparalleled efficiency with our cutting-edge software solution. Join countless satisfied users who have streamlined their processes and boosted productivity.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="px-6 py-[10px] text-[#0D0D0C] font-medium text-base bg-transparent rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors" style={{
                  border: '1px solid transparent',
                  backgroundImage: 'linear-gradient(to bottom, transparent, transparent), linear-gradient(to bottom, #BAF9F6, #086C67)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box'
                }}>
                  TRY NOW
                </button>
              </div>
            </div>
            <div className="flex justify-center">
              <Image
                src="/images/hero-image.png"
                alt="Hero Image"
                width={600}
                height={600}
                className="w-full h-auto max-w-[600px]"
              />
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
                <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">
                  Innovative
                </span>
              </div>
              <div className="space-y-6">
                <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px] max-w-none mx-auto">
                  Transform Your Workflow with Our Solutions
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal max-w-none mx-auto">
                  Our SaaS product streamlines your processes, enhancing productivity and collaboration. Experience seamless integration and user-friendly design.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="text-center space-y-6">
                <div className="w-12 h-12 mx-auto">
                  <Image
                    src="/images/group-work-icon.svg"
                    alt="Group Work"
                    width={48}
                    height={48}
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Urbanist'] font-normal tracking-[-0.32px]">
                  Real-Time Collaboration Made Effortless
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                  Work together in real-time, no matter where you are.
                </p>
              </div>
              
              <div className="text-center space-y-6">
                <div className="w-12 h-12 mx-auto">
                  <Image
                    src="/images/analytics-icon.svg"
                    alt="Analytics"
                    width={48}
                    height={48}
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Urbanist'] font-normal tracking-[-0.32px]">
                  Advanced Analytics for Informed Decisions
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                  Leverage data insights to drive your strategy.
                </p>
              </div>
              
              <div className="text-center space-y-6">
                <div className="w-12 h-12 mx-auto">
                  <Image
                    src="/images/dashboard-customize-icon.svg"
                    alt="Dashboard Customize"
                    width={48}
                    height={48}
                    className="w-full h-full"
                  />
                </div>
                <h3 className="text-[#0D0D0C] text-[32px] leading-[41.6px] font-['Urbanist'] font-normal tracking-[-0.32px]">
                  Customizable Features to Fit Your Needs
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                  Tailor our tools to match your unique requirements.
                </p>
              </div>
            </div>
            
            <div className="flex justify-center items-center space-x-6">
              <button className="px-6 py-[10px] text-[#0D0D0C] font-medium text-base bg-transparent border border-[#0D0D0C] rounded-[20px] hover:bg-[#0D0D0C] hover:text-white transition-colors">
                Explore
              </button>
              <button className="flex items-center space-x-2 text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                <span>Get Started</span>
                <Image
                  src="/images/chevron-right-icon.svg"
                  alt="Chevron Right"
                  width={24}
                  height={24}
                />
              </button>
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
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">
                    Empower
                  </span>
                </div>
                <div className="space-y-6">
                  <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px]">
                    Unlock Your Potential with Our SaaS Solution
                  </h2>
                  <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                    Experience seamless integration and unparalleled efficiency. Our platform is designed to streamline your workflow and enhance productivity.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="w-12 h-12">
                      <Image
                        src="/images/automation-icon.svg"
                        alt="Automation"
                        width={48}
                        height={48}
                        className="w-full h-full"
                      />
                    </div>
                    <h3 className="text-[#0D0D0C] text-[20px] leading-[28px] font-['Urbanist'] font-normal tracking-[-0.2px]">
                      Boost Efficiency
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                      Automate tasks and save time with our intuitive tools and features.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="w-12 h-12">
                      <Image
                        src="/images/share-location-icon.svg"
                        alt="Share Location"
                        width={48}
                        height={48}
                        className="w-full h-full"
                      />
                    </div>
                    <h3 className="text-[#0D0D0C] text-[20px] leading-[28px] font-['Urbanist'] font-normal tracking-[-0.2px]">
                      Enhance Collaboration
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                      Work together effortlessly with real-time updates and shared resources.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-6">
                <button className="px-6 py-[10px] text-[#0D0D0C] font-medium text-base bg-transparent border border-[#0D0D0C] rounded-[20px] hover:bg-[#0D0D0C] hover:text-white transition-colors">
                  Learn More
                </button>
                <button className="flex items-center space-x-2 text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                  <span>Sign Up</span>
                  <Image
                    src="/images/chevron-right-icon.svg"
                    alt="Chevron Right"
                    width={24}
                    height={24}
                  />
                </button>
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
                <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Urbanist'] font-normal tracking-[-0.4px]">
                  Discover how our SaaS product transforms businesses with proven results.
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                  Join thousands of satisfied users who trust our platform. Experience seamless integration and unparalleled support.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px]">
                      95%
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                      Customer satisfaction rate based on recent surveys.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px]">
                      99.9%
                    </h3>
                    <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                      Uptime guarantee ensuring reliability and performance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="bg-gradient-to-b from-[#F9FEFE] to-[#EDEDED] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">
                  Blog
                </span>
              </div>
              <div className="space-y-6">
                <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px]">
                  Explore Our Latest Insights
                </h2>
                <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                  Stay updated with PDF editing tips and tricks
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg overflow-hidden">
                <Image
                  src="/images/blog-image-1.png"
                  alt="Blog Image 1"
                  width={405}
                  height={270}
                  className="w-full h-[270px] object-cover rounded-t-[20px]"
                />
                <div className="p-8 space-y-2">
                  <div className="inline-block">
                    <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold bg-gray-100 px-3 py-1 rounded">
                      Tips
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Urbanist'] font-normal tracking-[-0.24px]">
                    Mastering PDF Editing: A Comprehensive Guide
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Learn essential techniques to enhance your PDF editing skills today.
                  </p>
                </div>
                <div className="p-8 pt-0">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold">Jane Doe</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">11 Jan 2022</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">5 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg overflow-hidden">
                <div className="w-full h-[270px] bg-gray-200 rounded-t-[16px]"></div>
                <div className="p-8 space-y-2">
                  <div className="inline-block">
                    <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold bg-gray-100 px-3 py-1 rounded">
                      Tutorial
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Urbanist'] font-normal tracking-[-0.24px]">
                    How to Convert PDFs Effortlessly
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Discover the easiest methods to convert PDFs to various formats.
                  </p>
                </div>
                <div className="p-8 pt-0">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold">John Smith</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">15 Feb 2022</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">4 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg overflow-hidden">
                <div className="w-full h-[270px] bg-gray-200 rounded-t-[16px]"></div>
                <div className="p-8 space-y-2">
                  <div className="inline-block">
                    <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold bg-gray-100 px-3 py-1 rounded">
                      News
                    </span>
                  </div>
                  <h3 className="text-[#0D0D0C] text-[24px] leading-[33.6px] font-['Urbanist'] font-normal tracking-[-0.24px]">
                    Latest Trends in PDF Technology
                  </h3>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Stay informed about the newest advancements in PDF technology.
                  </p>
                </div>
                <div className="p-8 pt-0">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-semibold">Alice Johnson</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">20 Mar 2022</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">•</span>
                        <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">6 min read</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <button className="px-6 py-[10px] text-[#0D0D0C] font-medium text-base bg-transparent border border-[#0D0D0C] rounded-[20px] hover:bg-[#0D0D0C] hover:text-white transition-colors">
                View all
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-[#FFFEFC] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            <div className="text-center space-y-6">
              <h2 className="text-[#0D0D0C] text-[48px] leading-[57.6px] font-['Urbanist'] font-normal tracking-[-0.48px] max-w-[560px] mx-auto">
                Customer testimonials
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal max-w-[560px] mx-auto">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
            </div>
            
            <div className="relative">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-white border border-[#0D0D0C]/15 rounded-2xl p-8 space-y-8">
                  <div className="space-y-12">
                    <div className="w-[120px] h-[48px]">
                      <Image
                        src="/images/placeholder-logo-2.svg"
                        alt="Company Logo"
                        width={120}
                        height={48}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="space-y-6">
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare."
                      </p>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                        <div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Name Surname</div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Position, Company name</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button className="flex items-center space-x-2 text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">
                      <span>Read case study</span>
                      <Image
                        src="/images/chevron-right-icon.svg"
                        alt="Chevron Right"
                        width={24}
                        height={24}
                      />
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border border-[#0D0D0C]/15 rounded-2xl p-8 space-y-8">
                  <div className="space-y-12">
                    <div className="w-[120px] h-[48px]">
                      <Image
                        src="/images/placeholder-logo-1.svg"
                        alt="Company Logo"
                        width={120}
                        height={48}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="space-y-6">
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare."
                      </p>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                        <div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Name Surname</div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Position, Company name</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button className="flex items-center space-x-2 text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">
                      <span>Read case study</span>
                      <Image
                        src="/images/chevron-right-icon.svg"
                        alt="Chevron Right"
                        width={24}
                        height={24}
                      />
                    </button>
                  </div>
                </div>
                
                <div className="bg-white border border-[#0D0D0C]/15 rounded-2xl p-8 space-y-8">
                  <div className="space-y-12">
                    <div className="w-[120px] h-[48px]">
                      <Image
                        src="/images/placeholder-logo-2.svg"
                        alt="Company Logo"
                        width={120}
                        height={48}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="space-y-6">
                      <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. Duis cursus, mi quis viverra ornare."
                      </p>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                        <div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Name Surname</div>
                          <div className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Position, Company name</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button className="flex items-center space-x-2 text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">
                      <span>Read case study</span>
                      <Image
                        src="/images/chevron-right-icon.svg"
                        alt="Chevron Right"
                        width={24}
                        height={24}
                      />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center items-center space-x-2 mt-12">
                <div className="w-2 h-2 bg-[#0D0D0C] rounded-full"></div>
                <div className="w-2 h-2 bg-[#0D0D0C] opacity-20 rounded-full"></div>
                <div className="w-2 h-2 bg-[#0D0D0C] opacity-20 rounded-full"></div>
                <div className="w-2 h-2 bg-[#0D0D0C] opacity-20 rounded-full"></div>
                <div className="w-2 h-2 bg-[#0D0D0C] opacity-20 rounded-full"></div>
                <div className="w-2 h-2 bg-[#0D0D0C] opacity-20 rounded-full"></div>
              </div>
              
              <div className="absolute left-[-28px] top-1/2 transform -translate-y-1/2">
                <button className="w-12 h-12 bg-white border border-[#0D0D0C]/15 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Image
                    src="/images/arrow-back-icon.svg"
                    alt="Previous"
                    width={24}
                    height={24}
                  />
                </button>
              </div>
              
              <div className="absolute right-[-28px] top-1/2 transform -translate-y-1/2">
                <button className="w-12 h-12 bg-white border border-[#0D0D0C]/15 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <Image
                    src="/images/arrow-forward-icon.svg"
                    alt="Next"
                    width={24}
                    height={24}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-b from-[#F9FEFE] to-[#EDEDED] py-28 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="text-center space-y-8">
            <div className="space-y-6">
              <h2 className="text-[#0D0D0C] text-[40px] leading-[48px] font-['Urbanist'] font-normal tracking-[-0.4px]">
                Start Your Free Trial Today
              </h2>
              <p className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-normal">
                Experience the future of SaaS with no commitment.
              </p>
            </div>
            <div className="flex justify-center items-center space-x-4">
              <button className="px-6 py-[10px] text-[#0D0D0C] font-medium text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors">
                Sign Up
              </button>
              <button className="px-6 py-[10px] text-[#FFFFFF] font-medium text-base bg-transparent border border-white/20 rounded-[20px] hover:bg-white/10 transition-colors">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#BAF9F6] to-[#086C67] py-20 px-4 md:px-16">
        <div className="max-w-[1312px] mx-auto">
          <div className="space-y-20">
            {/* Newsletter */}
            <div className="flex flex-col md:flex-row justify-between items-start space-y-6 md:space-y-0 md:space-x-6">
              <div className="space-y-2">
                <h3 className="text-[#0D0D0C] text-[18px] leading-[27px] font-['Hind'] font-semibold">
                  Subscribe to updates
                </h3>
                <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                  Stay informed about our latest news and offers.
                </p>
              </div>
              <div className="bg-white rounded-lg p-1 flex items-center space-x-4 min-w-[400px]">
                <div className="flex-1 flex items-center space-x-4">
                  <div className="flex-1">
                    <input
                      type="email"
                      placeholder="Your email here"
                      className="w-full px-3 py-2 text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal bg-transparent border-none outline-none"
                    />
                  </div>
                  <button className="px-6 py-2 text-[#FFFFFF] font-medium text-base bg-transparent border border-white/20 rounded-[20px] hover:bg-white/10 transition-colors">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-[#0D0D0C] text-[12px] leading-[18px] font-['Hind'] font-normal">
                By subscribing, you agree to our Privacy Policy.
              </p>
            </div>
            
            {/* Footer Links */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-8">
              <div className="space-y-4">
                <div className="w-[84px] h-[36px]">
                  <Image
                    src="/images/footer-logo.svg"
                    alt="Footer Logo"
                    width={84}
                    height={36}
                    className="w-full h-full"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Resources</h4>
                <div className="space-y-2">
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Blog Posts</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Help Center</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Contact Us</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">About Us</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Careers</a>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Company</h4>
                <div className="space-y-2">
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Our Team</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Our Values</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Press Releases</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Investor Relations</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Sustainability</a>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Support</h4>
                <div className="space-y-2">
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">FAQs</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Documentation</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Community Forum</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Feedback</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Live Chat</a>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Legal</h4>
                <div className="space-y-2">
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Privacy Policy</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Terms of Use</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Cookie Policy</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Accessibility</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">User Agreement</a>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-semibold">Follow Us</h4>
                <div className="space-y-2">
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Facebook Page</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Twitter Profile</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">LinkedIn Page</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Instagram Account</a>
                  <a href="#" className="block text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">YouTube Channel</a>
                </div>
              </div>
            </div>
            
            {/* Bottom Section */}
            <div className="space-y-8">
              <div className="h-px bg-[#0D0D0C]/15"></div>
              <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                <div className="flex flex-wrap items-center space-x-6">
                  <span className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">© 2025 Relume. All rights reserved.</span>
                  <a href="#" className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Privacy Policy</a>
                  <a href="#" className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Terms of Service</a>
                  <a href="#" className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal hover:text-[#00C7BE] transition-colors">Cookies Settings</a>
                </div>
                <div className="flex items-center space-x-3">
                  <a href="#" className="w-6 h-6 hover:opacity-80 transition-opacity">
                    <Image
                      src="/images/facebook-icon.svg"
                      alt="Facebook"
                      width={24}
                      height={24}
                      className="w-full h-full"
                    />
                  </a>
                  <a href="#" className="w-6 h-6 hover:opacity-80 transition-opacity">
                    <Image
                      src="/images/instagram-icon.svg"
                      alt="Instagram"
                      width={24}
                      height={24}
                      className="w-full h-full"
                    />
                  </a>
                  <a href="#" className="w-6 h-6 hover:opacity-80 transition-opacity">
                    <Image
                      src="/images/x-icon.svg"
                      alt="X"
                      width={24}
                      height={24}
                      className="w-full h-full"
                    />
                  </a>
                  <a href="#" className="w-6 h-6 hover:opacity-80 transition-opacity">
                    <Image
                      src="/images/linkedin-icon.svg"
                      alt="LinkedIn"
                      width={24}
                      height={24}
                      className="w-full h-full"
                    />
                  </a>
                  <a href="#" className="w-6 h-6 hover:opacity-80 transition-opacity">
                    <Image
                      src="/images/youtube-icon.svg"
                      alt="YouTube"
                      width={24}
                      height={24}
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
