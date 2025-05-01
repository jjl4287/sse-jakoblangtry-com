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
import { motion } from 'framer-motion';
import { useTheme } from '~/app/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import { ColumnAddForm } from './ColumnAddForm';
import { clsx } from 'clsx';
import type { Card as CardType, Column as ColumnType } from '~/types';

export type BoardProps = {
  sidebarOpen: boolean;
};

export const Board: React.FC<BoardProps> = ({ sidebarOpen }) => {
  const {
    board,
    loading,
    error,
    saveStatus,
    saveError,
    moveCard,
    moveColumn
  } = useBoard();
  
  // Keep a ref to board to use in stable callbacks without re-defining on every change
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Local state for search query filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Use the custom hook for the header lighting effect
  useMousePositionStyle(headerRef);

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
      <header className="glass-card glass-border-animated p-2 mb-1 flex items-center justify-between rounded-lg">
        {/* Board Title */}
        <h2 
          className={clsx(
            "text-2xl font-bold truncate text-neutral-900 dark:text-white max-w-[30vw] transition-all duration-300",
            sidebarOpen ? "pl-0" : "pl-10"
          )}
        >
          {board.title}
        </h2>
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            {columnCount} Columns
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            {cardCount} Cards
          </div>
          <button onClick={() => setIsAddingColumn(true)} className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            + Add Column
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-3 py-1 h-8 w-48 bg-white/5 border-white/20 focus-visible:ring-offset-0 focus-visible:ring-white/50 rounded-full"
            />
          </div>
          <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="p-1">
            {theme === 'dark' ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-blue-200" />}
          </button>
        </div>
      </header>
      
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
          className={clsx(
            "flex flex-grow overflow-x-auto overflow-y-hidden h-full transition-all duration-300 pt-1 pb-0 gap-x-1 justify-start -mx-1",
            sidebarOpen ? "justify-start" : "justify-between"
          )}
        >
          <SortableContext 
            items={columnsIds} 
            strategy={horizontalListSortingStrategy}
          >
            {filteredBoard?.columns?.map((column) => (
              column?.id ? <SortableColumn key={column.id} column={column} /> : null
            ))}
          </SortableContext>
        </div>
        
        <DragOverlay zIndex={9999}>
          {activeItem?.type === 'column' && activeItem.column && (
            <div className="column-drag-overlay" style={overlayStyle}>
              <Column column={activeItem.column} />
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
    </div>
  );
}; 