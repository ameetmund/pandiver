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
                onTextBlockDrag={(textBlock) => {/* Text block dragged */}}
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