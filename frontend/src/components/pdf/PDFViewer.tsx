import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker only in browser environment
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.1.392/pdf.worker.min.js`;
}

export interface TextBlock {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  page: number;
  id: string;
}

interface PDFViewerProps {
  pdfFile: File | null;
  textBlocks: TextBlock[];
  selectedBlocks: TextBlock[];
  onBlockSelect: (block: TextBlock) => void;
  onPDFLoad: (file: File) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfFile,
  textBlocks,
  selectedBlocks,
  onBlockSelect,
  onPDFLoad
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageRendered, setPageRendered] = useState(false);

  // Load PDF when file changes
  useEffect(() => {
    if (pdfFile) {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const pdf = await pdfjsLib.getDocument({
              data: e.target.result
            }).promise;
            setPdfDoc(pdf);
            setCurrentPage(1);
            setPageRendered(false);
          } catch (error) {
            console.error('Error loading PDF:', error);
          }
        }
      };
      fileReader.readAsArrayBuffer(pdfFile);
    }
  }, [pdfFile]);

  const renderPage = useCallback(async (pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      setPageRendered(true);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdfDoc, scale]);

  // Render PDF page
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, renderPage]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onPDFLoad(file);
    }
  };

  const handleBlockClick = (block: TextBlock) => {
    onBlockSelect(block);
  };

  const isBlockSelected = (block: TextBlock) => {
    return selectedBlocks.some(selected => selected.id === block.id);
  };

  const getPageTextBlocks = () => {
    return textBlocks.filter(block => block.page === currentPage);
  };

  return (
    <div className="pdf-viewer-container">
      <div className="controls mb-4 p-4 bg-gray-100 rounded">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="mb-2 p-2 border rounded"
        />
        
        {pdfDoc && (
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Previous
            </button>
            
            <span className="text-sm">
              Page {currentPage} of {pdfDoc.numPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(pdfDoc.numPages, currentPage + 1))}
              disabled={currentPage >= pdfDoc.numPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Next
            </button>
            
            <div className="flex items-center gap-2">
              <label className="text-sm">Zoom:</label>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="p-1 border rounded"
              >
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1.0">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2.0">200%</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="pdf-container relative border border-gray-300 overflow-auto max-h-[600px]">
        <canvas
          ref={canvasRef}
          className="block max-w-full h-auto"
        />
        
        {pageRendered && (
          <div
            ref={overlayRef}
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: canvasRef.current?.width || 0,
              height: canvasRef.current?.height || 0,
            }}
          >
            {getPageTextBlocks().map((block) => (
              <div
                key={block.id}
                className={`absolute cursor-pointer pointer-events-auto transition-all duration-200 ${
                  isBlockSelected(block)
                    ? 'bg-yellow-200 border-2 border-black'
                    : 'hover:bg-blue-100 hover:border border-blue-300'
                }`}
                style={{
                  left: block.x0 * scale,
                  top: block.y0 * scale,
                  width: block.width * scale,
                  height: block.height * scale,
                  opacity: isBlockSelected(block) ? 0.8 : 0.3,
                }}
                onClick={() => handleBlockClick(block)}
                title={block.text}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h3 className="text-lg font-semibold mb-2">Selected Text Blocks:</h3>
        <div className="max-h-32 overflow-y-auto">
          {selectedBlocks.length === 0 ? (
            <p className="text-gray-500">No blocks selected</p>
          ) : (
            selectedBlocks.map((block) => (
              <div
                key={block.id}
                className="p-2 mb-1 bg-white border rounded text-sm"
              >
                <span className="font-medium">Page {block.page}:</span> {block.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer; 