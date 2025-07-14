'use client';

import React, { useState } from 'react';

interface ExportDataProps {
  tableData: string[][];
  columnHeaders: string[];
}

export default function ExportData({ tableData, columnHeaders }: ExportDataProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!tableData || tableData.length === 0) {
      setExportStatus('No data to export');
      return;
    }

    setIsExporting(true);
    setExportStatus(`Exporting as ${format.toUpperCase()}...`);

    try {
      // Get authentication token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      // Prepare data with headers
      const exportData = columnHeaders.length > 0 
        ? [columnHeaders, ...tableData]
        : tableData;

      const response = await fetch('http://localhost:8000/export-data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: exportData,
          filename: `exported_data_${new Date().toISOString().split('T')[0]}`,
          format: format
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exported_data_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus(`✅ Successfully exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus(`❌ ${error instanceof Error ? error.message : 'Export failed'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-[#0D0D0C]/10 p-8">
      <h2 className="text-[#0D0D0C] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium mb-6">
        📊 Export Data
      </h2>
      
      <div className="space-y-6">
        <div>
          <p className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-normal mb-4">
            Export your organized data to Excel or CSV format for further analysis.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => handleExport('xlsx')}
              disabled={isExporting || !tableData || tableData.length === 0}
              className="flex-1 px-6 py-3 text-[#FFFFFF] font-bold text-base bg-[#00C7BE] rounded-[20px] hover:bg-[#086C67] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Export to Excel'}</span>
            </button>
            
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting || !tableData || tableData.length === 0}
              className="flex-1 px-6 py-3 text-[#0D0D0C] font-bold text-base bg-transparent border border-[#086C67] rounded-[20px] hover:bg-[#086C67] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Export to CSV'}</span>
            </button>
          </div>
        </div>

        {exportStatus && (
          <div className={`p-4 rounded-xl border ${
            exportStatus.includes('Successfully') 
              ? 'bg-green-50 border-green-200 text-green-700' 
              : exportStatus.includes('❌') 
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-[#F9FEFE] border-[#00C7BE]/20 text-[#0D0D0C]'
          }`}>
            <p className="text-[14px] leading-[21px] font-['Hind'] font-medium">
              {exportStatus}
            </p>
          </div>
        )}

        {/* Data Summary */}
        <div className="border-t border-[#0D0D0C]/10 pt-6">
          <h3 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-medium mb-3">
            📋 Data Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#F9FEFE] border border-[#00C7BE]/20 rounded-xl p-4 text-center">
              <div className="text-[#00C7BE] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium">
                {tableData ? tableData.length : 0}
              </div>
              <div className="text-[#0D0D0C] text-[12px] leading-[18px] font-['Hind'] font-normal">
                Rows
              </div>
            </div>
            <div className="bg-[#F9FEFE] border border-[#00C7BE]/20 rounded-xl p-4 text-center">
              <div className="text-[#00C7BE] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium">
                {columnHeaders.length || (tableData && tableData[0] ? tableData[0].length : 0)}
              </div>
              <div className="text-[#0D0D0C] text-[12px] leading-[18px] font-['Hind'] font-normal">
                Columns
              </div>
            </div>
            <div className="bg-[#F9FEFE] border border-[#00C7BE]/20 rounded-xl p-4 text-center">
              <div className="text-[#00C7BE] text-[24px] leading-[28.8px] font-['Urbanist'] font-medium">
                {tableData ? tableData.reduce((acc, row) => acc + row.filter(cell => cell.trim() !== '').length, 0) : 0}
              </div>
              <div className="text-[#0D0D0C] text-[12px] leading-[18px] font-['Hind'] font-normal">
                Filled Cells
              </div>
            </div>
          </div>
        </div>

        {/* Export Instructions */}
        <div className="border-t border-[#0D0D0C]/10 pt-6">
          <h3 className="text-[#0D0D0C] text-[16px] leading-[24px] font-['Hind'] font-medium mb-3">
            💡 Export Tips
          </h3>
          <ul className="space-y-2 text-[#0D0D0C] text-[14px] leading-[21px] font-['Hind'] font-normal">
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span><strong>Excel (XLSX):</strong> Best for complex data analysis and formatting</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span><strong>CSV:</strong> Universal format, compatible with all spreadsheet applications</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Column headers will be included automatically if defined</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#00C7BE] mt-1">•</span>
              <span>Files are automatically named with today's date</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
} 