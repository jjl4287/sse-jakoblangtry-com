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
import { BoardHeader } from './BoardHeader';
import { ShareBoardSheet } from './ShareBoardSheet';
import { useColumnMutations } from '~/hooks/useColumn';
import { useCardMutations } from '~/hooks/useCard';
import { useBoardMutations } from '~/hooks/use-board-mutations';

// Props for header inline editing and external focus control
export interface BoardProps {
  focusEditTitleBoardId?: string | null;
  clearFocusEdit?: () => void;
  sidebarOpen: boolean;
  board: BoardType | null;
  loading: boolean;
  error: Error | null;
  refetch?: () => void;
}

// Utility function for professional debouncing with cancellation
function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { debouncedFn, cancel };
}

// Professional merge patch system for drag operations
interface PendingCardMove {
  cardId: string;
  targetColumnId: string;
  newOrder: number;
  timestamp: number;
}

interface PendingColumnReorder {
  boardId: string;
  columnOrders: { id: string; order: number }[];
  timestamp: number;
}

export const Board: React.FC<BoardProps> = ({ 
  focusEditTitleBoardId, 
  clearFocusEdit, 
  sidebarOpen,
  board,
  loading,
  error,
  refetch
}) => {
  // Use mutation hooks
  const { createColumn: createColumnMutation, reorderColumns } = useColumnMutations();
  const { moveCard } = useCardMutations();
  const { updateBoard } = useBoardMutations();
  const { theme, toggleTheme } = useTheme();
  
  // Header inline edit state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState<string>(board?.title ?? '');
  // Ref for header input selection
  const headerInputRef = useRef<HTMLInputElement>(null);

  // State for optimistic updates
  const [optimisticBoard, setOptimisticBoard] = useState<BoardType | null>(null);

  // Professional merge patch system state
  const pendingCardMoves = useRef<Map<string, PendingCardMove>>(new Map());
  const pendingColumnReorder = useRef<PendingColumnReorder | null>(null);

  useEffect(() => {
    // Reset optimistic board when actual board data changes
    setOptimisticBoard(null);
    // Clear any pending operations when board data changes
    pendingCardMoves.current.clear();
    pendingColumnReorder.current = null;
  }, [board]);

  // Use optimistic board if available, otherwise use actual board
  const displayBoard = optimisticBoard || board;

  // Professional debounced batch operations
  const { debouncedFn: processPendingChanges, cancel: cancelPendingChanges } = useDebounce(async () => {
    if (!board) return;

    try {
      // Process card moves in batch
      const cardMovePromises: Promise<any>[] = [];
      for (const [cardId, move] of pendingCardMoves.current) {
        console.log(`🔄 Processing card move: ${cardId} → column ${move.targetColumnId} at position ${move.newOrder}`);
        cardMovePromises.push(
          moveCard(move.cardId, move.targetColumnId, move.newOrder)
            .catch(error => {
              console.error(`Failed to move card ${cardId}:`, error);
              return null;
            })
        );
      }

      // Process column reorder
      let columnReorderPromise: Promise<any> | null = null;
      if (pendingColumnReorder.current) {
        console.log(`🔄 Processing column reorder for board ${pendingColumnReorder.current.boardId}`);
        columnReorderPromise = reorderColumns(
          pendingColumnReorder.current.boardId, 
          pendingColumnReorder.current.columnOrders
        ).catch(error => {
          console.error('Failed to reorder columns:', error);
          return null;
        });
      }

      // Execute all operations in parallel
      const allPromises = [
        ...cardMovePromises,
        ...(columnReorderPromise ? [columnReorderPromise] : [])
      ];

      if (allPromises.length > 0) {
        await Promise.allSettled(allPromises);
        
        // Clear processed operations
        pendingCardMoves.current.clear();
        pendingColumnReorder.current = null;
        
        // Refresh board data after successful batch operation
        console.log('✅ Batch operations completed, refreshing board data');
        refetch?.();
      }
    } catch (error) {
      console.error('❌ Batch operation failed:', error);
      // On critical error, clear optimistic state and refetch immediately
      setOptimisticBoard(null);
      refetch?.();
    }
  }, 750); // Professional debounce timing: 750ms allows for smooth UX while batching efficiently

  // Enhanced error recovery
  const { debouncedFn: handleErrorRecovery } = useDebounce(() => {
    console.log('🔧 Performing error recovery - clearing optimistic state and refetching');
    setOptimisticBoard(null);
    pendingCardMoves.current.clear();
    pendingColumnReorder.current = null;
    cancelPendingChanges();
    refetch?.();
  }, 100); // Quick error recovery

  useEffect(() => {
    if (board?.title && headerTitle !== board.title) { // Only update if different to avoid re-renders
      setHeaderTitle(board.title);
    }
  }, [board?.title]);

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
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

  // Define sensors with standard dnd-kit sensors
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

  // Handle drag over for cross-column card moves with optimistic updates
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

    const currentBoard = displayBoard;
    if (!currentBoard) return;

    const targetColumn = currentBoard.columns.find(c => c.id === targetColumnId);
    if (!targetColumn) return;

    const alreadyInTarget = targetColumn.cards.some(c => c.id === active.id);
    if (alreadyInTarget) return;

    // Apply optimistic update
    const activeCardId = active.id as string;
    const sourceColumnId = activeData.columnId;
    const targetIndex = targetColumn.cards.length;

    // Create optimistic board state
    const newColumns = currentBoard.columns.map(col => {
      if (col.id === sourceColumnId) {
        // Remove card from source column
        return {
          ...col,
          cards: col.cards.filter(c => c.id !== activeCardId)
        };
      } else if (col.id === targetColumnId) {
        // Add card to target column
        const card = currentBoard.columns
          .find(c => c.id === sourceColumnId)?.cards
          .find(c => c.id === activeCardId);
        if (card) {
          return {
            ...col,
            cards: [...col.cards, { ...card, columnId: targetColumnId, order: targetIndex }]
          };
        }
      }
      return col;
    });

    setOptimisticBoard({ ...currentBoard, columns: newColumns });
    
    // Professional merge patch: Add to pending operations
    pendingCardMoves.current.set(activeCardId, {
      cardId: activeCardId,
      targetColumnId,
      newOrder: targetIndex,
      timestamp: Date.now()
    });
    
    // Schedule batch processing
    processPendingChanges();
    
    lastCrossColumnMove.current = targetColumnId;
  }, [displayBoard, processPendingChanges]);

  // Handle drag end for both card and column movement with optimistic updates
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active || !over || !displayBoard) return;
    
    // Extract data
    const activeId = active.id as string;
    const overId = over.id as string;
    
    const activeData = active.data.current as { type: string; columnId?: string; index?: number };
    const overData = over.data.current as { type: string; columnId?: string };
    
    // Handle column movement
    if (activeData?.type === 'column') {
      if (activeId !== overId) {
        // Apply optimistic update for column reordering
        const oldIndex = displayBoard.columns.findIndex(col => col.id === activeId);
        const newIndex = displayBoard.columns.findIndex(col => col.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1 && board) {
          const newColumns = arrayMove(displayBoard.columns, oldIndex, newIndex);
          // Update the order property to match new positions
          const columnOrders = newColumns.map((col, index) => ({ id: col.id, order: index }));
          
          // Apply optimistic update with new orders
          const optimisticColumns = newColumns.map((col, index) => ({ ...col, order: index }));
          setOptimisticBoard({ ...displayBoard, columns: optimisticColumns });
          
          // Professional merge patch: Add to pending operations
          pendingColumnReorder.current = {
            boardId: board.id,
            columnOrders,
            timestamp: Date.now()
          };
          
          // Schedule batch processing
          processPendingChanges();
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
        const targetColumn = displayBoard.columns.find(col => col.id === targetColumnId);
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
        const targetColumn = displayBoard.columns.find(col => col.id === targetColumnId);
        if (targetColumn) {
          targetIndex = targetColumn.cards.length;
        }
      }
      
      // Only move if needed and if we didn't already move during dragOver
      if (sourceColumnId !== targetColumnId || activeData.index !== targetIndex) {
        // Apply optimistic update for card movement within same column
        if (sourceColumnId === targetColumnId) {
          const column = displayBoard.columns.find(col => col.id === sourceColumnId);
          if (column) {
            const oldIndex = column.cards.findIndex(card => card.id === activeCardId);
            if (oldIndex !== -1 && targetIndex !== undefined) {
              const newCards = arrayMove(column.cards, oldIndex, targetIndex).map((card, index) => ({
                ...card,
                order: index
              }));
              
              const newColumns = displayBoard.columns.map(col => 
                col.id === sourceColumnId ? { ...col, cards: newCards } : col
              );
              
              setOptimisticBoard({ ...displayBoard, columns: newColumns });
            }
          }
        }
        
        // Professional merge patch: Add to pending operations (only if not handled in dragOver)
        if (!lastCrossColumnMove.current) {
          pendingCardMoves.current.set(activeCardId, {
            cardId: activeCardId,
            targetColumnId: targetColumnId ?? '',
            newOrder: targetIndex ?? 0,
            timestamp: Date.now()
          });
          
          // Schedule batch processing
          processPendingChanges();
        }
      }
    }
    
    // Clear active items
    setActiveId(null);
    setActiveItem(null);
    // Remove dragging-in-progress class and reset cross-column ref
    document.documentElement.classList.remove('card-dragging-active');
    lastCrossColumnMove.current = '';
  }, [displayBoard, processPendingChanges]);

  // Reset active items if drag is canceled
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveItem(null);
    // Remove class and reset if drag is cancelled
    document.documentElement.classList.remove('card-dragging-active');
    lastCrossColumnMove.current = '';
    
    // Professional cleanup: Cancel pending operations on drag cancel
    cancelPendingChanges();
    handleErrorRecovery();
  }, [cancelPendingChanges, handleErrorRecovery]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Cancel any pending operations when component unmounts
      cancelPendingChanges();
      document.documentElement.classList.remove('card-dragging-active');
    };
  }, [cancelPendingChanges]);

  // Add keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Cmd/Ctrl+K for search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      
      // Prevent space and enter keys from activating drag operations when typing in interactive elements
      if (event.key === ' ' || event.code === 'Space' || event.key === 'Enter' || event.code === 'Enter') {
        const target = event.target as HTMLElement;
        
        // Check if we're in an interactive element
        if (target) {
          const tagName = target.tagName.toLowerCase();
          const isInteractive = tagName === 'input' || 
                                tagName === 'textarea' || 
                                target.contentEditable === 'true';
          
          // Check if we're in a markdown editor or any element marked as no-dnd
          const isInMarkdownEditor = target.closest('.w-md-editor') !== null ||
                                    target.closest('[data-no-dnd="true"]') !== null ||
                                    target.closest('.cm-editor') !== null ||
                                    target.classList.contains('cm-content') ||
                                    target.classList.contains('cm-line');
          
          if (isInteractive || isInMarkdownEditor) {
            // Don't prevent default (allow normal typing behavior)
            // But stop propagation to prevent drag activation
            event.stopPropagation();
            return;
          }
        }
      }
    };

    // Use capture phase to catch events before they reach the dnd sensors
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  // Filter cards based on search query
  const filteredBoard = useMemo(() => {
    if (!displayBoard) return null;
    if (!searchQuery?.trim()) return displayBoard;
    
    const query = searchQuery.toLowerCase();
    const columns = displayBoard.columns.map(column => {
      const filteredCards = column?.cards?.filter(card => (
        card?.title?.toLowerCase().includes(query) ||
        card?.description?.toLowerCase().includes(query) ||
        card?.labels?.some(label => label?.name?.toLowerCase().includes(query))
      )) ?? [];
      return { ...column, cards: filteredCards };
    });
    
    return { ...displayBoard, columns };
  }, [displayBoard, searchQuery]);

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
  const handleAddColumnClick = useCallback(async () => {
    if (!board) return;
    const width = board.columns.length ? 100 / (board.columns.length + 1) : 100;
    
    try {
      await createColumnMutation(board.id, { title: 'New Column', width });
      // Refresh the board data to show the new column
      refetch?.();
    } catch (error) {
      console.error('Failed to create column:', error);
    }
  }, [board, createColumnMutation, refetch]);

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
        onEditStart={() => {
          setIsEditingHeader(true);
          requestAnimationFrame(() => {
            headerInputRef.current?.select();
          });
        }}
        onSave={async () => {
          if (board && headerTitle.trim() && board.title !== headerTitle.trim()) {
            try {
              await updateBoard(board.id, { title: headerTitle.trim() });
              refetch?.();
            } catch (error) {
              console.error('Failed to update board title:', error);
            }
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
        onOpenShareSheet={() => setIsShareSheetOpen(true)}
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
          className="flex flex-grow overflow-x-auto overflow-y-hidden h-full transition-all duration-300 pt-2 pb-0 gap-x-1 justify-start"
        >
          <SortableContext 
            items={columnsIds} 
            strategy={horizontalListSortingStrategy}
          >
            {filteredBoard?.columns?.map((column) => (
              column?.id ? <SortableColumn key={column.id} column={column} onAddCardClick={handleOpenNewCardDialog} boardId={board?.id} /> : null
            ))}
          </SortableContext>
        </div>
        
        <DragOverlay zIndex={9999}>
          {activeItem?.type === 'column' && activeItem.column && (
            <div style={overlayStyle}>
              <SortableColumn column={activeItem.column} dragOverlay onAddCardClick={handleOpenNewCardDialog} boardId={board?.id} />
            </div>
          )}
          {activeItem?.type === 'card' && activeItem.card && typeof activeItem.index === 'number' && activeItem.columnId && (
            <div className="card-wrapper dragging">
              <Card 
                card={activeItem.card} 
                index={activeItem.index} 
                columnId={activeItem.columnId}
                boardId={board?.id}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Conditionally Render New Card Sheet/Dialog outside the column context */}
      {addingCardToColumnId && board && (
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
      {board && isShareSheetOpen && (
        <ShareBoardSheet
          isOpen={isShareSheetOpen}
          onOpenChange={setIsShareSheetOpen}
          boardId={board.id}
          boardTitle={board.title}
        />
      )}
    </div>
  );
}; 