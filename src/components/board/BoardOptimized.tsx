'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState, memo } from 'react';
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
import { Card } from './Card';
import type { Board as BoardType } from '~/types';
import { useTheme } from '~/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Card as CardType, Column as ColumnType } from '~/types';
import { NewCardSheet } from './NewCardSheet';
import { AddColumnSheet } from './AddColumnSheet';
import { BoardHeader } from './BoardHeader';
import { ShareBoardSheet } from './ShareBoardSheet';
import { useBoardOptimized } from '~/hooks/useBoardOptimized';
import { useOptimizedMutations } from '~/hooks/useMutationsOptimized';
import { useBoard } from '~/hooks/useBoard';
import { useBoardMutations } from '~/hooks/useBoardMutations';
import { useDragSensors } from '~/hooks/useDragSensors';
import { PanelLeft } from 'lucide-react';

// Props for header inline editing and external focus control
export interface BoardOptimizedProps {
  focusEditTitleBoardId?: string | null;
  clearFocusEdit?: () => void;
  sidebarOpen: boolean;
  boardId: string | null;
  onToggleSidebar: () => void;
}

export const BoardOptimized = memo<BoardOptimizedProps>(function BoardOptimized({
  focusEditTitleBoardId,
  clearFocusEdit,
  sidebarOpen,
  boardId: propBoardId,
  onToggleSidebar,
}) {
  // Use optimized hooks
  const { board, loading, error, refetch: smartRefetch, updateLocal: updateBoardLocal } = useBoardOptimized(propBoardId);
  const mutations = useOptimizedMutations(propBoardId, updateBoardLocal, smartRefetch);
  const { theme, toggleTheme } = useTheme();
  
  // Local UI state - memoized to prevent unnecessary re-renders
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addingCardToColumnId, setAddingCardToColumnId] = useState<string | null>(null);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isAddColumnSheetOpen, setIsAddColumnSheetOpen] = useState(false);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<{
    type: 'card' | 'column';
    card?: CardType;
    column?: ColumnType;
    index?: number;
    columnId?: string;
  } | null>(null);
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  // Refs for stable operations
  const headerInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Initialize header title when board changes
  useEffect(() => {
    if (board?.title && headerTitle !== board.title) {
      setHeaderTitle(board.title);
    }
  }, [board?.title]);

  // Focus edit trigger effect
  useEffect(() => {
    if (board && focusEditTitleBoardId === board.id) {
      setIsEditingHeader(true);
      requestAnimationFrame(() => {
        headerInputRef.current?.select();
      });
      clearFocusEdit?.();
    }
  }, [focusEditTitleBoardId, board, clearFocusEdit]);

  useMousePositionStyle(headerRef);

  // Stable sensor configuration
  const sensors = useDragSensors();

  // Optimized drag handlers with immediate feedback
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const data = active.data?.current;
    if (!data) return;

    if (data.type === 'card') {
      document.documentElement.classList.add('card-dragging-active');
    }
    setActiveItem(data);

    if (data.type === 'column') {
      const el = document.querySelector(`[data-column-id="${active.id}"]`);
      if (el instanceof HTMLElement) {
        const { width, height } = el.getBoundingClientRect();
        setOverlayStyle({ width, height });
      }
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id || !board) return;

    const activeData = active.data.current;
    if (activeData?.type !== 'card' || !activeData.columnId) return;

    const overData = over.data.current;
    const targetColumnId = overData?.type === 'column' ? (over.id as string) : overData?.columnId;
    
    if (!targetColumnId || targetColumnId === activeData.columnId) return;

    // Validate parameters before calling mutation
    const activeCardId = active.id as string;
    if (!activeCardId || !targetColumnId) {
      console.warn('handleDragOver: Invalid parameters', { activeCardId, targetColumnId });
      return;
    }

    // Use direct mutation call - the hook handles all queuing and optimization
    const targetColumn = board.columns.find(c => c.id === targetColumnId);
    
    if (targetColumn) {
      const newOrder = targetColumn.cards.length;
      mutations.moveCard(activeCardId, targetColumnId, newOrder);
    } else {
      console.warn('handleDragOver: Target column not found', { targetColumnId });
    }
  }, [board, mutations]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active || !over || !board) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current;
    
    // Handle column reordering
    if (activeData?.type === 'column' && activeId !== overId) {
      const oldIndex = board.columns.findIndex(col => col.id === activeId);
      const newIndex = board.columns.findIndex(col => col.id === overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Use direct mutation call
        const columnOrders = arrayMove(board.columns, oldIndex, newIndex)
          .map((col, index) => ({ id: col.id, order: index }));
          
        mutations.reorderColumns(board.id, columnOrders);
      }
    }
    
    // Same-column card reordering
    else if (activeData?.type === 'card' && activeData.columnId) {
      const sourceColumnId = activeData.columnId;
      const overData = over.data.current;
      
      if (overData?.type === 'card' && overData.columnId === sourceColumnId) {
        const column = board.columns.find(col => col.id === sourceColumnId);
        if (column) {
          const oldIndex = column.cards.findIndex(card => card.id === activeId);
          const newIndex = column.cards.findIndex(card => card.id === overId);
          
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            // Validate parameters before calling mutation
            if (!activeId || !sourceColumnId || typeof newIndex !== 'number') {
              console.warn('handleDragEnd: Invalid parameters for same-column reorder', { 
                activeId, sourceColumnId, newIndex 
              });
              return;
            }
            
            // Use direct mutation call
            mutations.moveCard(activeId, sourceColumnId, newIndex);
          }
        } else {
          console.warn('handleDragEnd: Source column not found', { sourceColumnId });
        }
      }
    }
    
    // Cleanup
    setActiveId(null);
    setActiveItem(null);
    document.documentElement.classList.remove('card-dragging-active');
  }, [board, mutations]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveItem(null);
    document.documentElement.classList.remove('card-dragging-active');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('card-dragging-active');
    };
  }, []);

  // Optimized keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      
      // Prevent space/enter from activating drag when typing
      if (event.key === ' ' || event.key === 'Enter') {
        const target = event.target as HTMLElement;
        if (target) {
          const isInteractive = ['input', 'textarea'].includes(target.tagName.toLowerCase()) ||
                               target.contentEditable === 'true' ||
                               target.closest('.w-md-editor, [data-no-dnd="true"], .cm-editor');
          
          if (isInteractive) {
            event.stopPropagation();
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Memoized computed values to prevent recalculation
  const filteredBoard = useMemo(() => {
    if (!board) return null;
    if (!searchQuery?.trim()) return board;
    
    const query = searchQuery.toLowerCase();
    const columns = board.columns.map(column => {
      const filteredCards = column.cards.filter(card => 
        card.title?.toLowerCase().includes(query) ||
        card.description?.toLowerCase().includes(query) ||
        card.labels?.some(label => label.name?.toLowerCase().includes(query))
      );
      return { ...column, cards: filteredCards };
    });
    
    return { ...board, columns };
  }, [board, searchQuery]);

  const cardCount = useMemo(() => 
    filteredBoard?.columns.reduce((acc, col) => acc + col.cards.length, 0) ?? 0,
    [filteredBoard]
  );

  const columnCount = filteredBoard?.columns.length ?? 0;

  const columnsIds = useMemo(() => 
    filteredBoard?.columns.map(col => col.id) ?? [], 
    [filteredBoard]
  );

  // Memoized handlers to prevent recreation
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleAddColumnClick = useCallback(() => {
    setIsAddColumnSheetOpen(true);
  }, []);

  const handleOpenNewCardDialog = useCallback((columnId: string) => {
    setAddingCardToColumnId(columnId);
  }, []);

  const handleSaveTitle = useCallback(async () => {
    console.log('[handleSaveTitle] called', { boardId: board?.id, headerTitle, boardTitle: board?.title });
    if (board && headerTitle.trim() && board.title !== headerTitle.trim()) {
      await mutations.updateBoard(board.id, { title: headerTitle.trim() });
    }
    setIsEditingHeader(false);
  }, [board, headerTitle, mutations]);

  const handleCancelTitle = useCallback(() => {
    setHeaderTitle(board?.title || '');
    setIsEditingHeader(false);
  }, [board?.title]);

  // Handler to refresh board data when a new column is added via sheet
  const handleColumnAdded = useCallback(() => {
    smartRefetch();
  }, [smartRefetch]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Error state
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

  // No board state
  if (!board) {
    return (
      <div className="relative flex flex-col h-full w-full" style={{ padding: 'var(--board-padding)' }}>
        {/* Minimal Header with Sidebar Toggle */}
        <header className="glass-column border rounded-lg shadow-md py-1.5 flex items-center justify-between mb-2" style={{ height: 'var(--header-height, auto)', paddingLeft: 'var(--board-padding)', paddingRight: 'var(--board-padding) - 1rem' }}>
          <motion.div 
            className="flex items-center"
            layout
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {!sidebarOpen && (
              <motion.button
                layoutId="sidebar-toggle"
                aria-label="Open sidebar"
                className="mr-2 p-1 h-8 w-8 flex items-center justify-center rounded hover:bg-muted/10"
                onClick={onToggleSidebar}
              >
                <PanelLeft size={16} />
              </motion.button>
            )}
            <h1 className="text-2xl font-bold">No Board Selected</h1>
          </motion.div>
        </header>
        
        {/* No Board Message */}
        <div className="flex items-center justify-center h-full w-full">
          <div className="glass-card glass-depth-2 p-4 max-w-md">
            <h3 className="text-lg font-semibold mb-2">No Board Data</h3>
            <p>Create a new board from the sidebar to get started.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full w-full" style={{ padding: 'var(--board-padding)' }}>
      {/* Board Header */}
      <BoardHeader
        title={headerTitle}
        onChange={setHeaderTitle}
        isEditing={isEditingHeader}
        onEditStart={() => {
          setIsEditingHeader(true);
          requestAnimationFrame(() => headerInputRef.current?.select());
        }}
        onSave={handleSaveTitle}
        onCancel={handleCancelTitle}
        sidebarOpen={sidebarOpen}
        columnCount={columnCount}
        cardCount={cardCount}
        onAddColumnClick={handleAddColumnClick}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        inputRef={headerInputRef}
        onOpenShareSheet={() => setIsShareSheetOpen(true)}
        onToggleSidebar={onToggleSidebar}
      />
      
      {/* Board Content with optimized dnd-kit */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
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
          className="flex flex-grow overflow-x-auto overflow-y-hidden h-full transition-all duration-300 pb-0 justify-start"
          style={{ 
            paddingTop: 'var(--board-gutter)', 
            gap: 'calc(var(--column-gutter) * 2)' 
          }}
        >
          <SortableContext 
            items={columnsIds} 
            strategy={horizontalListSortingStrategy}
          >
            {filteredBoard.columns.map((column) => (
              <SortableColumn 
                key={column.id} 
                column={column} 
                onAddCardClick={handleOpenNewCardDialog} 
                boardId={board.id}
                updateColumn={mutations.updateColumn}
                deleteColumn={mutations.deleteColumn}
              />
            ))}
          </SortableContext>
        </div>
        
        <DragOverlay zIndex={9999}>
          {activeItem?.type === 'column' && activeItem.column && (
            <div style={overlayStyle}>
              <SortableColumn 
                column={activeItem.column} 
                dragOverlay 
                onAddCardClick={handleOpenNewCardDialog} 
                boardId={board.id}
                updateColumn={mutations.updateColumn}
                deleteColumn={mutations.deleteColumn}
              />
            </div>
          )}
          {activeItem?.type === 'card' && activeItem.card && typeof activeItem.index === 'number' && activeItem.columnId && (
            <div className="card-wrapper dragging">
              <Card 
                card={activeItem.card} 
                index={activeItem.index} 
                columnId={activeItem.columnId}
                boardId={board.id}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Conditionally Render New Card Sheet */}
      {addingCardToColumnId && (
        <NewCardSheet
          isOpen={!!addingCardToColumnId}
          onOpenChange={(open) => {
            if (!open) setAddingCardToColumnId(null);
          }}
          columnId={addingCardToColumnId}
          boardId={board.id}
        />
      )}

      {/* Conditionally Render Share Board Sheet */}
      {isShareSheetOpen && (
        <ShareBoardSheet
          isOpen={isShareSheetOpen}
          onOpenChange={setIsShareSheetOpen}
          boardId={board.id}
          boardTitle={board.title}
        />
      )}

      {/* Conditionally Render Add Column Sheet */}
      {isAddColumnSheetOpen && (
        <AddColumnSheet
          isOpen={isAddColumnSheetOpen}
          onOpenChange={setIsAddColumnSheetOpen}
          boardId={board.id}
          onColumnAdded={handleColumnAdded}
          createColumn={mutations.createColumn}
        />
      )}
    </div>
  );
});

BoardOptimized.displayName = 'BoardOptimized'; 