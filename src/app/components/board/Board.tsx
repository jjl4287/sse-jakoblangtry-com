'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  MeasuringFrequency,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { SortableColumn } from './SortableColumn';
import { SortableCard } from './SortableCard';
import { Column } from './Column';
import { Card } from './Card';
import { useBoard } from '~/services/board-context';
import type { SaveStatus } from '~/services/board-context';
import { useTheme } from '~/app/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Card as CardType, Column as ColumnType } from '~/types';
import { NewCardSheet } from './NewCardSheet';
import { BoardHeader } from './BoardHeader';

// Props for header inline editing and external focus control
export interface BoardProps {
  focusEditTitleBoardId?: string | null;
  clearFocusEdit?: () => void;
  onRenameBoard?: (id: string, title: string) => void;
  sidebarOpen: boolean;
}

export const Board: React.FC<BoardProps> = ({ focusEditTitleBoardId, clearFocusEdit, onRenameBoard, sidebarOpen }) => {
  const {
    board,
    loading,
    error,
    saveStatus,
    saveError,
    moveCard,
    moveColumn,
    createColumn,
    updateTitle
  } = useBoard();
  const { theme, toggleTheme } = useTheme();
  
  // Header inline edit state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState<string>(board?.title ?? '');
  // Ref for header input selection
  const headerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (board?.title && headerTitle !== board.title) { // Only update if different to avoid re-renders
      setHeaderTitle(board.title);
    }
  }, [board?.title, headerTitle]); // Add headerTitle to dependencies

  // If external focus request matches this board, enter edit mode
  useEffect(() => {
    if (board && focusEditTitleBoardId === board.id) {
      setIsEditingHeader(true);
      requestAnimationFrame(() => {
        headerInputRef.current?.select();
      });
      clearFocusEdit?.();
    }
  }, [focusEditTitleBoardId, board, clearFocusEdit]);

  // Keep a ref to board to use in stable callbacks without re-defining on every change
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Local state for search query filtering
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Track active drag item for DragOverlay
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<{
    type: 'card' | 'column';
    card?: CardType;
    column?: ColumnType;
    index?: number;
    columnId?: string;
  } | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const lastCrossColumnMove = useRef<string>('');
  const [addingCardToColumnId, setAddingCardToColumnId] = useState<string | null>(null);

  // Define sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Ref for header element, used by mouse position hook
  const headerRef = useRef<HTMLDivElement>(null);
  useMousePositionStyle(headerRef);

  // Declare ref for search input to focus on keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle drag start to track active item
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const data = active.data?.current as {
      type: 'card' | 'column';
      card?: CardType;
      column?: ColumnType;
      index?: number;
      columnId?: string;
    } | undefined;
    if (!data) return;
    // Add class on html when dragging a card
    if (data.type === 'card') {
      document.documentElement.classList.add('card-dragging-active');
    }
    setActiveItem(data);
    // If dragging a column, capture its DOM size for overlay ghost
    if (data.type === 'column') {
      const el = document.querySelector(`[data-column-id="${active.id}"]`);
      if (el instanceof HTMLElement) {
        const { width, height } = el.getBoundingClientRect();
        setOverlayStyle({ width, height });
      }
    }
  }, [setOverlayStyle]);

  // Handle drag over for cross-column card moves: drop immediately at end
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    const activeData = active.data.current as { type: string; columnId?: string };
    if (activeData.type !== 'card' || !activeData.columnId) return;

    const overData = over.data.current as { type: string; columnId?: string };
    const targetColumnId =
      overData.type === 'column' ? (over.id as string)
      : overData.type === 'card' ? overData.columnId!
      : undefined;
    if (!targetColumnId || targetColumnId === lastCrossColumnMove.current) return;

    const targetColumn = boardRef.current?.columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    const alreadyInTarget = targetColumn.cards.some(c => c.id === active.id);
    if (alreadyInTarget) return;

    const targetIndex = targetColumn.cards.length;
    moveCard(active.id as string, targetColumnId, targetIndex);
    lastCrossColumnMove.current = targetColumnId;
  }, [moveCard]);

  // Handle drag end for both card and column movement
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active || !over || !board) return;
    
    // Extract data
    const activeId = active.id as string;
    const overId = over.id as string;
    
    const activeData = active.data.current as { type: string; columnId?: string; index?: number };
    const overData = over.data.current as { type: string; columnId?: string };
    
    // Handle column movement
    if (activeData?.type === 'column') {
      if (activeId !== overId) {
        // Find source and destination column indexes
        const activeColumnIndex = board.columns.findIndex(col => col.id === activeId);
        const overColumnIndex = board.columns.findIndex(col => col.id === overId);
        
        if (activeColumnIndex !== -1 && overColumnIndex !== -1) {
          moveColumn(activeId, overColumnIndex);
        }
      }
    } 
    // Handle card movement
    else if (activeData?.type === 'card') {
      const activeCardId = activeId;
      const { columnId: sourceColumnId } = activeData;
      
      // Find target column and position
      let targetColumnId = sourceColumnId;
      let targetIndex = 0;
      
      // Check if dropping on another card
      if (overData?.type === 'card') {
        targetColumnId = overData.columnId;
        
        // Find the target index in the target column
        const targetColumn = board.columns.find(col => col.id === targetColumnId);
        if (targetColumn) {
          const targetCard = targetColumn.cards.find(card => card.id === overId);
          if (targetCard) {
            targetIndex = targetCard.order;
          }
        }
      } 
      // Check if dropping on a column
      else if (overData?.type === 'column') {
        targetColumnId = overId;
        // Place at the end of the column
        const targetColumn = board.columns.find(col => col.id === targetColumnId);
        if (targetColumn) {
          targetIndex = targetColumn.cards.length;
        }
      }
      
      // Only move if needed and if we didn't already move during dragOver
      if (sourceColumnId !== targetColumnId || activeData.index !== targetIndex) {
        moveCard(activeCardId, targetColumnId ?? '', targetIndex ?? 0);
      }
    }
    
    // Clear active items
    setActiveId(null);
    setActiveItem(null);
    // Remove dragging-in-progress class and reset cross-column ref
    document.documentElement.classList.remove('card-dragging-active');
    lastCrossColumnMove.current = '';
  }, [board, moveCard, moveColumn]);

  // Reset active items if drag is canceled
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveItem(null);
    // Remove class and reset if drag is cancelled
    document.documentElement.classList.remove('card-dragging-active');
    lastCrossColumnMove.current = '';
  }, []);

  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  // Filter cards based on search query
  const filteredBoard = useMemo(() => {
    if (!board) return null;
    if (!searchQuery?.trim()) return board;
    
    const query = searchQuery.toLowerCase();
    const columns = board.columns.map(column => {
      const filteredCards = column?.cards?.filter(card => (
        card?.title?.toLowerCase().includes(query) ||
        card?.description?.toLowerCase().includes(query) ||
        card?.labels?.some(label => label?.name?.toLowerCase().includes(query))
      )) ?? [];
      return { ...column, cards: filteredCards };
    });
    
    return { ...board, columns };
  }, [board, searchQuery]);

  // Calculate card count based on filtered board
  const cardCount = useMemo(() => {
    if (!filteredBoard?.columns) return 0;
    
    return filteredBoard?.columns?.reduce((acc, col) => {
      if (col?.cards) {
        return acc + col.cards.length;
      }
      return acc;
    }, 0) ?? 0;
  }, [filteredBoard]);

  // Get the column IDs for the sortable context
  const columnsIds = useMemo(() => 
    filteredBoard?.columns?.map(col => col?.id ?? '') ?? [], 
    [filteredBoard?.columns]
  );

  // Handler to add a new column with a placeholder name and trigger inline edit
  const handleAddColumnClick = useCallback(() => {
    if (!board) return;
    const width = board.columns.length ? 100 / (board.columns.length + 1) : 100;
    void createColumn('New Column', width);
  }, [board, createColumn]);

  // Handle inline edit start
  const startHeaderEdit = () => {
    if (board) {
      setIsEditingHeader(true);
      requestAnimationFrame(() => {
        headerInputRef.current?.select();
      });
    }
  };

  // Handler to open the New Card dialog for a specific column
  const handleOpenNewCardDialog = useCallback((columnId: string) => {
    setAddingCardToColumnId(columnId);
  }, []);

  // Different UI states
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="glass-card glass-depth-2 p-4 max-w-md border-red-500/20">
          <h3 className="text-lg font-semibold mb-2">Error Loading Board</h3>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="glass-card glass-depth-2 p-4 max-w-md">
          <h3 className="text-lg font-semibold mb-2">No Board Data</h3>
          <p>Unable to load the board data. Please try again later.</p>
        </div>
      </div>
    );
  }

  // Column count stat
  const columnCount = filteredBoard?.columns?.length ?? 0;

  return (
    <div className="relative flex flex-col h-full w-full p-2">
      {/* Board Header */}
      <BoardHeader
        title={headerTitle}
        onChange={setHeaderTitle}
        isEditing={isEditingHeader}
        onEditStart={startHeaderEdit}
        onSave={() => {
          if (board && headerTitle.trim() && board.title !== headerTitle.trim()) {
            onRenameBoard?.(board.id, headerTitle.trim());
          }
          setIsEditingHeader(false);
        }}
        onCancel={() => {
          setHeaderTitle(board.title);
          setIsEditingHeader(false);
        }}
        sidebarOpen={sidebarOpen}
        columnCount={columnCount}
        cardCount={cardCount}
        onAddColumnClick={handleAddColumnClick}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        theme={theme}
        toggleTheme={toggleTheme}
        inputRef={headerInputRef}
      />
      
      {/* Board Content with dnd-kit */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        // Only measure droppables before dragging to avoid infinite loops during drag
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.BeforeDragging,
            frequency: MeasuringFrequency.Optimized,
          },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div 
          className="flex flex-grow overflow-x-auto overflow-y-hidden h-full transition-all duration-300 pt-2 pb-0 gap-x-2 justify-start"
        >
          <SortableContext 
            items={columnsIds} 
            strategy={horizontalListSortingStrategy}
          >
            {filteredBoard?.columns?.map((column) => (
              column?.id ? <SortableColumn key={column.id} column={column} onAddCardClick={handleOpenNewCardDialog} /> : null
            ))}
          </SortableContext>
        </div>
        
        <DragOverlay zIndex={9999}>
          {activeItem?.type === 'column' && activeItem.column && (
            <div style={overlayStyle}>
              <SortableColumn column={activeItem.column} dragOverlay onAddCardClick={handleOpenNewCardDialog} />
            </div>
          )}
          {activeItem?.type === 'card' && activeItem.card && typeof activeItem.index === 'number' && activeItem.columnId && (
            <div className="card-wrapper dragging">
              <Card 
                card={activeItem.card} 
                index={activeItem.index} 
                columnId={activeItem.columnId} 
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Conditionally Render New Card Sheet/Dialog outside the column context */}
      {addingCardToColumnId && (
        <NewCardSheet
          isOpen={!!addingCardToColumnId}
          onOpenChange={(open) => {
            if (!open) setAddingCardToColumnId(null);
          }}
          columnId={addingCardToColumnId}
        />
      )}
    </div>
  );
}; 