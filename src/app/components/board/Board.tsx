'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Column } from './Column';
import { useBoard } from '~/services/board-context';
import { motion } from 'framer-motion';
import { useTheme } from '~/app/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import { ColumnAddForm } from './ColumnAddForm';
import { clsx } from 'clsx';

export type BoardProps = {
  sidebarOpen: boolean;
};

export const Board: React.FC<BoardProps> = ({ sidebarOpen }) => {
  const { board, loading, error, searchQuery, setSearchQuery, moveCard, moveColumn } = useBoard();
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use the custom hook for the header lighting effect
  useMousePositionStyle(headerRef);

  // Handle DnD end for both intra- and inter-column moves
  const onDragEnd = useCallback((result: DropResult) => {
    const { source, destination, draggableId, type } = result;
    if (!destination || !board) return;
    if (type === 'COLUMN') {
      const { index: srcIdx } = source;
      const { index: destIdx } = destination;
      if (srcIdx === destIdx) return;
      void moveColumn(draggableId, destIdx);
    } else {
      const { index: srcIdx, droppableId: srcCol } = source;
      const { index: destIdx, droppableId: destCol } = destination;
      if (srcCol === destCol && srcIdx === destIdx) return;
      // Use the UI drop index directly for DB order
      void moveCard(draggableId, destCol, destIdx, destIdx);
    }
  }, [board, moveCard, moveColumn]);

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
    if (!searchQuery.trim()) return board;
    
    const query = searchQuery.toLowerCase();
    const columns = board.columns.map(column => ({
      ...column,
      cards: column.cards.filter(card => 
        card.title.toLowerCase().includes(query) || 
        card.description?.toLowerCase().includes(query) || 
        card.labels.some(label => label.name.toLowerCase().includes(query))
      )
    }));
    
    return { ...board, columns };
  }, [board, searchQuery]);

  // Calculate card count based on filtered board
  const cardCount = useMemo(() => {
    return filteredBoard?.columns?.reduce((acc, col) => {
      if (col?.cards) {
        return acc + col.cards.length;
      }
      return acc;
    }, 0) ?? 0;
  }, [filteredBoard]);

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
      <motion.div 
        ref={headerRef}
        className="glass-column glass-border-animated p-2 mb-1 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 rounded-lg"
        style={{ 
          // CSS variables --x and --y are now set by the hook
          transformOrigin: "center center" 
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center flex-grow mr-4 min-w-0">
          <h2 className={clsx(
            "text-lg font-semibold whitespace-nowrap truncate transition-all duration-300 ease-in-out",
            { 'pl-10': !sidebarOpen } // Add padding only when sidebar is closed
          )} style={{ color: 'var(--sidebar-primary-foreground)' }}>
            {board.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center space-x-0 space-y-2 sm:space-y-0 sm:space-x-3 flex-shrink-0">
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm w-full sm:w-auto text-center">
            {columnCount} Columns
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm w-full sm:w-auto text-center">
            {cardCount} Cards
          </div>
          <button
            onClick={() => setIsAddingColumn(true)}
            className="glass-button px-3 py-1 rounded-full text-sm shadow-sm w-full sm:w-auto text-center"
          >
            + Add Column
          </button>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-3 py-1 h-8 w-full sm:w-48 bg-white/5 border-white/20 focus-visible:ring-offset-0 focus-visible:ring-white/50 rounded-full"
            />
          </div>
          <button onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="p-1 ml-2">
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-blue-200" />
            )}
          </button>
        </div>
      </motion.div>
      
      {/* Board Content */}
      <motion.div className="flex-1 overflow-hidden pt-2 pb-0" layout={false}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board" type="COLUMN" direction="horizontal">
            {(prov) => (
              <div
                ref={prov.innerRef}
                {...prov.droppableProps}
                className="flex h-full overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent gap-x-4"
              >
                {(filteredBoard?.columns ?? []).map((column, index) => (
                  <Draggable key={column.id} draggableId={column.id} index={index}>
                    {(provD) => (
                      <div
                        ref={provD.innerRef}
                        {...provD.draggableProps}
                        {...provD.dragHandleProps}
                        style={{ ...provD.draggableProps.style }}
                        className="flex flex-col h-full flex-1 min-w-[250px]"
                      >
                        <Column column={column} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {prov.placeholder}
                {/* Inline Add Column Form as a new column slot */}
                {isAddingColumn && (
                  <div className="flex flex-col h-full flex-1 min-w-[250px]">
                    <ColumnAddForm onCancel={() => setIsAddingColumn(false)} />
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </motion.div>
    </div>
  );
}; 