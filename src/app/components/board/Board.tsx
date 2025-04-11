'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Column } from './Column';
import { useBoard } from '~/services/board-context';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Input } from "~/components/ui/input";
import { Search } from 'lucide-react';

export const Board: React.FC = () => {
  const { board, loading, error, searchQuery, setSearchQuery } = useBoard();
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Track mouse position for the header lighting effect
  const [mousePos, setMousePos] = useState({ x: '50%', y: '50%' });

  // Track card drag start
  const handleDragStart = (item: CardDragItem) => {
    setDraggedCardId(item.id);
    setDragSourceColumnId(item.columnId);
  };

  // Reset drag state when drag ends
  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragSourceColumnId(null);
  };
  
  // Handle mouse movement for the header glow effect
  useEffect(() => {
    const headerElement = headerRef.current;
    if (!headerElement) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = headerElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      // Update both the state and the element's CSS variables
      setMousePos({ x: `${x}%`, y: `${y}%` });
      headerElement.style.setProperty('--x', `${x}%`);
      headerElement.style.setProperty('--y', `${y}%`);
    };
    
    // Add mousemove event listener
    headerElement.addEventListener('mousemove', handleMouseMove);
    
    // Initialize position to center
    headerElement.style.setProperty('--x', '50%');
    headerElement.style.setProperty('--y', '50%');
    
    return () => {
      headerElement.removeEventListener('mousemove', handleMouseMove);
    };
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

  // Recalculate card count based on filtered board
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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Board Header */}
      <motion.div 
        ref={headerRef}
        className="glass-column glass-border-animated p-4 mb-4 mx-6 mt-6 flex justify-between items-center"
        style={{ 
          ['--x' as string]: mousePos.x, 
          ['--y' as string]: mousePos.y,
          transformOrigin: "center center" 
        }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center flex-grow mr-4">
          <h1 className="text-xl font-bold mr-2 whitespace-nowrap">Society of Software Engineers</h1>
          <h2 className="text-lg font-semibold opacity-80 whitespace-nowrap">Goals for 25/26</h2>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Search (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1 h-8 w-48 bg-white/5 border-white/20 focus-visible:ring-offset-0 focus-visible:ring-white/50"
            />
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm">
            {filteredBoard?.columns?.length ?? 0} Columns
          </div>
          <div className="glass-button px-3 py-1 rounded-full text-sm">
            {cardCount} Cards
          </div>
          <ThemeToggle />
        </div>
      </motion.div>
      
      {/* Board Content */}
      <motion.div 
        className="flex-1 overflow-hidden px-6 pb-6 backdrop-blur-[2px]"
        layout={false}
      >
        <div className="flex h-full gap-6 overflow-x-auto overflow-y-hidden">
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