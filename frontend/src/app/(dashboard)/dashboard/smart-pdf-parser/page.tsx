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
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [tableData, setTableData] = useState<string[][]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleTextBlocksExtracted = (extractedTextBlocks: TextBlock[], uploadedFile: File) => {
    setTextBlocks(extractedTextBlocks);
    setPdfFile(uploadedFile);
  };

  const handleTableDataChange = (data: string[][]) => {
    setTableData(data);
  };

  return (
    <DragDropProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
        {/* Header Navigation */}
        <header className="bg-white/80 backdrop-blur-sm py-4 px-4 md:px-16 border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-[1312px] mx-auto flex items-center justify-between">
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
        </header>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          {/* Page Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#00C7BE] to-[#086C67] rounded-full mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#086C67] to-[#00C7BE] bg-clip-text text-transparent mb-4">
              Smart PDF Parser
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Upload a PDF, select single or multiple text blocks, drag them to the table, and export your data with our intelligent parsing technology.
            </p>
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
                onTextBlockDrag={(_textBlock) => {/* Text block dragged */}}
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

        </div>
      </div>
    </DragDropProvider>
  );
} 