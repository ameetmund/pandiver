'use client';

import React, { useState } from 'react';

interface ExportDataProps {
  tableData: string[][];
  columnHeaders?: string[];
}

export default function ExportData({ tableData, columnHeaders }: ExportDataProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [filename, setFilename] = useState<string>('exported_data');

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!tableData || tableData.length === 0) {
      setExportStatus('❌ No data to export. Please add some content to the table first.');
      return;
    }

    // Check if table has any content
    const hasContent = tableData.some(row => 
      row.some(cell => cell.trim().length > 0)
    );

    if (!hasContent) {
      setExportStatus('❌ Table is empty. Please add some content before exporting.');
      return;
    }

    setIsExporting(true);
    setExportStatus(`📤 Exporting as ${format.toUpperCase()}...`);

    try {
      // Include headers in the data if they exist
      const dataWithHeaders = columnHeaders && columnHeaders.length > 0 
        ? [columnHeaders, ...tableData]
        : tableData;
      
      const exportData = {
        data: dataWithHeaders,
        filename: filename || 'exported_data',
        format: format
      };

      const response = await fetch('http://localhost:8000/export-data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus(`✅ Successfully exported as ${filename}.${format}`);
      
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus(`❌ Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      
      // Clear status after 5 seconds
      setTimeout(() => {
        setExportStatus('');
      }, 5000);
    }
  };

  const getDataPreview = () => {
    if (!tableData || tableData.length === 0) {
      return 'No data available';
    }

    const headerCount = columnHeaders && columnHeaders.length > 0 ? 1 : 0;
    const dataRowCount = tableData.length;
    const totalRowCount = headerCount + dataRowCount;
    const columnCount = tableData[0]?.length || 0;
    
    const totalCells = totalRowCount * columnCount;
    const filledCells = tableData.reduce((count, row) => 
      count + row.filter(cell => cell.trim().length > 0).length, 0
    ) + (columnHeaders ? columnHeaders.filter(h => h.trim().length > 0).length : 0);

    const headersText = headerCount > 0 ? ` (${headerCount} header + ${dataRowCount} data rows)` : '';
    return `${totalRowCount} rows${headersText} × ${columnCount} columns (${filledCells}/${totalCells} cells filled)`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">📁 Export Data</h2>
      
      <div className="space-y-4">
        {/* Filename Input */}
        <div>
          <label htmlFor="filename" className="block text-sm font-medium text-gray-700 mb-2">
            Filename (without extension)
          </label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter filename"
            disabled={isExporting}
          />
          <p className="text-xs text-gray-500 mt-1">
            Only letters, numbers, hyphens, and underscores allowed
          </p>
        </div>

        {/* Data Preview */}
        <div className="p-3 bg-gray-50 rounded border">
          <p className="text-sm text-gray-600">
            <strong>Data Preview:</strong> {getDataPreview()}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className={`flex-1 py-2 px-4 rounded font-medium ${
              isExporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'
            }`}
          >
            {isExporting ? 'Exporting...' : '📄 Export as CSV'}
          </button>
          
          <button
            onClick={() => handleExport('xlsx')}
            disabled={isExporting}
            className={`flex-1 py-2 px-4 rounded font-medium ${
              isExporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
            }`}
          >
            {isExporting ? 'Exporting...' : '📊 Export as Excel'}
          </button>
        </div>

        {/* Status Message */}
        {exportStatus && (
          <div className={`p-4 rounded border ${
            exportStatus.includes('✅') 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : exportStatus.includes('❌')
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {exportStatus}
          </div>
        )}

        {/* Export Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• CSV files can be opened in Excel, Google Sheets, or any text editor</p>
          <p>• Excel files (.xlsx) preserve formatting and can be opened in Microsoft Excel</p>
          <p>• Files will be downloaded to your default download folder</p>
        </div>
      </div>
    </div>
  );
} 