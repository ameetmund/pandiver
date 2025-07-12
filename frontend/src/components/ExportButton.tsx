import React, { useState } from 'react';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
  data: string[][];
  filename?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({ data, filename = 'table-data' }) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportToXLSX = async () => {
    try {
      setIsExporting(true);
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Convert data to worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // Write file
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (error) {
      console.error('Error exporting to XLSX:', error);
      alert('Error exporting to XLSX. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Convert data to worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // Write file as CSV
      XLSX.writeFile(wb, `${filename}.csv`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Error exporting to CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportViaAPI = async (format: 'xlsx' | 'csv') => {
    try {
      setIsExporting(true);
      
      const response = await fetch('http://localhost:8000/export-data/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: data,
          filename: filename,
          format: format,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Error exporting to ${format.toUpperCase()}:`, error);
      alert(`Error exporting to ${format.toUpperCase()}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = data.some(row => row.some(cell => cell.trim() !== ''));

  return (
    <div className="export-buttons flex gap-2">
      <button
        onClick={exportToXLSX}
        disabled={!hasData || isExporting}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Exporting...
          </>
        ) : (
          <>
            📊 Export XLSX
          </>
        )}
      </button>

      <button
        onClick={exportToCSV}
        disabled={!hasData || isExporting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Exporting...
          </>
        ) : (
          <>
            📄 Export CSV
          </>
        )}
      </button>

      <button
        onClick={() => exportViaAPI('xlsx')}
        disabled={!hasData || isExporting}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Exporting...
          </>
        ) : (
          <>
            ⬇️ Server Export XLSX
          </>
        )}
      </button>

      <button
        onClick={() => exportViaAPI('csv')}
        disabled={!hasData || isExporting}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Exporting...
          </>
        ) : (
          <>
            ⬇️ Server Export CSV
          </>
        )}
      </button>

      {!hasData && (
        <p className="text-sm text-gray-500 flex items-center">
          Add some data to the table to enable export
        </p>
      )}
    </div>
  );
};

export default ExportButton; 