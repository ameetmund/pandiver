import React from 'react';
import { useDrag } from 'react-dnd';
import { TextBlock } from './PDFViewer';

interface DraggableTextBlockProps {
  block: TextBlock;
  onRemove: (blockId: string) => void;
}

export const DragTypes = {
  TEXT_BLOCK: 'textBlock',
};

const DraggableTextBlock: React.FC<DraggableTextBlockProps> = ({ block, onRemove }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: DragTypes.TEXT_BLOCK,
    item: { block },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const opacity = isDragging ? 0.5 : 1;

  return (
    <div
      ref={drag as any}
      className={`inline-flex items-center gap-2 px-3 py-2 m-1 bg-blue-100 border border-blue-300 rounded-full cursor-move text-sm transition-all duration-200 hover:bg-blue-200 ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{ opacity }}
    >
      <span className="max-w-32 truncate" title={block.text}>
        {block.text}
      </span>
      <span className="text-xs text-gray-500">
        (P{block.page})
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(block.id);
        }}
        className="ml-1 text-red-500 hover:text-red-700 font-bold"
        title="Remove block"
      >
        ×
      </button>
    </div>
  );
};

export default DraggableTextBlock; 