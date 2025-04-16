'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Column } from './Column';
import { useBoard } from '~/services/board-context';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';

export const Board: React.FC = () => {
  const { board, loading, error, searchQuery, setSearchQuery } = useBoard();
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use the custom hook for the header lighting effect
  useMousePositionStyle(headerRef);

  // Track card drag start
  const handleDragStart = useCallback((item: CardDragItem) => {
    setDraggedCardId(item.id);
    setDragSourceColumnId(item.columnId);
  }, []);

  // Reset drag state when drag ends
  const handleDragEnd = useCallback(() => {
    setDraggedCardId(null);
    setDragSourceColumnId(null);
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
    if (!searchQuery.trim()) return board; // Return original board if search is empty
    
    const query = searchQuery.toLowerCase();
    const columns = board.columns.map(column => ({
      ...column,
      cards: column.cards.filter(card => 
        card.title.toLowerCase().includes(query) || 
        (card.description && card.description.toLowerCase().includes(query)) ||
        card.labels.some(label => label.name.toLowerCase().includes(query))
        // Add other fields to search if needed (e.g., assignees, comments)
      )
    }));
    
    return { ...board, columns };
  }, [board, searchQuery]);

  // Calculate card count based on filtered board
  const cardCount = useMemo(() => {
    if (!filteredBoard || !filteredBoard.columns || !Array.isArray(filteredBoard.columns)) {
      return 0;
    }
    return filteredBoard.columns.reduce((acc, col) => {
      if (col && Array.isArray(col.cards)) {
        return acc + col.cards.length;
      }
      return acc;
    }, 0);
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
    <div className="flex flex-col h-full w-full">
      {/* Board Header */}
      <motion.div 
        ref={headerRef}
        className="glass-column glass-border-animated banner-padding mb-1 mx-2 mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 rounded-lg"
        style={{ 
          // CSS variables --x and --y are now set by the hook
          transformOrigin: "center center" 
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center flex-grow mr-4 min-w-0">
          <img 
            src="/BigLogo.svg" 
            alt="Society of Software Engineers" 
            className="mr-2 h-8 min-w-[2rem]"
          />
          <h2 className="text-lg font-semibold opacity-80 whitespace-nowrap truncate">Goals for 25/26</h2>
        </div>
        <div className="flex flex-wrap items-center space-x-0 space-y-2 sm:space-y-0 sm:space-x-3 flex-shrink-0">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Search (⌘K)"
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9 pr-3 py-1 h-8 w-full sm:w-48 bg-white/5 border-white/20 focus-visible:ring-offset-0 focus-visible:ring-white/50 rounded-full"
            />
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm w-full sm:w-auto text-center">
            {columnCount} Columns
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm shadow-sm w-full sm:w-auto text-center">
            {cardCount} Cards
          </div>
          <ThemeToggle />
        </div>
      </motion.div>
      
      {/* Board Content */}
      <motion.div 
        className="flex-1 overflow-hidden px-1 sm:px-2 pb-2 backdrop-blur-[2px]"
        layout={false}
      >
        <div className="flex h-full gap-2 sm:gap-2 overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {filteredBoard?.columns?.map((column) => (
            <Column 
              key={column.id} 
              column={column}
              isDraggingCard={draggedCardId !== null}
              isSourceColumn={column.id === dragSourceColumnId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}; 