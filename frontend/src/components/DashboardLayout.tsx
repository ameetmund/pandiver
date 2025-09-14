'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { pixelifySans } from '../lib/fonts';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface SidebarItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  href: string;
  isActive: boolean;
  badge?: string;
  subItems?: {
    id: string;
    title: string;
    href: string;
  }[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    href: '/dashboard',
    isActive: true
  },
  {
    id: 'api',
    title: 'API',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    href: '/dashboard/api',
    isActive: true,
    badge: 'New',
    subItems: [
      {
        id: 'api-intelligent-data-parser',
        title: 'Intelligent Data Parser',
        href: '/dashboard/api/intelligent-data-parser'
      },
      {
        id: 'api-pdf-splitter',
        title: 'PDF Page Splitter',
        href: '/dashboard/api/pdf-splitter'
      },
      {
        id: 'api-pdf-translator',
        title: 'PDF Translator',
        href: '/dashboard/api/pdf-translator'
      }
    ]
  },
  {
    id: 'intelligent-data-parser',
    title: 'Intelligent Data Parser',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    href: '/dashboard/intelligent-data-parser',
    isActive: true,
    badge: 'Combined'
  },
  {
    id: 'pdf-splitter',
    title: 'PDF Page Splitter',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/dashboard/pdf-splitter',
    isActive: true
  },
  {
    id: 'pdf-translator',
    title: 'PDF Translator',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    href: '/dashboard/pdf-translator',
    isActive: true
  }
];

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['api']));
  const router = useRouter();
  const pathname = usePathname();

  const toggleExpandedItem = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  useEffect(() => {
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

  // Auto-expand API menu when user is on a sub-page
  useEffect(() => {
    if (pathname.startsWith('/dashboard/api/') && pathname !== '/dashboard/api') {
      setExpandedItems(prev => new Set(prev).add('api'));
    }
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (userDropdownOpen && !target.closest('[data-dropdown="user-menu"]')) {
        setUserDropdownOpen(false);
      }
    };

    if (userDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [userDropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/');
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

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
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 shadow-xl transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        
        {/* Logo */}
        <div className="h-16 flex items-center justify-center px-4 border-b border-slate-200/50">
          {sidebarCollapsed ? (
            <span className={`text-[#00C7BE] font-bold text-5xl ${pixelifySans.className}`}>
              V
            </span>
          ) : (
            <Image
              src="/images/pandiver-logo.svg"
              alt="PandiVer"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 relative">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            const isExpanded = expandedItems.has(item.id);
            const hasSubItems = item.subItems && item.subItems.length > 0;
            
            // Check if any sub-item is active
            const hasActiveSubItem = hasSubItems && item.subItems!.some(subItem => pathname === subItem.href);
            const shouldHighlight = isActive || hasActiveSubItem;
            
            return (
              <div key={item.id} className="space-y-1">
                {/* Main item */}
                <div className="flex items-center">
                  <Link
                    href={item.href}
                    className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex-1 ${
                      shouldHighlight 
                        ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white shadow-md' 
                        : 'text-slate-700 hover:bg-white/50 hover:text-slate-900'
                    } ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}
                    onClick={(e) => {
                      if (hasSubItems && !sidebarCollapsed) {
                        // For items with subitems, first click expands, second click navigates
                        if (!isExpanded) {
                          e.preventDefault();
                          toggleExpandedItem(item.id);
                        } else {
                          // Allow navigation to main item when expanded
                          setMobileMenuOpen(false);
                        }
                      } else {
                        setMobileMenuOpen(false);
                      }
                    }}
                  >
                    <span className={`${sidebarCollapsed ? '' : 'mr-3'}`}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded-full font-semibold mr-2">
                            {item.badge}
                          </span>
                        )}
                        {hasSubItems && (
                          <svg 
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </>
                    )}
                  </Link>
                </div>
                
                {/* Sub-items */}
                {hasSubItems && isExpanded && !sidebarCollapsed && (
                  <div className="ml-8 space-y-1">
                    {item.subItems!.map((subItem) => {
                      const subIsActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.id}
                          href={subItem.href}
                          className={`flex items-center px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                            subIsActive 
                              ? 'bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white shadow-sm' 
                              : 'text-slate-600 hover:bg-white/30 hover:text-slate-800'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <span className="w-2 h-2 bg-current rounded-full mr-3 opacity-60"></span>
                          {subItem.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 items-center justify-center w-6 h-12 bg-white border border-slate-200 rounded-r-lg shadow-lg hover:bg-slate-50 transition-all duration-200`}
          style={{ right: '-12px' }}
        >
          {sidebarCollapsed ? (
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>

        {/* User Profile in Sidebar (Mobile) */}
        {!sidebarCollapsed && (
          <div className="lg:hidden border-t border-slate-200/50 p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {getInitials(user?.name || '')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} flex flex-col h-screen`}>
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page Title */}
          <div className="hidden lg:block">
            <h1 className="text-xl font-semibold text-gray-900">{title || 'Dashboard'}</h1>
          </div>

          {/* User Menu */}
          <div className="relative" data-dropdown="user-menu">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full flex items-center justify-center">
                <span className="text-white font-normal" style={{ fontSize: '18px' }}>
                  {getInitials(user?.name || '')}
                </span>
              </div>
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* User Dropdown */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                
                <Link 
                  href="/profile" 
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile Settings
                </Link>
                
                <Link 
                  href="/billing" 
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Billing & Plans
                </Link>
                
                <Link 
                  href="/support" 
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Help & Support
                </Link>
                
                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}