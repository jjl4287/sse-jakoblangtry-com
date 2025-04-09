'use client';

import React, { useState, useRef, useCallback, memo } from 'react';
import { useDrop } from 'react-dnd';
import type { Column as ColumnType, Card as CardType } from '~/types';
import { Card } from './Card';
import { CardAddForm } from './CardAddForm';
import { useBoard } from '~/services/board-context';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion, AnimatePresence } from 'framer-motion';

interface ColumnProps {
  column: ColumnType;
  isDraggingCard?: boolean;
  isSourceColumn?: boolean;
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

// Use memo to prevent unnecessary re-renders of columns that don't change
const Column: React.FC<ColumnProps> = memo(({ 
  column, 
  isDraggingCard = false, 
  isSourceColumn = false,
  onDragStart,
  onDragEnd
}) => {
  const { deleteCard, moveCard } = useBoard();
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  // Set up drop functionality for the column
  const [{ isOverCurrent, canDrop }, drop] = useDrop({
    accept: ItemTypes.CARD,
    drop: (item: CardDragItem, monitor) => {
      // Handle dropping a card into this column
      if (item.columnId !== column.id) {
        const dropPos = getDropPosition(monitor);
        handleDropCard(item, dropPos);
      }
      if (onDragEnd) {
        onDragEnd();
      }
      return { dropEffect: 'move' };
    },
    hover: (item: CardDragItem, monitor) => {
      const isHovering = monitor.isOver({ shallow: true });
      setIsOver(isHovering);
    },
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  // Get the position to drop the card based on mouse position
  const getDropPosition = useCallback((monitor: any) => {
    if (!ref.current) return 0;
    
    const columnCards = column.cards;
    if (columnCards.length === 0) return 0;
    
    const columnRect = ref.current.getBoundingClientRect();
    const mousePosition = monitor.getClientOffset();
    const hoverY = mousePosition.y - columnRect.top;
    
    // Find the closest card to the mouse position
    let closestCardIndex = 0;
    let minDistance = Number.MAX_VALUE;
    
    const cardElements = ref.current.querySelectorAll('.card-wrapper');
    cardElements.forEach((cardElement, idx) => {
      const cardRect = cardElement.getBoundingClientRect();
      const cardMiddle = cardRect.top + cardRect.height / 2 - columnRect.top;
      const distance = Math.abs(hoverY - cardMiddle);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestCardIndex = idx;
      }
    });
    
    // Determine if we should place before or after the closest card
    if (cardElements.length === 0) return 0;
    
    // Add null check for closestCardIndex and make sure it's in the valid range
    if (closestCardIndex === undefined || closestCardIndex < 0 || closestCardIndex >= cardElements.length) return 0;

    const closestCard = cardElements[closestCardIndex];
    if (!closestCard) return 0;
    
    const closestCardRect = closestCard.getBoundingClientRect();
    const closestCardMiddle = closestCardRect.top + closestCardRect.height / 2;
    
    // Make sure columnCards and closestCardIndex are valid
    if (!columnCards || columnCards.length === 0) return 0;
    if (closestCardIndex < 0 || closestCardIndex >= columnCards.length) return 0;
    
    if (mousePosition.y < closestCardMiddle) {
      return columnCards[closestCardIndex]?.order ?? 0;
    } else {
      return (columnCards[closestCardIndex]?.order ?? 0) + 1;
    }
  }, [column.cards]);
  
  // Handle a card being dropped into this column
  const handleDropCard = useCallback(async (item: CardDragItem, newOrder: number) => {
    try {
      await moveCard(item.id, column.id, newOrder);
    } catch (error) {
      console.error('Error moving card:', error);
    }
  }, [column.id, moveCard]);
  
  // Handle reordering cards within the same column
  const handleMoveCard = useCallback(async (dragIndex: number, hoverIndex: number) => {
    const sortedCards = [...column.cards].sort((a, b) => a.order - b.order);
    const dragCard = sortedCards[dragIndex];
    const hoverCard = sortedCards[hoverIndex];
    
    if (dragCard && hoverCard) {
      try {
        // For better UX, only send one API request when card is actually dropped
        // This callback will be called many times during drag, but we'll handle the final move
        // in the drop handler of the card
        if (dragCard.order === hoverCard.order) return;
        
        await moveCard(dragCard.id, column.id, hoverCard.order);
      } catch (error) {
        console.error('Error reordering card:', error);
      }
    }
  }, [column.cards, column.id, moveCard]);
  
  const handleCardClick = useCallback((card: CardType) => {
    setActiveCard(card);
    // For now we just select the card, expanded view will be implemented in a later task
  }, []);
  
  const handleCardDelete = useCallback(async (card: CardType) => {
    if (window.confirm(`Are you sure you want to delete "${card.title}"?`)) {
      try {
        await deleteCard(card.id);
      } catch (error) {
        console.error('Error deleting card:', error);
      }
    }
  }, [deleteCard]);
  
  const handleAddCardClick = useCallback(() => {
    setShowAddForm(true);
  }, []);
  
  const handleCancelAdd = useCallback(() => {
    setShowAddForm(false);
  }, []);

  // Handle card drag started 
  const handleCardDragStart = useCallback((item: CardDragItem) => {
    if (onDragStart) {
      onDragStart(item);
    }
  }, [onDragStart]);
  
  // Apply the drop ref to the column content area
  drop(ref);
  
  // Sort cards by order
  const sortedCards = [...column.cards].sort((a, b) => a.order - b.order);
  
  // Determine column appearance during drag operations
  const getColumnClasses = useCallback(() => {
    let classes = "flex flex-col h-full glass-column p-4 overflow-hidden";
    
    if (isDraggingCard) {
      if (isSourceColumn) {
        classes += " ring-2 ring-blue-400/50"; // Source column
      } else if (isOverCurrent && canDrop) {
        classes += " ring-2 ring-green-400/50"; // Valid drop target
      } else {
        classes += " opacity-80"; // Other columns
      }
    }
    
    return classes;
  }, [isDraggingCard, isSourceColumn, isOverCurrent, canDrop]);
  
  return (
    <motion.div 
      className={getColumnClasses()}
      style={{ width: `${column.width}%` }}
      layout="position"
      animate={{
        scale: isOverCurrent && canDrop ? 1.02 : 1,
        boxShadow: isOverCurrent && canDrop ? "0 8px 16px rgba(0,0,0,0.2)" : "none"
      }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{column.title}</h3>
        <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
          {sortedCards.length}
        </span>
      </div>
      
      <div 
        ref={ref}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 scrollbar-thin"
      >
        {showAddForm && (
          <CardAddForm 
            columnId={column.id} 
            onCancel={handleCancelAdd}
          />
        )}
        
        <AnimatePresence mode="popLayout">
          {sortedCards.map((card, index) => (
            <motion.div 
              key={card.id} 
              className="relative group card-wrapper"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              // Removed layout prop to prevent animations when not needed
            >
              <Card 
                card={card}
                index={index}
                onClick={handleCardClick}
                onMoveCard={handleMoveCard}
                onDragStart={handleCardDragStart}
                onDragEnd={onDragEnd}
              />
              <button
                onClick={() => handleCardDelete(card)}
                className="absolute top-2 right-2 bg-red-500/50 hover:bg-red-500/70 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Delete card"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Drop indicator for empty columns */}
        {sortedCards.length === 0 && isOverCurrent && (
          <div className="h-24 border-2 border-dashed border-white/30 rounded-lg bg-primary/10 flex items-center justify-center backdrop-blur-sm glass-depth-1">
            <p className="opacity-70 text-sm">Drop card here</p>
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/10">
        {!showAddForm && (
          <button 
            className="w-full glass-button py-1.5 rounded-md text-sm transition-colors"
            onClick={handleAddCardClick}
          >
            + Add Card
          </button>
        )}
      </div>
    </motion.div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column';

export { Column }; 