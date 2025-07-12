'use client';

import React from 'react';

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

interface TextBlocksDisplayProps {
  textBlocks: TextBlock[];
}

export default function TextBlocksDisplay({ textBlocks }: TextBlocksDisplayProps) {
  if (textBlocks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">📝 Extracted Text Blocks</h2>
        <p className="text-gray-500 text-center py-8">
          Upload a PDF to see extracted text blocks here
        </p>
      </div>
    );
  }

  // Group text blocks by page
  const blocksByPage = textBlocks.reduce((acc, block) => {
    if (!acc[block.page]) {
      acc[block.page] = [];
    }
    acc[block.page].push(block);
    return acc;
  }, {} as Record<number, TextBlock[]>);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">📝 Extracted Text Blocks</h2>
      
      <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-200">
        <p className="text-blue-700 text-sm">
          ✅ Found <strong>{textBlocks.length}</strong> text blocks across <strong>{Object.keys(blocksByPage).length}</strong> page(s)
        </p>
      </div>

      <div className="space-y-6 max-h-96 overflow-y-auto">
        {Object.entries(blocksByPage).map(([pageNum, blocks]) => (
          <div key={pageNum} className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 text-gray-800">
              📄 Page {pageNum} ({blocks.length} blocks)
            </h3>
            
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {blocks.map((block, index) => (
                <div
                  key={index}
                  className="p-2 bg-gray-50 rounded border text-sm hover:bg-gray-100 transition-colors"
                  title={`Position: (${block.x0.toFixed(1)}, ${block.y0.toFixed(1)}) - Size: ${block.width.toFixed(1)}×${block.height.toFixed(1)}`}
                >
                  <span className="text-gray-700">{block.text}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    Position: ({block.x0.toFixed(1)}, {block.y0.toFixed(1)}) • 
                    Size: {block.width.toFixed(1)}×{block.height.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 