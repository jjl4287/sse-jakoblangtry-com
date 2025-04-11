'use client';

import React, { useState, useRef, useCallback, memo, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
import type { Column as ColumnType, Card as CardType } from '~/types';
import { Card } from './Card';
import { useBoard } from '~/services/board-context';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion, AnimatePresence } from 'framer-motion';
import update from 'immutability-helper';
import { ExpandedCardModal } from './ExpandedCardModal';

// Scroll and placeholder constants
const SCROLL_AREA_HEIGHT = 60;
const SCROLL_SPEED = 10;
const PLACEHOLDER_HEIGHT = 100;

interface ColumnProps {
  column: ColumnType;
  isDraggingCard?: boolean;
  isSourceColumn?: boolean;
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

// Use memo to prevent unnecessary re-renders of columns that don't change
export const Column = memo(({ 
  column, 
  isDraggingCard = false, 
  isSourceColumn = false,
  onDragStart,
  onDragEnd
}: ColumnProps) => {
  const { moveCard } = useBoard();
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const columnMotionRef = useRef<HTMLDivElement>(null);
  const [internalCards, setInternalCards] = useState(column.cards);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  
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
    return () => columnElement.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  // Helper function to calculate hover index based on Y coordinate
  const calculateHoverIndex = useCallback((hoverClientY: number, cards: CardType[], scrollContainer: HTMLDivElement): number => {
    let targetIndex = cards.findIndex((card) => {
      const cardElement = scrollContainer.querySelector(`[data-card-id="${card.id}"]`);
      if (!cardElement) return false;
      const cardRect = cardElement.getBoundingClientRect();
      const elementTopRelativeToScrollContainer = cardRect.top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop;
      const cardMiddleY = elementTopRelativeToScrollContainer + cardRect.height / 2;
      return hoverClientY < cardMiddleY;
    });

    return targetIndex === -1 ? cards.length : targetIndex;
  }, []);
  
  // Set up drop functionality for the column
  const [{ isOverCurrent, canDrop, draggedItem }, drop] = useDrop<
    CardDragItem,
    void,
    { isOverCurrent: boolean; canDrop: boolean; draggedItem: CardDragItem | null }
  >({
    accept: ItemTypes.CARD,
    drop: (item: CardDragItem, monitor) => {
      setPlaceholderIndex(null);
      
      if (!monitor.isOver({ shallow: true }) || !ref.current) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        console.warn("Cannot determine drop position: no client offset.");
        if (onDragEnd) onDragEnd();
        return; 
      }
      
      const columnRect = ref.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - columnRect.top + ref.current.scrollTop;
      const finalHoverIndex = calculateHoverIndex(hoverClientY, column.cards, ref.current);

      // Calculate target order based on surrounding cards
      const sortedOriginalCards = [...column.cards].sort((a, b) => a.order - b.order);
      const cardBefore = sortedOriginalCards[finalHoverIndex - 1];
      const cardAfter = sortedOriginalCards[finalHoverIndex];
      const prevOrder = cardBefore?.order ?? 0; 
      const nextOrder = cardAfter?.order;

      let targetOrder: number;
      if (finalHoverIndex === 0) {
        targetOrder = (nextOrder ?? 1) / 2;
      } else if (nextOrder === undefined) {
        targetOrder = prevOrder + 1;
      } else {
        targetOrder = (prevOrder + nextOrder) / 2;
      }

      moveCard(item.id, column.id, targetOrder);
      if (onDragEnd) onDragEnd();
    },
    hover: (item: CardDragItem, monitor) => {
      const isHoveringShallow = monitor.isOver({ shallow: true });
      
      // Auto-scroll logic
      if (isHoveringShallow && ref.current) {
        handleAutoScroll(monitor, ref.current);
      } else {
        stopAutoScroll();
      }
      
      // Placeholder and Visual Reordering Logic
      if (!ref.current || !isHoveringShallow) {
        if (placeholderIndex !== null) {
          setPlaceholderIndex(null);
        }
        return; 
      }
      
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        if (placeholderIndex !== null) setPlaceholderIndex(null);
        return;
      }

      const dragIndexInInternal = internalCards.findIndex(c => c.id === item.id);
      const columnRect = ref.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - columnRect.top + ref.current.scrollTop;
      const hoverIndex = calculateHoverIndex(hoverClientY, internalCards, ref.current);
      
      // Logic branching based on source column
      if (item.columnId === column.id) {
        setPlaceholderIndex(null);
        if (dragIndexInInternal === -1 || dragIndexInInternal === hoverIndex) return;
        moveCardInternally(dragIndexInInternal, hoverIndex);
      } else {
        if (hoverIndex !== placeholderIndex) {
          setPlaceholderIndex(hoverIndex);
        }
      }
    },
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem()
    }),
  });

  // Auto-scroll handling function
  const handleAutoScroll = useCallback((monitor: DropTargetMonitor<CardDragItem, void>, scrollElement: HTMLDivElement) => {
    const clientOffset = monitor.getClientOffset();
    if (!clientOffset) {
      stopAutoScroll();
      return;
    }

    const elementRect = scrollElement.getBoundingClientRect();
    const hoverY = clientOffset.y - elementRect.top;

    let scrollDirection = 0;
    if (hoverY < SCROLL_AREA_HEIGHT) {
      scrollDirection = -1; // Scroll up
    } else if (elementRect.height - hoverY < SCROLL_AREA_HEIGHT) {
      scrollDirection = 1; // Scroll down
    }

    if (scrollDirection !== 0) {
      startAutoScroll(scrollElement, scrollDirection);
    } else {
      stopAutoScroll();
    }
  }, []);

  // Function to start the scrolling interval
  const startAutoScroll = useCallback((element: HTMLDivElement, direction: number) => {
    if (scrollIntervalRef.current) return; // Already scrolling

    scrollIntervalRef.current = setInterval(() => {
      element.scrollTop += direction * SCROLL_SPEED;
    }, 16); // ~60 FPS
  }, []);

  // Function to stop the scrolling interval
  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  // Cleanup scroll interval on unmount or when dragging stops externally
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  // Also stop scroll when the drag ends globally (handled by Board.tsx)
  useEffect(() => {
    if (!isDraggingCard) {
      stopAutoScroll();
      setPlaceholderIndex(null); // Clear placeholder when drag ends globally
    }
  }, [isDraggingCard, stopAutoScroll]);

  const handleAddCardClick = useCallback(() => {
    setIsCardModalOpen(true);
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
  
  // Apply the drop ref to the column content area
  drop(ref);
  
  // Determine column appearance during drag operations
  const getColumnClasses = useCallback(() => {
    let classes = "flex flex-col h-full glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible"; 
    
    if (isDraggingCard) {
      if (!isSourceColumn && !(isOverCurrent && canDrop)) {
        classes += " opacity-70";
      }
      if (isSourceColumn) {
        classes += " ring-2 ring-blue-400/50 ring-inset"; 
      } else if (isOverCurrent && canDrop) {
        classes += " ring-2 ring-green-400/50 ring-inset";
      }
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
        ['--y' as string]: '50%',
        padding: '0.75rem',
        margin: '3px 0.125rem',
        overflow: 'visible'
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
        <div className="flex items-center gap-2">
          <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
            {internalCards.length}
          </span>
          <button 
            onClick={handleAddCardClick}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-white/10 transition-colors hover-lift"
            aria-label="Add Card"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div 
        ref={ref}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent px-0.5 overflow-visible"
        style={{ 
          position: 'relative',
          overflowX: 'visible',
          marginLeft: '-2px',
          marginRight: '-2px',
          paddingTop: '4px',
          paddingBottom: '4px'
        }}
      >
        <div className="relative z-0 w-full">
          <AnimatePresence mode="popLayout">
            {[...Array(internalCards.length + (placeholderIndex !== null ? 1 : 0))].map((_, index) => {
              // If this position should show a placeholder
              if (placeholderIndex !== null && index === placeholderIndex) {
                return (
                  <motion.div
                    key="placeholder"
                    className="bg-white/10 rounded-lg border-2 border-dashed border-white/30"
                    style={{ height: PLACEHOLDER_HEIGHT }}
                    initial={{ opacity: 0.5, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    layout
                  />
                );
              }
              
              // Adjust card index if placeholder is rendered before it
              const cardIndex = placeholderIndex !== null && index > placeholderIndex ? index - 1 : index;
              const card = internalCards[cardIndex];

              // Don't render anything further if card doesn't exist
              if (!card) return null;

              // Render the actual card
              return (
                <motion.div 
                  key={card.id} 
                  className="relative group card-wrapper mb-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ 
                    layout: { duration: 0.15, ease: "easeOut" },
                    type: "spring", 
                    stiffness: 400, 
                    damping: 30
                  }}
                  layout
                  data-card-id={card.id}
                >
                  <Card 
                    card={card}
                    index={cardIndex}
                    columnId={column.id}
                    onDragStart={handleCardDragStart}
                    onDragEnd={onDragEnd}
                    onMoveCard={moveCardInternally}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      
      {/* New Card Modal */}
      <ExpandedCardModal
        isOpen={isCardModalOpen}
        onOpenChange={setIsCardModalOpen}
        columnId={column.id}
      />
    </motion.div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column'; 