'use client';

import React, { useState, useEffect } from 'react';
import DragDropProvider from '@/components/common/DragDropProvider';
import PDFUploader from '@/components/pdf/PDFUploader';
import InteractivePDFViewer from '@/components/pdf/InteractivePDFViewer';
import DataTable from '@/components/pdf/DataTable';
import ExportData from '@/components/pdf/ExportData';
import Link from 'next/link';
import Image from 'next/image';

interface TextBlock {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  page: number;
}

export default function SmartPDFParser() {
  const [message, setMessage] = useState('');
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [tableData, setTableData] = useState<string[][]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const testBackend = async () => {
    try {
      const response = await fetch('http://localhost:8000/');
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Error connecting to backend');
    }
  };

  const handleTextBlocksExtracted = (extractedTextBlocks: TextBlock[], uploadedFile: File) => {
    setTextBlocks(extractedTextBlocks);
    setPdfFile(uploadedFile);
  };

  const handleTableDataChange = (data: string[][]) => {
    setTableData(data);
  };

  return (
    <DragDropProvider>
      <div className="min-h-screen bg-[#FFFEFC]">
        {/* Header Navigation */}
        <header className="bg-[#FFFEFC] py-4 px-4 md:px-16 border-b border-[#0D0D0C]/10">
          <div className="max-w-[1312px] mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/pandiver-logo.svg"
                alt="PandiVer"
                width={120}
                height={31}
                className="h-8 w-auto"
              />
            </Link>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                Dashboard
              </Link>
              <Link href="/" className="text-[#0D0D0C] font-medium text-base hover:text-[#00C7BE] transition-colors">
                Home
              </Link>
            </nav>
          </div>
        </header>

        <div className="max-w-[1312px] mx-auto px-4 md:px-16 py-12">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-[#0D0D0C] text-[56px] leading-[67.2px] font-['Urbanist'] font-normal tracking-[-0.56px] mb-4">
              Smart PDF Parser
            </h1>
            <p className="text-[#0D0D0C] text-[20px] leading-[30px] font-['Hind'] font-normal max-w-2xl mx-auto">
              Upload a PDF, select single or multiple text blocks, drag them to the table, and export your data with our intelligent parsing technology.
            </p>
          </div>

          {/* Status Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8 mb-8">
            <h2 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-6">
              Application Status
            </h2>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={testBackend}
                  className="px-6 py-3 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors"
                >
                  Test Backend Connection
                </button>
              </div>
              
              {message && (
                <div className="p-4 bg-[#F9FEFE] border border-[#00C7BE] text-[#0D0D0C] rounded-xl">
                  <span className="font-medium">Backend Response:</span> {message}
                </div>
              )}
            </div>
          </div>

          {/* PDF Upload Section */}
          <div className="mb-8">
            <PDFUploader onTextBlocksExtracted={handleTextBlocksExtracted} />
          </div>

          {/* Main Processing Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <div className="order-1">
              <InteractivePDFViewer 
                pdfFile={pdfFile} 
                textBlocks={textBlocks}
              />
            </div>
            <div className="order-2">
              <DataTable 
                onDataChange={handleTableDataChange}
                onHeadersChange={setColumnHeaders}
              />
            </div>
          </div>

          {/* Export Section */}
          <div className="mb-8">
            <ExportData tableData={tableData} columnHeaders={columnHeaders} />
          </div>

          {/* Features Info Section */}
          <div className="bg-gradient-to-r from-[#F9FEFE] to-[#EDEDED] rounded-2xl p-8 mb-8">
            <h3 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-6">
              ✅ What's Working
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    FastAPI backend running on port 8000
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Next.js frontend running on port 3001
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    React and TypeScript setup
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Tailwind CSS styling
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    PDF upload and text extraction
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Interactive drag & drop interface
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Dynamic table with add/remove rows
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-[#00C7BE] rounded-full"></div>
                  <span className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">
                    Export functionality (CSV & Excel)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-6 bg-white rounded-xl border border-[#0D0D0C]/10">
              <h4 className="text-[#0D0D0C] text-[18px] leading-[21.6px] font-['Urbanist'] font-medium mb-4">
                Backend API Endpoints
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-[#00C7BE] text-white text-xs font-medium rounded">GET</span>
                    <code className="text-[#0D0D0C] text-sm font-mono">/</code>
                    <span className="text-[#0D0D0C] text-sm">Health check</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-[#086C67] text-white text-xs font-medium rounded">POST</span>
                    <code className="text-[#0D0D0C] text-sm font-mono">/upload-pdf/</code>
                    <span className="text-[#0D0D0C] text-sm">Upload PDF</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-[#086C67] text-white text-xs font-medium rounded">POST</span>
                    <code className="text-[#0D0D0C] text-sm font-mono">/export-data/</code>
                    <span className="text-[#0D0D0C] text-sm">Export data</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 bg-[#00C7BE] text-white text-xs font-medium rounded">GET</span>
                    <code className="text-[#0D0D0C] text-sm font-mono">/docs</code>
                    <span className="text-[#0D0D0C] text-sm">API docs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Instructions */}
          <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8">
            <h3 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-6">
              🎉 How to Use
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-[#00C7BE] text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h4 className="text-[#0D0D0C] text-[18px] leading-[21.6px] font-['Urbanist'] font-medium">Upload PDF</h4>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Upload your PDF file and extract text blocks automatically</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-[#00C7BE] text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h4 className="text-[#0D0D0C] text-[18px] leading-[21.6px] font-['Urbanist'] font-medium">Navigate & Select</h4>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Navigate through PDF pages and select text blocks with enhanced visibility</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-[#00C7BE] text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h4 className="text-[#0D0D0C] text-[18px] leading-[21.6px] font-['Urbanist'] font-medium">Drag & Drop</h4>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Enable selection mode to select multiple blocks or drag individual blocks to table cells</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-[#00C7BE] text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h4 className="text-[#0D0D0C] text-[18px] leading-[21.6px] font-['Urbanist'] font-medium">Organize & Export</h4>
                  <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal">Organize data in the interactive table and export as CSV or Excel files</p>
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-[#F9FEFE] rounded-xl border border-[#00C7BE]/20">
              <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-medium">
                💡 <strong>Pro Tip:</strong> Enable "Selection Mode" to drag-select multiple text blocks at once! 
                Selected blocks turn green with checkmarks. Drag any selected block to move all selected text to table cells.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
} 