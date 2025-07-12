'use client';

import React, { useState, useEffect } from 'react';
import DragDropProvider from '@/components/common/DragDropProvider';
import PDFUploader from '@/components/pdf/PDFUploader';
import InteractivePDFViewer from '@/components/pdf/InteractivePDFViewer';
import DataTable from '@/components/pdf/DataTable';
import ExportData from '@/components/pdf/ExportData';

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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Smart PDF Parser
            </h1>
            <p className="text-gray-600">
              Upload a PDF, select single or multiple text blocks, drag them to the table, and export your data.
            </p>
          </header>

          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Application Status</h2>
            
            <div className="space-y-4">
              <div>
                <button
                  onClick={testBackend}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Test Backend Connection
                </button>
              </div>
              
              {message && (
                <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                  Backend Response: {message}
                </div>
              )}
            </div>
          </div>

          {/* PDF Upload Section */}
          <div className="mb-6">
            <PDFUploader onTextBlocksExtracted={handleTextBlocksExtracted} />
          </div>

          {/* Main Drag & Drop Section - PDF and Table Side by Side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">✅ What&apos;s Working:</h3>
            <ul className="list-disc list-inside space-y-2 text-blue-800">
              <li>✅ FastAPI backend running on port 8000</li>
              <li>✅ Next.js frontend running on port 3000</li>
              <li>✅ React and TypeScript setup</li>
              <li>✅ Tailwind CSS styling</li>
              <li>✅ react-dnd for drag & drop</li>
              <li>✅ PDF upload and text extraction components</li>
              <li>✅ Interactive table with add/remove rows & columns</li>
              <li>✅ Export functionality (CSV & Excel)</li>
              <li>✅ Enhanced drag & drop with multi-selection and side-by-side layout</li>
            </ul>
            
            <div className="mt-4 p-4 bg-white rounded border-l-4 border-blue-500">
              <h4 className="font-semibold mb-2">Backend API Endpoints:</h4>
              <ul className="text-sm space-y-1">
                <li>• <code>GET /</code> - Health check</li>
                <li>• <code>POST /upload-pdf/</code> - Upload and extract text from PDF</li>
                <li>• <code>POST /export-data/</code> - Export table data to XLSX/CSV</li>
                <li>• <code>GET /docs</code> - API documentation</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">🎉 Ready to Use:</h3>
            <ol className="list-decimal list-inside space-y-2 text-green-800">
              <li>✅ Upload PDF and extract text blocks</li>
              <li>✅ Navigate through PDF pages with enhanced text block visibility</li>
              <li>✅ Single drag: Drag individual text blocks to table cells</li>
              <li>✅ Multi-select: Enable selection mode → drag to select multiple → drag to table</li>
              <li>✅ Organize data in interactive table with custom headers</li>
              <li>✅ Export your data as CSV or Excel files</li>
            </ol>
            <div className="mt-4 p-3 bg-white rounded border-l-4 border-green-500">
              <p className="text-sm font-medium text-green-800">
                💡 <strong>Pro Tip:</strong> Enable &quot;Selection Mode&quot; to drag-select multiple text blocks at once! 
                Selected blocks turn green with checkmarks. Drag any selected block to move all selected text to table cells. 
                Single-block mode still works for individual selections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
} 