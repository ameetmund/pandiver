import React, { useState, useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { DragTypes } from './DraggableTextBlock';
import { TextBlock } from './PDFViewer';

interface TableCell {
  content: string;
  originalBlock?: TextBlock;
}

interface EditableTableProps {
  onDataChange: (data: string[][]) => void;
}

const EditableTable: React.FC<EditableTableProps> = ({ onDataChange }) => {
  const [tableData, setTableData] = useState<TableCell[][]>([
    [{ content: '' }, { content: '' }, { content: '' }],
    [{ content: '' }, { content: '' }, { content: '' }],
    [{ content: '' }, { content: '' }, { content: '' }],
  ]);

  const updateCell = useCallback((rowIndex: number, colIndex: number, content: string, originalBlock?: TextBlock) => {
    setTableData(prevData => {
      const newData = prevData.map((row, rIdx) =>
        row.map((cell, cIdx) => {
          if (rIdx === rowIndex && cIdx === colIndex) {
            return { content, originalBlock };
          }
          return cell;
        })
      );
      
      // Update parent component with string data
      const stringData = newData.map(row => row.map(cell => cell.content));
      onDataChange(stringData);
      
      return newData;
    });
  }, [onDataChange]);

  const handleCellEdit = useCallback((rowIndex: number, colIndex: number, newContent: string) => {
    updateCell(rowIndex, colIndex, newContent);
  }, [updateCell]);

  const addRow = useCallback(() => {
    setTableData(prevData => [
      ...prevData,
      Array(prevData[0].length).fill({ content: '' })
    ]);
  }, []);

  const addColumn = useCallback(() => {
    setTableData(prevData =>
      prevData.map(row => [...row, { content: '' }])
    );
  }, []);

  const removeRow = useCallback((rowIndex: number) => {
    if (tableData.length > 1) {
      setTableData(prevData => {
        const newData = prevData.filter((_, idx) => idx !== rowIndex);
        const stringData = newData.map(row => row.map(cell => cell.content));
        onDataChange(stringData);
        return newData;
      });
    }
  }, [tableData.length, onDataChange]);

  const removeColumn = useCallback((colIndex: number) => {
    if (tableData[0].length > 1) {
      setTableData(prevData => {
        const newData = prevData.map(row => row.filter((_, idx) => idx !== colIndex));
        const stringData = newData.map(row => row.map(cell => cell.content));
        onDataChange(stringData);
        return newData;
      });
    }
  }, [tableData, onDataChange]);

  const clearTable = useCallback(() => {
    setTableData(prevData => {
      const clearedData = prevData.map(row => row.map(() => ({ content: '' })));
      const stringData = clearedData.map(row => row.map(cell => cell.content));
      onDataChange(stringData);
      return clearedData;
    });
  }, [onDataChange]);

  return (
    <div className="editable-table-container">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={addRow}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Add Row
        </button>
        <button
          onClick={addColumn}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Add Column
        </button>
        <button
          onClick={clearTable}
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear Table
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="w-8 border border-gray-300 p-1"></th>
              {tableData[0].map((_, colIndex) => (
                <th key={colIndex} className="border border-gray-300 p-2 bg-gray-100 relative">
                  <div className="flex items-center justify-between">
                    <span>Col {colIndex + 1}</span>
                    {tableData[0].length > 1 && (
                      <button
                        onClick={() => removeColumn(colIndex)}
                        className="text-red-500 hover:text-red-700 ml-2"
                        title="Remove column"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="border border-gray-300 p-1 bg-gray-100 text-center">
                  <div className="flex items-center justify-center">
                    <span className="mr-1">{rowIndex + 1}</span>
                    {tableData.length > 1 && (
                      <button
                        onClick={() => removeRow(rowIndex)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove row"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </td>
                {row.map((cell, colIndex) => (
                  <TableCell
                    key={`${rowIndex}-${colIndex}`}
                    cell={cell}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    onContentChange={handleCellEdit}
                    onBlockDrop={updateCell}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface TableCellProps {
  cell: TableCell;
  rowIndex: number;
  colIndex: number;
  onContentChange: (rowIndex: number, colIndex: number, content: string) => void;
  onBlockDrop: (rowIndex: number, colIndex: number, content: string, originalBlock?: TextBlock) => void;
}

const TableCell: React.FC<TableCellProps> = ({
  cell,
  rowIndex,
  colIndex,
  onContentChange,
  onBlockDrop,
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: DragTypes.TEXT_BLOCK,
    drop: (item: { block: TextBlock }) => {
      onBlockDrop(rowIndex, colIndex, item.block.text, item.block);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(rowIndex, colIndex, e.target.value);
  };

  return (
    <td
      ref={drop as any}
      className={`border border-gray-300 p-1 min-w-32 ${
        isOver ? 'bg-yellow-100 border-yellow-400' : ''
      } ${cell.originalBlock ? 'bg-blue-50' : ''}`}
    >
      <textarea
        value={cell.content}
        onChange={handleInputChange}
        className="w-full h-20 p-2 border-none resize-none bg-transparent focus:outline-none focus:bg-white"
        placeholder="Drop text here or type..."
        title={cell.originalBlock ? `From PDF page ${cell.originalBlock.page}` : ''}
      />
      {cell.originalBlock && (
        <div className="text-xs text-blue-600 mt-1">
          PDF Page {cell.originalBlock.page}
        </div>
      )}
    </td>
  );
};

export default EditableTable; 