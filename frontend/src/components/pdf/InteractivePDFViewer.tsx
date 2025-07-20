'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useDrag } from 'react-dnd';
import dynamic from 'next/dynamic';

// Dynamically import PDF.js to avoid SSR issues
let pdfjsLib: any = null;
let initializationPromise: Promise<any> | null = null;

if (typeof window !== 'undefined') {
  console.log('🔧 Initializing PDF.js library...');
  initializationPromise = import('pdfjs-dist').then(async (pdfjs) => {
    console.log('📚 PDF.js imported successfully, version:', pdfjs.version);
    
    // Try multiple worker sources for better compatibility
    const workerSources = [
      // Local worker (preferred)
      '/static/pdf.worker.min.mjs',
      // CDN fallbacks with different extensions
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`,
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`,
      // Fallback to a known working version
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    ];
    
    for (const workerSrc of workerSources) {
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        console.log('👷 Trying PDF.js worker:', workerSrc);
        
        // Test worker by creating a simple document
        await pdfjs.getDocument({ data: new Uint8Array([]) }).promise.catch(() => {
          // This will fail but tells us if the worker loads
        });
        
        console.log('✅ PDF.js worker configured successfully:', workerSrc);
        break;
      } catch (error) {
        console.warn('⚠️ Worker failed:', workerSrc, error.message);
        continue;
      }
    }
    
    pdfjsLib = pdfjs;
    return pdfjs;
  }).catch((error) => {
    console.error('❌ Failed to import PDF.js:', error);
    throw error;
  });
}

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

interface InteractivePDFViewerProps {
  pdfFile: File | null;
  textBlocks: TextBlock[];
  onTextBlockDrag?: (textBlock: TextBlock) => void;
}

interface DraggableTextBlockProps {
  textBlock: TextBlock;
  scale: number;
  isSelected: boolean;
  selectionMode: boolean;
  selectedBlocks: TextBlock[];
  onDragStart?: () => void;
}

// Draggable text block component
function DraggableTextBlock({ textBlock, scale, isSelected, selectionMode, selectedBlocks, onDragStart }: DraggableTextBlockProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'textBlock',
    item: () => {
      onDragStart?.();
      
      // If in selection mode and this block is selected, drag all selected blocks
      if (selectionMode && isSelected && selectedBlocks.length > 1) {
        console.log('🚀 Creating multi-block drag item');
        const dragItem = {
          type: 'multipleBlocks',
          blocks: selectedBlocks,
          text: selectedBlocks.map(b => b.text).join('\n')
        };
        console.log('📦 Multi-block drag item:', dragItem);
        return dragItem;
      }
      
      // Single block drag
      return textBlock;
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [textBlock, onDragStart, selectionMode, isSelected, selectedBlocks]);

  return (
    <div
      ref={drag as any}
      className={`draggable-text-block absolute cursor-grab active:cursor-grabbing transition-all duration-200 group ${
        isDragging ? 'opacity-70 scale-105 z-50' : 
        isSelected ? 'shadow-lg' : 'hover:shadow-lg'
      }`}
      style={{
        left: textBlock.x0 * scale - 2,
        top: textBlock.y0 * scale - 2,
        width: Math.max(textBlock.width * scale, 40) + 4,
        height: Math.max(textBlock.height * scale, 18) + 4,
        backgroundColor: isDragging 
          ? 'rgba(59, 130, 246, 0.3)' 
          : isSelected 
          ? 'rgba(34, 197, 94, 0.2)' 
          : 'transparent',
        border: isDragging 
          ? '3px solid rgba(59, 130, 246, 0.8)' 
          : isSelected
          ? '3px solid rgba(34, 197, 94, 0.8)'
          : '2px dashed rgba(59, 130, 246, 0.7)',
        borderRadius: '4px',
        zIndex: isDragging ? 1000 : isSelected ? 20 : 10,
        boxShadow: isDragging 
          ? '0 4px 12px rgba(59, 130, 246, 0.3)' 
          : isSelected 
          ? '0 2px 8px rgba(34, 197, 94, 0.3)' 
          : 'none',
      }}
      title={`"${textBlock.text}" - ${isSelected ? 'SELECTED - ' : ''}Click and drag to table`}
    >
      {/* Tooltip that appears on hover */}
      <div className={`absolute -top-8 left-0 px-2 py-1 text-white text-xs rounded shadow-lg z-20 max-w-xs truncate transition-opacity duration-200 pointer-events-none ${
        isSelected ? 'bg-green-600' : 'bg-blue-600'
      } ${
        isDragging || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {selectionMode && selectedBlocks.length > 1 && isSelected 
          ? `${selectedBlocks.length} blocks selected: ${textBlock.text}` 
          : textBlock.text
        }
      </div>
      
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
          ✓
        </div>
      )}
      
      {/* Small indicator dot for very small text blocks */}
      <div className={`absolute top-1 left-1 w-2 h-2 rounded-full transition-opacity duration-200 ${
        isSelected ? 'bg-green-500' : 'bg-blue-500'
      } ${
        isDragging || isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
      }`} />
    </div>
  );
}

export default function InteractivePDFViewer({ pdfFile, textBlocks, onTextBlockDrag }: InteractivePDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pageRendered, setPageRendered] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState<TextBlock | null>(null);
  const [pdfJsReady, setPdfJsReady] = useState(false);
  
  // Multi-selection state
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{x: number, y: number} | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Wait for PDF.js initialization
  useEffect(() => {
    if (initializationPromise) {
      initializationPromise.then(() => {
        console.log('✅ PDF.js fully initialized and ready');
        setPdfJsReady(true);
      }).catch((error) => {
        console.error('❌ PDF.js initialization failed:', error);
      });
    } else {
      // Check if already initialized
      if (pdfjsLib) {
        setPdfJsReady(true);
      }
    }
  }, []);

  // Load PDF when file changes
  useEffect(() => {
    if (pdfFile && pdfJsReady && pdfjsLib) {
      console.log('🔧 Loading PDF with file size:', pdfFile.size, 'bytes');
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        if (e.target?.result) {
          try {
            console.log('📄 Starting PDF loading process...');
            const pdf = await pdfjsLib.getDocument({
              data: e.target.result
            }).promise;
            console.log('✅ PDF loaded successfully! Pages:', pdf.numPages);
            setPdfDoc(pdf);
            setCurrentPage(1);
            setPageRendered(false);
          } catch (error) {
            console.error('❌ Error loading PDF:', error);
            console.error('Error details:', error.message, error.stack);
          }
        }
      };
      fileReader.onerror = (error) => {
        console.error('❌ FileReader error:', error);
      };
      fileReader.readAsArrayBuffer(pdfFile);
    } else {
      if (pdfFile && !pdfJsReady) {
        console.warn('⚠️ PDF file provided but PDF.js library not ready yet');
      }
    }
  }, [pdfFile, pdfJsReady, pdfjsLib]);

  // Render PDF page
  useEffect(() => {
    if (pdfDoc && canvasRef.current) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale]);

  const renderPage = async (pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current) {
      console.warn('⚠️ Cannot render page: missing pdfDoc or canvas ref');
      return;
    }

    try {
      console.log(`🖼️ Rendering page ${pageNumber} at ${scale}x scale...`);
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.error('❌ Canvas context not available');
        return;
      }

      // Clear previous content
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      console.log(`📏 Canvas dimensions: ${canvas.width}x${canvas.height}`);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      console.log(`✅ Page ${pageNumber} rendered successfully`);
      setPageRendered(true);
    } catch (error) {
      console.error(`❌ Error rendering page ${pageNumber}:`, error);
      console.error('Error details:', error.message, error.stack);
    }
  };

  // Group nearby text blocks that should be treated as one unit (conservative approach)
  const groupTextBlocks = (blocks: TextBlock[]): TextBlock[] => {
    if (blocks.length === 0) return blocks;
    
    const grouped: TextBlock[] = [];
    const used = new Set<number>();
    
    blocks.forEach((block, index) => {
      if (used.has(index)) return;
      
      let currentGroup = [block];
      used.add(index);
      
      // Conservative grouping - only group very close text blocks
      const findNearbyBlocks = (targetBlock: TextBlock) => {
        blocks.forEach((otherBlock, otherIndex) => {
          if (used.has(otherIndex) || index === otherIndex) return;
          
          // Check if blocks are on the same horizontal line (similar y-coordinates)
          const yDiff = Math.abs(targetBlock.y0 - otherBlock.y0);
          const heightTolerance = Math.max(targetBlock.height, otherBlock.height) * 0.5; // Conservative
          
          // Check horizontal proximity - look at both directions
          const leftGap = Math.abs(targetBlock.x0 - otherBlock.x1); // gap to left
          const rightGap = Math.abs(targetBlock.x1 - otherBlock.x0); // gap to right
          const minGap = Math.min(leftGap, rightGap);
          
          // Conservative gap tolerance - only group very close words
          const avgWidth = (targetBlock.width + otherBlock.width) / 2;
          const maxGap = avgWidth * 0.6; // Conservative - only very close words
          
          // Check if blocks are on same line and very close
          const isAdjacent = minGap < maxGap;
          const isOnSameLine = yDiff < heightTolerance;
          
          // Additional check: ensure blocks are within reasonable text box dimensions
          const combinedWidth = Math.abs(Math.max(targetBlock.x1, otherBlock.x1) - Math.min(targetBlock.x0, otherBlock.x0));
          const combinedHeight = Math.abs(Math.max(targetBlock.y1, otherBlock.y1) - Math.min(targetBlock.y0, otherBlock.y0));
          const maxReasonableWidth = avgWidth * 6; // Max width for a text phrase
          const maxReasonableHeight = Math.max(targetBlock.height, otherBlock.height) * 2; // Max 2 line heights
          
          const isReasonableSize = combinedWidth <= maxReasonableWidth && combinedHeight <= maxReasonableHeight;
          
          if (isOnSameLine && isAdjacent && isReasonableSize && !used.has(otherIndex)) {
            currentGroup.push(otherBlock);
            used.add(otherIndex);
            // Only one level of recursion to prevent over-grouping
            if (currentGroup.length < 8) { // Limit group size
              findNearbyBlocks(otherBlock);
            }
          }
        });
      };
      
      // Find nearby blocks (limited recursion)
      findNearbyBlocks(block);
      
      if (currentGroup.length > 1) {
        // Sort by x-coordinate to maintain reading order
        currentGroup.sort((a, b) => a.x0 - b.x0);
        
        // Create combined block with better text joining
        const combinedText = currentGroup.map(b => b.text.trim()).join(' ');
        const combinedBlock: TextBlock = {
          text: combinedText,
          x0: Math.min(...currentGroup.map(b => b.x0)),
          y0: Math.min(...currentGroup.map(b => b.y0)),
          x1: Math.max(...currentGroup.map(b => b.x1)),
          y1: Math.max(...currentGroup.map(b => b.y1)),
          width: Math.max(...currentGroup.map(b => b.x1)) - Math.min(...currentGroup.map(b => b.x0)),
          height: Math.max(...currentGroup.map(b => b.y1)) - Math.min(...currentGroup.map(b => b.y0)),
          page: block.page
        };
        
        grouped.push(combinedBlock);
        console.log('📦 Grouped blocks:', currentGroup.map(b => b.text), '→', combinedText);
      } else {
        grouped.push(block);
      }
    });
    
    return grouped;
  };

  const getPageTextBlocks = () => {
    const pageBlocks = textBlocks.filter(block => block.page === currentPage);
    return groupTextBlocks(pageBlocks);
  };

  const handleTextBlockDragStart = (textBlock: TextBlock) => {
    setDraggedBlock(textBlock);
    onTextBlockDrag?.(textBlock);
    // Don't clear selection during drag - preserve multi-selection
  };

  // Multi-selection handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectionMode) return;
    
    // Check if clicking on a text block - don't start selection if so
    const target = e.target as HTMLElement;
    if (target.closest('.draggable-text-block')) {
      return; // Let drag handle this
    }
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    
    // Clear previous selection if not holding Ctrl/Cmd
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedBlocks(new Set());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionStart) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setSelectionEnd({ x, y });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      return;
    }
    
    // Find blocks within selection rectangle
    const pageBlocks = getPageTextBlocks();
    const selectedBlockIndexes = new Set(selectedBlocks);
    
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);
    
    console.log('🔲 Selection rectangle:', { minX, maxX, minY, maxY });
    
    pageBlocks.forEach((block, pageIndex) => {
      const blockLeft = (block.x0 * scale) - 2;
      const blockRight = blockLeft + Math.max(block.width * scale, 40) + 4;
      const blockTop = (block.y0 * scale) - 2;
      const blockBottom = blockTop + Math.max(block.height * scale, 18) + 4;
      
      // Check if block intersects with selection rectangle
      const intersects = blockLeft < maxX && blockRight > minX && blockTop < maxY && blockBottom > minY;
      
      if (intersects) {
        // Use the page index directly since we're working with grouped blocks
        selectedBlockIndexes.add(pageIndex);
        console.log('✅ Selected block:', block.text.substring(0, 30));
      }
    });
    
    console.log('📊 Total selected blocks:', selectedBlockIndexes.size);
    setSelectedBlocks(selectedBlockIndexes);
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const clearSelection = () => {
    setSelectedBlocks(new Set());
  };

  const selectAllOnPage = () => {
    const pageBlocks = getPageTextBlocks();
    const newSelection = new Set<number>();
    
    // Select all blocks on current page by their page index
    pageBlocks.forEach((block, pageIndex) => {
      newSelection.add(pageIndex);
    });
    
    console.log('📋 Selected all blocks on page:', newSelection.size);
    setSelectedBlocks(newSelection);
  };

  const isBlockSelected = (block: TextBlock): boolean => {
    const pageBlocks = getPageTextBlocks();
    const pageIndex = pageBlocks.findIndex(pb => 
      pb.x0 === block.x0 && 
      pb.y0 === block.y0 && 
      pb.text === block.text
    );
    return pageIndex !== -1 && selectedBlocks.has(pageIndex);
  };

  if (!pdfFile) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">📄 PDF Viewer</h2>
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Upload a PDF to view pages and text blocks</p>
          <p className="text-sm">Text blocks will appear as blue overlays that you can drag to the table</p>
        </div>
      </div>
    );
  }

  if (!pdfJsReady) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">📄 PDF Viewer</h2>
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-lg mb-2">Loading PDF viewer...</p>
          <p className="text-sm">Initializing PDF.js library and worker</p>
          <p className="text-xs mt-2 text-blue-600">Check browser console for detailed progress</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">📄 Interactive PDF Viewer</h2>
        
        {textBlocks.length > 0 && (
          <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded">
            ✅ {textBlocks.length} text blocks loaded
          </div>
        )}
      </div>

      {/* PDF Controls */}
      {pdfDoc && (
        <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600"
            >
              ← Prev
            </button>
            
            <span className="text-sm font-medium">
              Page {currentPage} of {pdfDoc.numPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(pdfDoc.numPages, currentPage + 1))}
              disabled={currentPage >= pdfDoc.numPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600"
            >
              Next →
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Zoom:</label>
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="p-1 border rounded text-sm"
            >
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1.0">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="1.75">175%</option>
              <option value="2.0">200%</option>
              <option value="2.5">250%</option>
              <option value="3.0">300%</option>
            </select>
          </div>

          {/* Selection Mode Controls */}
          <div className="flex items-center gap-2 border-l pl-4">
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectionMode 
                  ? 'bg-orange-500 text-white hover:bg-orange-600' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {selectionMode ? '🔲 Selection ON' : '🖱️ Selection OFF'}
            </button>
            
            {selectionMode && (
              <>
                <button
                  onClick={selectAllOnPage}
                  disabled={getPageTextBlocks().length === 0}
                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  disabled={selectedBlocks.size === 0}
                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
                >
                  Clear ({selectedBlocks.size})
                </button>
              </>
            )}
          </div>

          <div className="text-xs text-blue-600">
            {selectionMode 
              ? '🖱️ Drag to select multiple blocks, then drag selection to table' 
              : '💡 Hover over blue blocks and drag them to the table'
            }
          </div>
        </div>
      )}

      {/* PDF Container */}
      <div className="relative border border-gray-300 overflow-auto max-h-[600px] bg-gray-100">
        <div
          ref={containerRef}
          className={`relative inline-block ${selectionMode ? 'cursor-crosshair' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsSelecting(false)}
        >
          <canvas
            ref={canvasRef}
            className="block bg-white"
          />
          
          {/* Selection Rectangle */}
          {isSelecting && selectionStart && selectionEnd && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none z-30"
              style={{
                left: Math.min(selectionStart.x, selectionEnd.x),
                top: Math.min(selectionStart.y, selectionEnd.y),
                width: Math.abs(selectionEnd.x - selectionStart.x),
                height: Math.abs(selectionEnd.y - selectionStart.y),
              }}
            />
          )}
          
          {/* Text Block Overlays */}
          {pageRendered && (
            <div
              className="absolute top-0 left-0 pointer-events-none"
              style={{
                width: canvasRef.current?.width || 0,
                height: canvasRef.current?.height || 0,
              }}
            >
              {getPageTextBlocks().map((block, index) => (
                <div key={index} className="pointer-events-auto">
                  <DraggableTextBlock
                    textBlock={block}
                    scale={scale}
                    isSelected={isBlockSelected(block)}
                    selectionMode={selectionMode}
                    selectedBlocks={Array.from(selectedBlocks).map(i => getPageTextBlocks()[i]).filter(Boolean)}
                    onDragStart={() => handleTextBlockDragStart(block)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Page Summary */}
      {pageRendered && (
        <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
          <p className="font-medium text-blue-800">
            📊 Page {currentPage}: {getPageTextBlocks().length} text blocks
          </p>
          <p className="text-blue-600 text-xs mt-1">
            💡 Click and drag any blue text block to move it to your data table below
          </p>
        </div>
      )}
    </div>
  );
} 