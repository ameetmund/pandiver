'use client';

import React, { useState } from 'react';

export interface TextBlock {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  page: number;
}

interface PDFUploaderProps {
  onTextBlocksExtracted: (textBlocks: TextBlock[], file: File) => void;
}

export default function PDFUploader({ onTextBlocksExtracted }: PDFUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setUploadStatus('');
      } else {
        setUploadStatus('Please select a PDF file');
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a PDF file first');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading and processing PDF...');

    try {
      // Get authentication token
      const token = localStorage.getItem('accessToken');
      console.log('🔐 Auth token found:', token ? 'Yes' : 'No');
      
      const formData = new FormData();
      formData.append('file', selectedFile);

      let response: Response;
      
      if (token) {
        // Try authenticated endpoint first
        console.log('📤 Attempting authenticated upload...');
        response = await fetch('http://localhost:8000/upload-pdf/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });
        
        if (response.status === 401) {
          console.log('🔓 Authentication failed, trying test endpoint...');
          setUploadStatus('Authentication failed, using test mode...');
          // Fallback to test endpoint
          response = await fetch('http://localhost:8000/upload-pdf-test/', {
            method: 'POST',
            body: formData,
          });
        }
      } else {
        // Use test endpoint if no token
        console.log('📤 No auth token, using test endpoint...');
        setUploadStatus('No authentication, using test mode...');
        response = await fetch('http://localhost:8000/upload-pdf-test/', {
          method: 'POST',
          body: formData,
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const textBlocks: TextBlock[] = await response.json();
      console.log('📊 Extracted text blocks:', textBlocks.length);
      console.log('📋 Sample text blocks:', textBlocks.slice(0, 3));
      
      if (textBlocks.length === 0) {
        console.warn('⚠️ No text blocks extracted from PDF');
        setUploadStatus('⚠️ No text found in PDF. The PDF might be image-based or empty.');
      } else {
        setUploadStatus(`✅ Success! Extracted ${textBlocks.length} text blocks from PDF`);
      }
      
      console.log('📤 Passing to parent component:', textBlocks.length, 'blocks and file:', selectedFile.name);
      onTextBlocksExtracted(textBlocks, selectedFile);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8">
      <h2 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-6">
        📄 Upload PDF File
      </h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-medium mb-4">
            Select PDF File
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="flex-1 px-4 py-3 border border-[#0D0D0C]/20 rounded-xl focus:ring-2 focus:ring-[#00C7BE] focus:border-[#00C7BE] transition-colors text-[#0D0D0C] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className="px-6 py-3 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Processing...' : 'Upload & Extract'}
            </button>
          </div>
        </div>

        {selectedFile && (
          <div className="p-4 bg-[#F9FEFE] border border-[#00C7BE]/20 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#00C7BE] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-medium">
                  {selectedFile.name}
                </p>
                <p className="text-[#0D0D0C]/60 text-[12px] leading-[18px] font-['Hind'] font-normal">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        {uploadStatus && (
          <div className={`p-4 rounded-xl border ${
            uploadStatus.includes('Success') 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : uploadStatus.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-[#F9FEFE] border-[#00C7BE]/20 text-[#0D0D0C]'
          }`}>
            <p className="text-[14px] leading-[21px] font-['Hind'] font-medium">
              {uploadStatus}
            </p>
          </div>
        )}

        {/* Instructions */}
        <div className="border-t border-[#0D0D0C]/10 pt-6">
          <h3 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-medium mb-3">
            📝 Instructions
          </h3>
          <ul className="space-y-2 text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Select a PDF file from your device</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Click "Upload & Extract" to process the file</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Wait for text blocks to be extracted automatically</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Use the PDF viewer to select and organize text blocks</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
} 