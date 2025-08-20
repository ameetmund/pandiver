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

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supportForm, setSupportForm] = useState({
    subject: '',
    category: 'general',
    message: ''
  });
  const [activeTab, setActiveTab] = useState('faq');
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSupportForm({
      ...supportForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement ticket submission logic
    alert('Support ticket functionality will be implemented soon! We will contact you via email.');
    setSupportForm({ subject: '', category: 'general', message: '' });
  };

  const faqs = [
    {
      question: 'How do I upload a PDF for processing?',
      answer: 'Navigate to any of our parsers (AI Bank Parser or Form Data Parser) from the dashboard, then click the upload area or drag and drop your PDF file. The system will automatically process your document.'
    },
    {
      question: 'What file formats are supported?',
      answer: 'Currently, we support PDF files. We can extract data and export it to multiple formats including CSV, JSON, XLSX, and TXT.'
    },
    {
      question: 'How accurate is the AI extraction?',
      answer: 'Our AI Bank Parser achieves 99.9% accuracy for financial documents and bank statements. The accuracy may vary depending on the document quality and format.'
    },
    {
      question: 'Can I export my data in different formats?',
      answer: 'Yes! All processed data can be exported in CSV, JSON, XLSX, and TXT formats. Simply click the export button after processing is complete.'
    },
    {
      question: 'Is there a limit on file size?',
      answer: 'Free accounts can process files up to 10MB. Pro and Enterprise plans support larger files up to 100MB and unlimited respectively.'
    },
    {
      question: 'How long does processing take?',
      answer: 'Most documents are processed within 30-60 seconds. Complex multi-page documents may take up to 2-3 minutes.'
    }
  ];

  const supportCategories = [
    { value: 'general', label: 'General Support' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'billing', label: 'Billing Question' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'bug', label: 'Bug Report' }
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
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Help & Support</h1>
            <p className="mt-2 text-gray-600">Get help with PandiVer or contact our support team</p>
          </div>

          {/* Quick Support Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">FAQ</h3>
              <p className="text-gray-600 text-sm mb-4">Find answers to common questions</p>
              <button 
                onClick={() => setActiveTab('faq')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'faq' 
                    ? 'bg-[#00C7BE] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                View FAQ
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-gray-600 text-sm mb-4">Submit a support ticket</p>
              <button 
                onClick={() => setActiveTab('contact')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'contact' 
                    ? 'bg-[#00C7BE] text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Contact Us
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Documentation</h3>
              <p className="text-gray-600 text-sm mb-4">Browse our guides and tutorials</p>
              <button 
                onClick={() => alert('Documentation will be available soon!')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                View Docs
              </button>
            </div>
          </div>

          {/* Content Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {activeTab === 'faq' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Frequently Asked Questions</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {faqs.map((faq, index) => (
                      <div key={index} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                        <h3 className="text-lg font-medium text-gray-900 mb-3">{faq.question}</h3>
                        <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Contact Support</h2>
                  <p className="text-gray-600">Submit a support ticket and we'll get back to you within 24 hours</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handleSubmitTicket} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                          Subject
                        </label>
                        <input
                          type="text"
                          id="subject"
                          name="subject"
                          value={supportForm.subject}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors"
                          placeholder="Briefly describe your issue"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                          Category
                        </label>
                        <select
                          id="category"
                          name="category"
                          value={supportForm.category}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors"
                        >
                          {supportCategories.map((category) => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={supportForm.message}
                        onChange={handleInputChange}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors"
                        placeholder="Please provide detailed information about your issue..."
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-6 py-3 bg-gradient-to-r from-[#00C7BE] to-[#086C67] text-white rounded-lg hover:shadow-lg transition-all duration-300"
                      >
                        Submit Ticket
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-gradient-to-br from-[#00C7BE]/5 to-[#086C67]/5 rounded-lg p-6 border border-gray-200">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Immediate Help?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Email Support</h4>
                  <p className="text-gray-600">support@pandiver.com</p>
                  <p className="text-sm text-gray-500">Response within 24 hours</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Business Hours</h4>
                  <p className="text-gray-600">Monday - Friday</p>
                  <p className="text-sm text-gray-500">9:00 AM - 6:00 PM EST</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}