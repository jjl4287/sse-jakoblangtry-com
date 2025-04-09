'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Column } from './Column';
import { useBoard } from '~/services/board-context';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Board: React.FC = () => {
  const { board, loading, error } = useBoard();
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
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

  // Memoize column counts to prevent recalculations on every render
  const cardCount = useMemo(() => {
    if (!board) return 0;
    return board.columns.reduce((acc, col) => acc + col.cards.length, 0);
  }, [board]);

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
        <div className="flex items-center">
          <h1 className="text-xl font-bold mr-2">Glassmorphic Kanban</h1>
          <h2 className="text-lg font-semibold opacity-80">Project Board</h2>
        </div>
        <div className="flex items-center space-x-3">
          <div className="glass-button px-3 py-1 rounded-full text-sm">
            {board.columns.length} Columns
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
          {board.columns.map((column) => (
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