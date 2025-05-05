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
  verticalListSortingStrategy,
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
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { BoardSettings } from './ui/BoardSettings';
import { Settings } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { BoardService } from '~/services/board-service';
import { CardDetailsSheet } from './ui/CardDetailsSheet';

// Props for header inline editing and external focus control
export interface BoardProps {
  focusEditTitleBoardId?: string | null;
  clearFocusEdit?: () => void;
  onRenameBoard?: (id: string, title: string) => void;
  sidebarOpen: boolean;
}

// Insert Member interface under component imports
interface Member { id: string; name: string; email?: string; joinedAt: string; }

export const Board: React.FC<BoardProps> = ({ focusEditTitleBoardId, clearFocusEdit, onRenameBoard, sidebarOpen }) => {
  const {
    board,
    loading,
    error,
    saveStatus,
    saveError,
    moveCard,
    moveColumn,
    createColumn
  } = useBoard();
  const { theme, toggleTheme } = useTheme();
  
  // Header inline edit state
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState<string>(() => board?.title ?? '');
  // Ref for header input selection
  const headerInputRef = useRef<HTMLInputElement>(null);

  // If external focus request matches this board, enter edit mode
  useEffect(() => {
    if (board && focusEditTitleBoardId === board.id) {
      setIsEditingHeader(true);
      setHeaderTitle(board.title);
      // Select text after state update and render
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

  // State for the new Card Details Sheet
  const [selectedCardForSheet, setSelectedCardForSheet] = useState<CardType | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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

  // Ref for header element, used by mouse position hook
  const headerRef = useRef<HTMLDivElement>(null);
  useMousePositionStyle(headerRef);

  // Declare ref for search input to focus on keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Members and settings panel state (always declared)
  const [members, setMembers] = useState<Member[]>([]);
  const [openSettings, setOpenSettings] = useState(false);

  // Fetch board members on board change
  useEffect(() => {
    if (board?.id) {
      BoardService.listBoardMembers(board.id)
        .then(setMembers)
        .catch(console.error);
    }
  }, [board?.id]);

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
      
      // Perform the move if target identified
      if (targetColumnId && sourceColumnId && typeof targetIndex === 'number') {
        // Cast targetIndex to Number to satisfy linter, though it should already be a number
        moveCard(activeCardId, targetColumnId, Number(targetIndex)); 
      }
    }
    
    // Reset active item and overlay style after drag
    setActiveId(null);
    setActiveItem(null);
    setOverlayStyle({});
    lastCrossColumnMove.current = '';
    document.documentElement.classList.remove('card-dragging-active');
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
    const calculatedWidth = board.columns.length ? 100 / (board.columns.length + 1) : 100;
    // Calling with string title and number width, as per definition
    void createColumn('New Column', calculatedWidth);
  }, [board, createColumn]);

  // Handle inline edit start
  const startHeaderEdit = () => {
    if (board) {
      setIsEditingHeader(true);
      setHeaderTitle(board.title);
      // Select text after state update and render
      requestAnimationFrame(() => {
        headerInputRef.current?.select();
      });
    }
  };

  // Map columns and cards by ID for quick lookup
  const columnsById = useMemo(() => {
    if (!board) return {};
    return board.columns.reduce((acc, column) => {
      acc[column.id] = column;
      return acc;
    }, {} as Record<string, ColumnType>);
  }, [board]);

  const cardsById = useMemo(() => {
    if (!board) return {};
    return board.columns.reduce((acc, column) => {
      column.cards.forEach(card => {
        acc[card.id] = { ...card, columnId: column.id }; // Ensure columnId is attached
      });
      return acc;
    }, {} as Record<string, CardType & { columnId: string }>);
  }, [board]);

  // Filtered columns based on search query
  const filteredColumns = useMemo(() => {
    if (!board) return [];
    if (!searchQuery.trim()) return board.columns;

    const lowerCaseQuery = searchQuery.toLowerCase();
    return board.columns.map(column => ({
      ...column,
      cards: column.cards.filter(card =>
        card.title.toLowerCase().includes(lowerCaseQuery) ||
        (card.description && card.description.toLowerCase().includes(lowerCaseQuery))
      ),
    })).filter(column => column.cards.length > 0 || column.title.toLowerCase().includes(lowerCaseQuery));
  }, [board, searchQuery]);

  // Callback to open the sheet with a specific card
  const handleCardClick = useCallback((cardId: string) => {
    const card = boardRef.current?.columns
      .flatMap(col => col.cards)
      .find(c => c.id === cardId);
    if (card) {
      setSelectedCardForSheet(card);
      setIsSheetOpen(true);
    }
  }, []); // Dependencies: boardRef (stable), setSelectedCardForSheet, setIsSheetOpen

  // Callback to close the sheet
  const handleCloseSheet = useCallback(() => {
    setIsSheetOpen(false);
    setSelectedCardForSheet(null); // Clear selected card on close
  }, []); // Dependencies: setIsSheetOpen, setSelectedCardForSheet

  // Callback for creating a new column
  const handleAddColumn = useCallback(async () => {
    if (!board?.id) return;
    const newTitle = `Column ${board.columns.length + 1}`;
    // Assuming createColumn handles optimistic updates or refetching
    await createColumn(board.id, newTitle);
  }, [board, createColumn]);

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

  // Column count stat (using hooks above)
  const columnCount = filteredBoard?.columns?.length ?? 0;

  return (
    <div className="relative flex flex-col h-full w-full p-2">
      {/* Board Header */}
      <header className="glass-card glass-border-animated p-2 mb-1 flex items-center justify-between rounded-lg">
        {/* Inline title edit */}
        {/* Avatars list */}
        <div className="flex -space-x-2 mr-4">
          {members.map(m => (
            <Avatar key={m.id} className="border-2 border-white dark:border-gray-800 h-6 w-6">
              <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        {/* Existing title input or h2 */}
        {isEditingHeader ? (
          <motion.input
            autoFocus
            ref={headerInputRef}
            type="text"
            // Underline only under text, auto-width
            className="text-2xl font-bold bg-transparent border-b-2 border-transparent focus:border-foreground focus:outline-none h-[2rem] leading-[2rem] truncate w-auto inline-block"
            value={headerTitle}
            onChange={(e) => setHeaderTitle(e.target.value)}
            onBlur={() => {
              if (board && headerTitle.trim()) onRenameBoard?.(board.id, headerTitle.trim());
              setIsEditingHeader(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (board && headerTitle.trim()) onRenameBoard?.(board.id, headerTitle.trim());
                setIsEditingHeader(false);
              }
            }}
            initial={{ x: sidebarOpen ? 0 : 40 }}
            animate={{ x: sidebarOpen ? 0 : 40 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          />
        ) : (
          <motion.h2
            // Underline only under text, auto-width
            className="text-2xl font-bold bg-transparent border-b-2 border-transparent h-[2rem] leading-[2rem] truncate text-neutral-900 dark:text-white w-auto inline-block"
            onDoubleClick={startHeaderEdit}
            initial={{ x: sidebarOpen ? 0 : 40 }}
            animate={{ x: sidebarOpen ? 0 : 40 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {board.title}
          </motion.h2>
        )}
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setOpenSettings(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            {columnCount} Columns
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            {cardCount} Cards
          </div>
          <button onClick={handleAddColumnClick} className="glass-button px-3 py-1 rounded-full text-sm shadow-sm whitespace-nowrap">
            + Add Column
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="search"
              id="board-search"
              name="search"
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
          className="flex flex-grow overflow-x-auto overflow-y-hidden h-full transition-all duration-300 pt-1 pb-0 gap-x-1 -mx-1 justify-start"
        >
          <SortableContext 
            items={columnsIds} 
            strategy={horizontalListSortingStrategy}
          >
            {filteredColumns.map((column) => {
              // Filter cards for the current column based on search query
              // Note: Filtering logic remains, but SortableColumn handles rendering its own cards
              // const filteredCards = column.cards.filter(card => 
              //   card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              //   (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()))
              // );
              
              return (
                column?.id ? (
                  <SortableColumn
                    key={column.id}
                    column={column} // Pass the full column object (contains cards)
                    dragOverlay={false}
                    onCardClick={handleCardClick} // Pass the handler down
                    // No children or cards prop needed here
                  />
                ) : null
              );
            })}
          </SortableContext>
        </div>
        
        <DragOverlay zIndex={9999}>
          {activeItem?.type === 'column' && activeItem.column && (
            <div style={overlayStyle}>
              <SortableColumn column={activeItem.column} dragOverlay />
            </div>
          )}
          {activeItem?.type === 'card' && activeItem.card && typeof activeItem.index === 'number' && activeItem.columnId && (
            <div className="card-wrapper dragging">
              <Card 
                card={activeItem.card} 
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Render CardDetailsSheet */}
      {selectedCardForSheet && (
          <CardDetailsSheet
              isOpen={isSheetOpen}
              onOpenChange={(open) => { // Use onOpenChange
                if (!open) { // Only trigger close logic when sheet is closing
                  handleCloseSheet();
                }
              }}
              card={selectedCardForSheet}
              // Pass other necessary props like board members if needed for assignees etc.
              // members={members} 
          />
      )}

      {/* Render Board Settings Panel */}
      <BoardSettings boardId={board.id} open={openSettings} onClose={() => setOpenSettings(false)} />
    </div>
  );
}; 