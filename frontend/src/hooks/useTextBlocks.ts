import { useState, useCallback } from 'react';
import { TextBlock } from '../components/PDFViewer';

interface UseTextBlocksReturn {
  textBlocks: TextBlock[];
  selectedBlocks: TextBlock[];
  addTextBlocks: (blocks: TextBlock[]) => void;
  selectBlock: (block: TextBlock) => void;
  deselectBlock: (blockId: string) => void;
  clearSelection: () => void;
  toggleBlockSelection: (block: TextBlock) => void;
  isBlockSelected: (blockId: string) => boolean;
}

export const useTextBlocks = (): UseTextBlocksReturn => {
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<TextBlock[]>([]);

  const addTextBlocks = useCallback((blocks: TextBlock[]) => {
    // Add unique IDs to blocks if they don't have them
    const blocksWithIds = blocks.map((block, index) => ({
      ...block,
      id: block.id || `block-${block.page}-${index}-${Date.now()}`,
    }));
    setTextBlocks(blocksWithIds);
  }, []);

  const selectBlock = useCallback((block: TextBlock) => {
    setSelectedBlocks(prev => {
      const isAlreadySelected = prev.some(selected => selected.id === block.id);
      if (isAlreadySelected) {
        return prev;
      }
      return [...prev, block];
    });
  }, []);

  const deselectBlock = useCallback((blockId: string) => {
    setSelectedBlocks(prev => prev.filter(block => block.id !== blockId));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBlocks([]);
  }, []);

  const toggleBlockSelection = useCallback((block: TextBlock) => {
    setSelectedBlocks(prev => {
      const isAlreadySelected = prev.some(selected => selected.id === block.id);
      if (isAlreadySelected) {
        return prev.filter(selected => selected.id !== block.id);
      } else {
        return [...prev, block];
      }
    });
  }, []);

  const isBlockSelected = useCallback((blockId: string) => {
    return selectedBlocks.some(block => block.id === blockId);
  }, [selectedBlocks]);

  return {
    textBlocks,
    selectedBlocks,
    addTextBlocks,
    selectBlock,
    deselectBlock,
    clearSelection,
    toggleBlockSelection,
    isBlockSelected,
  };
}; 