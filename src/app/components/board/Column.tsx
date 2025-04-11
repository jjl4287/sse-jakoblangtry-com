'use client';

import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
import type { Column as ColumnType, Card as CardType } from '~/types';
import { Card } from './Card';
import { CardAddForm } from './CardAddForm';
import { useBoard } from '~/services/board-context';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion, AnimatePresence } from 'framer-motion';
import update from 'immutability-helper'; // Import immutability-helper

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
  const columnMotionRef = useRef<HTMLDivElement>(null);
  const [internalCards, setInternalCards] = useState(column.cards);
  
  // Update internal state when the column prop changes
  useEffect(() => {
    setInternalCards(column.cards.sort((a, b) => a.order - b.order));
  }, [column.cards]);
  
  // Add mouse position tracking for lighting effect
  useEffect(() => {
    const columnElement = columnMotionRef.current;
    if (!columnElement) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = columnElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      columnElement.style.setProperty('--x', `${x}%`);
      columnElement.style.setProperty('--y', `${y}%`);
    };
    
    columnElement.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      columnElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // Set up drop functionality for the column (dropping cards INTO the column area)
  const [{ isOverCurrent, canDrop, draggedItem }, drop] = useDrop<
    CardDragItem, // Type of the dragged item
    void, // Type of the drop result (we don't need one here)
    { isOverCurrent: boolean; canDrop: boolean; draggedItem: CardDragItem | null } // Type of the collected props
  >({
    accept: ItemTypes.CARD,
    drop: (item: CardDragItem, monitor) => {
      const didDropOnCard = monitor.didDrop() && (monitor.getDropResult() as any)?.droppedOnCard;
      
      // If the card was dropped onto another card within this column, the Card component's drop handler already took care of it.
      if (didDropOnCard) {
        console.log(`Card ${item.id} drop handled by Card component, skipping column drop.`);
        if (onDragEnd) onDragEnd();
        return;
      }

      // Handle dropping a card INTO this column (either from another column or into empty space)
      console.log(`Card ${item.id} dropped into column ${column.id}`);
      const targetOrder = getDropOrder(monitor); // Calculate target order based on drop position
      moveCard(item.id, column.id, targetOrder);

      if (onDragEnd) {
        onDragEnd();
      }
    },
    hover: (item: CardDragItem, monitor) => {
      const isHovering = monitor.isOver({ shallow: true });
      setIsOver(isHovering); // Keep for visual feedback (column highlight)
    },
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem() // Get the dragged item info
    }),
  });

  // Calculate the target order based on mouse position and existing cards
  const getDropOrder = useCallback((monitor: DropTargetMonitor<CardDragItem, void>): number => {
    if (!ref.current) return 0;

    const sortedColumnCards = [...column.cards].sort((a, b) => a.order - b.order);
    const clientOffset = monitor.getClientOffset();
    const columnRect = ref.current.getBoundingClientRect();
    if (!clientOffset) return (sortedColumnCards[sortedColumnCards.length - 1]?.order ?? 0) + 1; // Drop at end if no offset

    const hoverY = clientOffset.y - columnRect.top;

    // Find the index where the card should be inserted
    let targetIndex = sortedColumnCards.findIndex((card) => {
      const cardElement = ref.current?.querySelector(`[data-card-id="${card.id}"]`);
      if (!cardElement) return false;
      const cardRect = cardElement.getBoundingClientRect();
      if (cardRect.top === undefined) return false;
      const cardMiddleY = cardRect.top + cardRect.height / 2 - columnRect.top;
      return hoverY < cardMiddleY;
    });

    if (targetIndex === -1) {
      targetIndex = sortedColumnCards.length;
    }

    const cardBefore = sortedColumnCards[targetIndex - 1];
    const cardAfter = sortedColumnCards[targetIndex];
    const prevOrder = cardBefore?.order ?? 0; // Default to 0 if no card before
    const nextOrder = cardAfter?.order; // Can be undefined if inserting at the end

    if (targetIndex === 0) {
      // Insert at the beginning: halfway between 0 and the first card's order (or 1 if no cards)
      return (nextOrder ?? 1) / 2;
    } else if (nextOrder === undefined) {
      // Insert at the end: order of the last card + 1
      return prevOrder + 1;
    } else {
      // Insert between two cards
      return (prevOrder + nextOrder) / 2;
    }
  }, [column.cards]);
  
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
  
  // Callback for visual reordering within the column during hover
  const moveCardInternally = useCallback((dragIndex: number, hoverIndex: number) => {
    setInternalCards((prevCards) => {
      if (!prevCards) return [];
      // Ensure indices are within bounds
      if (dragIndex < 0 || dragIndex >= prevCards.length || hoverIndex < 0 || hoverIndex >= prevCards.length) {
        console.warn("Attempted to move card with invalid index", { dragIndex, hoverIndex, cardsLength: prevCards.length });
        return prevCards;
      }
      const cardToMove = prevCards[dragIndex];
      if (!cardToMove) {
        console.warn("Card to move not found at index", dragIndex);
        return prevCards;
      }
      return update(prevCards, {
        $splice: [
          [dragIndex, 1], // Remove card from original position
          [hoverIndex, 0, cardToMove], // Insert card at new position
        ],
      });
    });
  }, []);
  
  // Apply the drop ref to the column content area (the scrollable div)
  drop(ref);
  
  // Render using the internal state for smooth animations
  const sortedCards = internalCards;
  
  // Determine column appearance during drag operations
  const getColumnClasses = useCallback(() => {
    let classes = "flex flex-col h-full glass-column p-4"; // Removed overflow-hidden from here
    
    // Highlight based on drag state
    if (isDraggingCard) {
      // Dim if it's not the source and not a valid target
      if (!isSourceColumn && !(isOverCurrent && canDrop)) {
        classes += " opacity-70";
      }
      // Ring effect for source or valid drop target
      if (isSourceColumn) {
        classes += " ring-2 ring-blue-400/50 ring-inset"; 
      } else if (isOverCurrent && canDrop) {
        classes += " ring-2 ring-green-400/50 ring-inset";
      }
    }
    
    // Add animated border when not dragging
    if (!isDraggingCard) {
      classes += " glass-border-animated";
    }
    
    return classes;
  }, [isDraggingCard, isSourceColumn, isOverCurrent, canDrop]);
  
  return (
    <motion.div 
      ref={columnMotionRef}
      className={getColumnClasses()}
      style={{ 
        width: `${column.width}%`,
        ['--x' as string]: '50%',
        ['--y' as string]: '50%'
      }}
      layout="position"
      animate={{
        scale: isOverCurrent && canDrop ? 1.01 : 1,
        boxShadow: isOverCurrent && canDrop ? "0 6px 12px rgba(0,0,0,0.15)" : "none",
        zIndex: isOverCurrent && canDrop ? 10 : 1
      }}
      transition={{ 
        duration: 0.2,
        type: "spring",
        damping: 20,
        stiffness: 300
      }}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold hover:text-primary-light transition-colors">{column.title}</h3>
        <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
          {sortedCards.length}
        </span>
      </div>
      
      <div 
        ref={ref}
        className="flex-1 overflow-y-auto overflow-x-visible space-y-3 scrollbar-thin px-2 pr-1"
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
              transition={{ 
                duration: 0.2,
                type: "spring",
                damping: 20,
                stiffness: 300
              }}
              layout={!isDraggingCard}
              data-card-id={card.id}
            >
              <Card 
                card={card}
                index={index}
                columnId={column.id}
                onDragStart={handleCardDragStart}
                onDragEnd={onDragEnd}
                onMoveCard={moveCardInternally}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isOverCurrent && canDrop && draggedItem?.columnId !== column.id && (
            <div className="h-1 bg-green-400/50 rounded my-1"></div>
        )}
      </div>
      
      <button 
        onClick={handleAddCardClick}
        className="mt-4 p-2 w-full text-left glass-button hover-lift flex-shrink-0"
      >
        + Add Card
      </button>
    </motion.div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column';

export { Column }; 