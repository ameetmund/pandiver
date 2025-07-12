'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDrop } from 'react-dnd';

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

interface TableCell {
  id: string;
  content: string;
  textBlocks: string[]; // IDs of text blocks in this cell
}

interface TableRow {
  id: string;
  cells: TableCell[];
}

interface DataTableProps {
  onDataChange: (data: string[][]) => void;
  onHeadersChange?: (headers: string[]) => void;
}

// Droppable column header component
interface DroppableHeaderProps {
  headerText: string;
  columnIndex: number;
  onHeaderChange: (index: number, text: string) => void;
  onHeaderRemove: (index: number) => void;
  canRemove: boolean;
  onMultiBlockDrop: (targetRowId: string, columnIndex: number, blocks: TextBlock[]) => void;
}

function DroppableHeader({ headerText, columnIndex, onHeaderChange, onHeaderRemove, canRemove, onMultiBlockDrop }: DroppableHeaderProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'textBlock',
    drop: (item: any) => {
      console.log('🎯 Dropping into header:', columnIndex, 'Item type:', item.type || 'single');
      
      // Handle multiple blocks for headers - show choice dialog like cells
      if (item.type === 'multipleBlocks' && item.blocks) {
        console.log('📦 Multi-block drop on header:', item.blocks.length, 'blocks - showing choice dialog');
        
        // Use special "header" rowId to indicate this is a header drop
        onMultiBlockDrop('header-' + columnIndex, columnIndex, item.blocks);
        return;
      } else {
        // Handle single block
        console.log('📄 Single block drop on header:', item.text?.substring(0, 30) + '...');
        const newHeaderText = (item.text || '').trim();
        
        // Set the header text (replace existing)
        console.log('📝 Setting header text:', newHeaderText);
        onHeaderChange(columnIndex, newHeaderText);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [columnIndex]);

  return (
    <th 
      ref={drop as any}
      className={`border border-gray-300 p-2 min-w-[150px] transition-all duration-200 ${
        isOver && canDrop 
          ? 'bg-blue-100 border-blue-500 border-dashed shadow-lg' 
          : canDrop 
          ? 'bg-yellow-50 border-yellow-400 border-dashed' 
          : 'bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={headerText}
          onChange={(e) => onHeaderChange(columnIndex, e.target.value)}
          className={`font-bold text-sm w-full p-2 rounded border-2 focus:border-blue-500 text-gray-800 ${
            isOver && canDrop 
              ? 'bg-blue-50 border-blue-400' 
              : 'bg-gray-50 border-gray-200'
          }`}
          placeholder={isOver ? "🎯 Drop field name here!" : "Column header"}
        />
        {canRemove && (
          <button
            onClick={() => onHeaderRemove(columnIndex)}
            className="text-red-500 hover:text-red-700 ml-2 text-xs"
            title="Remove column"
          >
            ×
          </button>
        )}
      </div>
    </th>
  );
}

interface PlacementChoice {
  blocks: TextBlock[];
  targetRowId: string;
  columnIndex: number;
}

// Choice Dialog Component
interface ChoiceDialogProps {
  isOpen: boolean;
  blocksCount: number;
  onChoice: (choice: 'rows' | 'columns') => void;
  onCancel: () => void;
}

function ChoiceDialog({ isOpen, blocksCount, onChoice, onCancel }: ChoiceDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">📊 How to place {blocksCount} blocks?</h3>
        
        <p className="text-gray-600 mb-6">
          You&apos;ve selected {blocksCount} text blocks. How would you like to place them in the table?
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => onChoice('rows')}
            className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
          >
            <div className="text-left">
              <div className="font-semibold text-blue-800">📝 Add as Rows</div>
              <div className="text-sm text-blue-600">Each block goes into a separate row (vertical layout)</div>
            </div>
          </button>
          
          <button
            onClick={() => onChoice('columns')}
            className="w-full p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
          >
            <div className="text-left">
              <div className="font-semibold text-green-800">📊 Add as Columns</div>
              <div className="text-sm text-green-600">Each block goes into a separate column (horizontal layout)</div>
            </div>
          </button>
        </div>
        
        <button
          onClick={onCancel}
          className="w-full mt-4 p-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface DroppableCellProps {
  cell: TableCell;
  rowId: string;
  columnIndex: number;
  onCellContentChange: (rowId: string, cellId: string, content: string) => void;
  onMultiBlockDrop: (targetRowId: string, columnIndex: number, blocks: TextBlock[]) => void;
}

function DroppableCell({ cell, rowId, columnIndex, onCellContentChange, onMultiBlockDrop }: DroppableCellProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'textBlock',
    drop: (item: any) => {
      console.log('🎯 Dropping into cell:', cell.id, 'Item type:', item.type || 'single');
      
      // Handle multiple blocks - show choice dialog
      if (item.type === 'multipleBlocks' && item.blocks) {
        console.log('📦 Multi-block drop:', item.blocks.length, 'blocks - showing choice dialog');
        onMultiBlockDrop(rowId, columnIndex, item.blocks);
        return;
      } 
      
      // Handle single block
      console.log('📄 Single block drop:', item.text?.substring(0, 30) + '...');
      const newText = (item.text || '').trim();
      
      // Add to existing content (avoid duplication)
      const existingContent = cell.content.trim();
      let newContent = newText;
      
      if (existingContent && !existingContent.includes(newText)) {
        newContent = `${existingContent}\n${newText}`;
      } else if (existingContent && existingContent.includes(newText)) {
        // Text already exists, don't add again
        console.log('📝 Text already exists, skipping duplication');
        return;
      }
        
      console.log('📝 New content for cell:', cell.id, 'Length:', newContent.length);
      onCellContentChange(rowId, cell.id, newContent);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [cell.content, cell.id, rowId, columnIndex]);

  return (
    <td 
      ref={drop as any}
      className={`border-2 border-gray-300 p-1 transition-all duration-200 relative ${
        isOver && canDrop 
          ? 'bg-blue-100 border-blue-500 border-dashed shadow-lg transform scale-105' 
          : canDrop 
          ? 'bg-green-50 border-green-400 border-dashed' 
          : cell.content
          ? 'bg-green-25 border-green-200 bg-green-50'
          : 'bg-white hover:bg-gray-50'
      }`}
    >
      {/* Content indicator */}
      {cell.content && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" title="Has content" />
      )}
      <textarea
        value={cell.content}
        onChange={(e) => onCellContentChange(rowId, cell.id, e.target.value)}
        className="w-full min-h-[80px] p-3 text-sm resize-none border-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 font-medium"
        placeholder={isOver ? "🎯 Drop text block(s) here!" : "Enter text or drag single/multiple text blocks here"}
        style={{
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap', // Preserve line breaks
        }}
      />
    </td>
  );
}

export default function DataTable({ onDataChange, onHeadersChange }: DataTableProps) {
  // Use ref for stable ID generation
  const idCounter = useRef(100);
  
  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `cell-${idCounter.current}`;
  }, []);

  // Initialize with empty state - will be set in useEffect
  const [rows, setRows] = useState<TableRow[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  
  // Choice dialog state
  const [showChoiceDialog, setShowChoiceDialog] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<PlacementChoice | null>(null);

  // Helper function to update parent with table data
  const updateParentData = useCallback((currentRows: TableRow[]) => {
    const tableData = currentRows.map(row => 
      row.cells.map(cell => cell.content)
    );
    onDataChange(tableData);
  }, [onDataChange]);

  // Notify parent of header changes
  useEffect(() => {
    if (onHeadersChange && columnHeaders.length > 0) {
      onHeadersChange(columnHeaders);
    }
  }, [columnHeaders, onHeadersChange]);

  // Initialize with default data
  useEffect(() => {
    if (rows.length === 0 && columnHeaders.length === 0) {
      const defaultHeaders = ['Column 1', 'Column 2', 'Column 3'];
      setColumnHeaders(defaultHeaders);
      
      const defaultRows: TableRow[] = [
        {
          id: generateId(),
          cells: defaultHeaders.map(() => ({
            id: generateId(),
            content: '',
            textBlocks: []
          }))
        }
      ];
      
      setRows(defaultRows);
      onHeadersChange?.(defaultHeaders);
    }
  }, [generateId, onHeadersChange]);

  // Ensure all rows have the correct number of cells matching headers
  useEffect(() => {
    const headerCount = columnHeaders.length;
    
    if (headerCount > 0 && rows.length > 0) {
      setRows(prevRows => {
        const updatedRows = prevRows.map(row => {
          // If row has too few cells, add missing ones
          if (row.cells.length < headerCount) {
            const missingCells = Array(headerCount - row.cells.length).fill(null).map(() => ({
              id: generateId(),
              content: '',
              textBlocks: []
            }));
            return {
              ...row,
              cells: [...row.cells, ...missingCells]
            };
          }
          // If row has too many cells, remove extra ones
          else if (row.cells.length > headerCount) {
            return {
              ...row,
              cells: row.cells.slice(0, headerCount)
            };
          }
          // Row has correct number of cells
          return row;
        });
        
        // Update parent data if changes were made
        const hasChanges = updatedRows.some((row, index) => 
          !prevRows[index] || row.cells.length !== prevRows[index].cells.length
        );
        
        if (hasChanges) {
          updateParentData(updatedRows);
          console.log('🔧 Fixed row structure to match header count:', headerCount);
        }
        
        return updatedRows;
      });
    }
  }, [columnHeaders.length, generateId, updateParentData]);

  const addRow = () => {
    const newRow: TableRow = {
      id: generateId(),
      cells: columnHeaders.map(() => ({
        id: generateId(),
        content: '',
        textBlocks: []
      }))
    };
    
    setRows(prevRows => {
      const updatedRows = [...prevRows, newRow];
      updateParentData(updatedRows);
      return updatedRows;
    });
  };

  const addColumn = () => {
    const newHeader = `Column ${columnHeaders.length + 1}`;
    const newHeaders = [...columnHeaders, newHeader];
    setColumnHeaders(newHeaders);
    
    // Add a new cell to each existing row
    setRows(prevRows => {
      const updatedRows = prevRows.map(row => ({
        ...row,
        cells: [...row.cells, {
          id: generateId(),
          content: '',
          textBlocks: []
        }]
      }));
      updateParentData(updatedRows);
      return updatedRows;
    });
    
    // Notify parent about header changes
    onHeadersChange?.(newHeaders);
  };

  const removeRow = (rowId: string) => {
    setRows(prevRows => {
      const updatedRows = prevRows.filter(row => row.id !== rowId);
      updateParentData(updatedRows);
      return updatedRows;
    });
  };

  const removeColumn = (columnIndex: number) => {
    const newHeaders = columnHeaders.filter((_, index) => index !== columnIndex);
    setColumnHeaders(newHeaders);
    
    setRows(prevRows => {
      const updatedRows = prevRows.map(row => ({
        ...row,
        cells: row.cells.filter((_, index) => index !== columnIndex)
      }));
      updateParentData(updatedRows);
      return updatedRows;
    });
    
    // Notify parent about header changes
    onHeadersChange?.(newHeaders);
  };

  const updateCellContent = (rowId: string, cellId: string, content: string) => {
    console.log('🔧 updateCellContent called:', { rowId, cellId, content: content.substring(0, 50) + '...' });
    
    setRows(prevRows => {
      const updatedRows = prevRows.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            cells: row.cells.map(cell => {
              if (cell.id === cellId) {
                console.log('✅ Updating cell:', cell.id, 'with content:', content.substring(0, 50) + '...');
                return { ...cell, content };
              }
              return cell;
            })
          };
        }
        return row;
      });
      
      // Log all cell contents for debugging
      console.log('📋 All cell contents after update:', 
        updatedRows[0].cells.map(cell => ({ id: cell.id, content: cell.content.substring(0, 20) + '...' }))
      );
      
      updateParentData(updatedRows);
      return updatedRows;
    });
  };

  const updateColumnHeader = (index: number, header: string) => {
    const newHeaders = [...columnHeaders];
    newHeaders[index] = header;
    setColumnHeaders(newHeaders);
  };

  const handleMultiBlockDrop = (targetRowId: string, columnIndex: number, blocks: TextBlock[]) => {
    console.log('📚 Multi-block drop handler:', { targetRowId, columnIndex, blocksCount: blocks.length });
    
    // Always reset dialog state first, then show
    setShowChoiceDialog(false);
    setPendingPlacement(null);
    
    // Use timeout to ensure clean state reset
    setTimeout(() => {
      setPendingPlacement({ blocks, targetRowId, columnIndex });
      setShowChoiceDialog(true);
      console.log('🎯 Choice dialog opened for', blocks.length, 'blocks');
    }, 50);
  };

  const handlePlacementChoice = (choice: 'rows' | 'columns') => {
    if (!pendingPlacement) return;
    
    const { blocks, targetRowId, columnIndex } = pendingPlacement;
    console.log('📍 Placement choice:', choice, 'for', blocks.length, 'blocks');
    
    // Check if this is a header drop
    if (targetRowId.startsWith('header-')) {
      if (choice === 'rows') {
        placeBlocksAsHeaderRows(columnIndex, blocks);
      } else {
        placeBlocksAsHeaderColumns(columnIndex, blocks);
      }
    } else {
      // Regular cell drop
      if (choice === 'rows') {
        placeBlocksAsRows(targetRowId, columnIndex, blocks);
      } else {
        placeBlocksAsColumns(targetRowId, columnIndex, blocks);
      }
    }
    
    // Clean up
    setShowChoiceDialog(false);
    setPendingPlacement(null);
  };

  const handlePlacementCancel = () => {
    setShowChoiceDialog(false);
    setPendingPlacement(null);
  };

  const placeBlocksAsHeaderRows = (columnIndex: number, blocks: TextBlock[]) => {
    console.log('📝 Placing', blocks.length, 'blocks as header rows in column', columnIndex);
    
    // Combine all block texts into one header (like stacking them vertically)
    const combinedText = blocks.map(block => block.text.trim()).join(' | ');
    
    // Update the header at the target column
    setColumnHeaders(prevHeaders => {
      const newHeaders = [...prevHeaders];
      if (columnIndex < newHeaders.length) {
        newHeaders[columnIndex] = combinedText;
        console.log('📝 Set header', columnIndex, 'to:', combinedText);
      }
      return newHeaders;
    });
  };

  const placeBlocksAsHeaderColumns = (startColumnIndex: number, blocks: TextBlock[]) => {
    console.log('📝 Placing', blocks.length, 'blocks as header columns starting at', startColumnIndex);
    
    // Add columns if needed
    const columnsNeeded = startColumnIndex + blocks.length;
    
    setColumnHeaders(prevHeaders => {
      const currentColumnCount = prevHeaders.length;
      
      if (columnsNeeded > currentColumnCount) {
        const newColumns = columnsNeeded - currentColumnCount;
        const newHeaders = [...prevHeaders];
        
        // Add new columns
        for (let i = 0; i < newColumns; i++) {
          newHeaders.push(`Column ${currentColumnCount + i + 1}`);
        }
        
        // Add cells to all existing rows
        setRows(prevRows => 
          prevRows.map(row => ({
            ...row,
            cells: [
              ...row.cells,
              ...Array(newColumns).fill(null).map(() => ({
                id: generateId(),
                content: '',
                textBlocks: []
              }))
            ]
          }))
        );
        
        // Set headers for each block
        blocks.forEach((block, blockIndex) => {
          const headerIndex = startColumnIndex + blockIndex;
          if (headerIndex < newHeaders.length) {
            newHeaders[headerIndex] = block.text.trim();
            console.log('📝 Set header', headerIndex, 'to:', block.text.trim());
          }
        });
        
        return newHeaders;
      } else {
        // Just update existing headers
        const updatedHeaders = [...prevHeaders];
        blocks.forEach((block, blockIndex) => {
          const headerIndex = startColumnIndex + blockIndex;
          if (headerIndex < updatedHeaders.length) {
            updatedHeaders[headerIndex] = block.text.trim();
            console.log('📝 Set header', headerIndex, 'to:', block.text.trim());
          }
        });
        return updatedHeaders;
      }
    });
  };

  const placeBlocksAsRows = (targetRowId: string, columnIndex: number, blocks: TextBlock[]) => {
    setRows(prevRows => {
      const targetRowIndex = prevRows.findIndex(row => row.id === targetRowId);
      if (targetRowIndex === -1) return prevRows;
      
      const updatedRows = [...prevRows];
      
      // Place each block in a separate row, starting from the target row
      blocks.forEach((block, blockIndex) => {
        const rowIndex = targetRowIndex + blockIndex;
        
        // Create new row if needed
        if (rowIndex >= updatedRows.length) {
          const newRowId = `row-${updatedRows.length + 1}`;
          const newRow: TableRow = {
            id: newRowId,
            cells: columnHeaders.map(() => ({
              id: generateId(),
              content: '',
              textBlocks: []
            }))
          };
          updatedRows.push(newRow);
        }
        
        // Update the cell content in the target column (no duplication)
        const row = updatedRows[rowIndex];
        if (row.cells[columnIndex]) {
          const existingContent = row.cells[columnIndex].content.trim();
          const newText = block.text.trim();
          
          // Avoid duplicating text
          if (existingContent && !existingContent.includes(newText)) {
            row.cells[columnIndex].content = `${existingContent}\n${newText}`;
          } else if (!existingContent) {
            row.cells[columnIndex].content = newText;
          }
          // If text already exists, don't add it again
          
          console.log('📝 Row placement - Cell content:', row.cells[columnIndex].content);
        }
      });
      
      updateParentData(updatedRows);
      return updatedRows;
    });
  };

  const placeBlocksAsColumns = (targetRowId: string, columnIndex: number, blocks: TextBlock[]) => {
    setRows(prevRows => {
      const targetRowIndex = prevRows.findIndex(row => row.id === targetRowId);
      if (targetRowIndex === -1) return prevRows;
      
      // First, add columns if needed
      const columnsNeeded = columnIndex + blocks.length;
      const currentColumnCount = columnHeaders.length;
      
      if (columnsNeeded > currentColumnCount) {
        const newColumns = columnsNeeded - currentColumnCount;
        const newHeaders = [...columnHeaders];
        
        for (let i = 0; i < newColumns; i++) {
          newHeaders.push(`Column ${currentColumnCount + i + 1}`);
        }
        
        setColumnHeaders(newHeaders);
        
        // Add cells to all existing rows
        const updatedRows = prevRows.map(row => ({
          ...row,
          cells: [
            ...row.cells,
            ...Array(newColumns).fill(null).map(() => ({
              id: generateId(),
              content: '',
              textBlocks: []
            }))
          ]
        }));
        
        // Now place blocks in the target row (no duplication)
        const targetRow = updatedRows[targetRowIndex];
        blocks.forEach((block, blockIndex) => {
          const cellIndex = columnIndex + blockIndex;
          if (targetRow.cells[cellIndex]) {
            const existingContent = targetRow.cells[cellIndex].content.trim();
            const newText = block.text.trim();
            
            // Avoid duplicating text
            if (existingContent && !existingContent.includes(newText)) {
              targetRow.cells[cellIndex].content = `${existingContent}\n${newText}`;
            } else if (!existingContent) {
              targetRow.cells[cellIndex].content = newText;
            }
            // If text already exists, don't add it again
            
            console.log('📝 Column placement - Cell content:', targetRow.cells[cellIndex].content);
          }
        });
        
        updateParentData(updatedRows);
        return updatedRows;
      } else {
        // Just place blocks in existing columns (no duplication)
        const updatedRows = [...prevRows];
        const targetRow = updatedRows[targetRowIndex];
        
        blocks.forEach((block, blockIndex) => {
          const cellIndex = columnIndex + blockIndex;
          if (targetRow.cells[cellIndex]) {
            const existingContent = targetRow.cells[cellIndex].content.trim();
            const newText = block.text.trim();
            
            // Avoid duplicating text
            if (existingContent && !existingContent.includes(newText)) {
              targetRow.cells[cellIndex].content = `${existingContent}\n${newText}`;
            } else if (!existingContent) {
              targetRow.cells[cellIndex].content = newText;
            }
            // If text already exists, don't add it again
            
            console.log('📝 Existing column placement - Cell content:', targetRow.cells[cellIndex].content);
          }
        });
        
        updateParentData(updatedRows);
        return updatedRows;
      }
    });
  };

  const clearTable = () => {
    // Reset headers to default
    const defaultHeaders = ['Column 1', 'Column 2', 'Column 3'];
    setColumnHeaders(defaultHeaders);
    
    // Create a fresh table with default structure
    const defaultRows: TableRow[] = [
      {
        id: generateId(),
        cells: defaultHeaders.map(() => ({
          id: generateId(),
          content: '',
          textBlocks: []
        }))
      }
    ];
    
    setRows(defaultRows);
    updateParentData(defaultRows);
    
    // Notify parent about header reset
    onHeadersChange?.(defaultHeaders);
    
    console.log('🧹 Table cleared - reset to default structure');
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">📊 Data Table</h2>
          
          <div className="flex gap-2">
            <button
              onClick={addRow}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            >
              + Row
            </button>
            <button
              onClick={addColumn}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              + Column
            </button>
            <button
              onClick={clearTable}
              className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              {columnHeaders.map((header, index) => (
                <DroppableHeader
                  key={index}
                  headerText={header}
                  columnIndex={index}
                  onHeaderChange={updateColumnHeader}
                  onHeaderRemove={removeColumn}
                  canRemove={columnHeaders.length > 1}
                  onMultiBlockDrop={handleMultiBlockDrop}
                />
              ))}
              <th className="border border-gray-300 p-2 bg-gray-100 w-12 text-center">
                <span className="text-xs text-gray-500">🗑️</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.cells.map((cell, cellIndex) => (
                  <DroppableCell
                    key={cell.id}
                    cell={cell}
                    rowId={row.id}
                    columnIndex={cellIndex}
                    onCellContentChange={updateCellContent}
                    onMultiBlockDrop={handleMultiBlockDrop}
                  />
                ))}
                <td className="border border-gray-300 p-2 text-center bg-gray-50 w-12">
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-red-50"
                      title="Remove row"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>📝 Table size: {rows.length} rows × {columnHeaders.length} columns</p>
        <p className="text-xs mt-1">
          💡 Tip: Drag field names to column headers (they&apos;ll turn blue), drag values to cells below. 
          Green dots indicate cells with content. Use 🗑️ column to delete rows.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          🔲 Multi-select: Enable selection mode in PDF viewer, drag to select multiple blocks, then drag to headers or cells. 
          Choice dialog appears for multi-block drops to cells - choose rows or columns!
        </p>
        <p className="text-xs text-gray-500 mt-1">
          🔧 Debug mode: Check browser console (F12) for grouping and placement logs.
        </p>
      </div>
    </div>
    
    {/* Choice Dialog */}
    <ChoiceDialog
      isOpen={showChoiceDialog}
      blocksCount={pendingPlacement?.blocks.length || 0}
      onChoice={handlePlacementChoice}
      onCancel={handlePlacementCancel}
    />
  </>
  );
} 