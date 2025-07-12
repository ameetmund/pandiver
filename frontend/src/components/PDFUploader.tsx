'use client';

import React, { useState } from 'react';

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

interface PDFUploaderProps {
  onTextBlocksExtracted: (textBlocks: TextBlock[], pdfFile: File) => void;
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
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:8000/upload-pdf/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const textBlocks: TextBlock[] = await response.json();
      
      setUploadStatus(`✅ Success! Extracted ${textBlocks.length} text blocks from PDF`);
      onTextBlocksExtracted(textBlocks, selectedFile);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">📄 Upload PDF</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="pdf-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Select PDF file
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={isUploading}
          />
        </div>

        {selectedFile && (
          <div className="p-3 bg-gray-50 rounded border">
            <p className="text-sm text-gray-600">
              <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className={`w-full py-2 px-4 rounded font-medium ${
            !selectedFile || isUploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
          }`}
        >
          {isUploading ? 'Processing...' : 'Upload & Extract Text'}
        </button>

        {uploadStatus && (
          <div className={`p-4 rounded border ${
            uploadStatus.includes('✅') 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : uploadStatus.includes('❌')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {uploadStatus}
          </div>
        )}
      </div>
    </div>
  );
} 