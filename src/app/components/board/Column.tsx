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
import update from 'immutability-helper'; // Import immutability-helper
import { ExpandedCardModal } from './ExpandedCardModal'; // Import the ExpandedCardModal

// Auto-scroll constants
const SCROLL_AREA_HEIGHT = 60; // Pixels from top/bottom edge to trigger scroll
const SCROLL_SPEED = 10; // Pixels per frame

// Placeholder height (should match card height or be close)
const PLACEHOLDER_HEIGHT = 100; // Adjust as needed based on your Card component's styling

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
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const columnMotionRef = useRef<HTMLDivElement>(null);
  const [internalCards, setInternalCards] = useState(column.cards);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  const [placeholderHeight, setPlaceholderHeight] = useState<number>(PLACEHOLDER_HEIGHT);
  
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
  
  // Helper function to calculate hover index based on Y coordinate
  const calculateHoverIndex = (hoverClientY: number, cards: CardType[], scrollContainer: HTMLDivElement): number => {
      let targetIndex = cards.findIndex((card) => {
          const cardElement = scrollContainer.querySelector(`[data-card-id="${card.id}"]`);
          if (!cardElement) return false;
          const cardRect = cardElement.getBoundingClientRect();
          const elementTopRelativeToScrollContainer = cardRect.top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop;
          const cardMiddleY = elementTopRelativeToScrollContainer + cardRect.height / 2;
          return hoverClientY < cardMiddleY;
      });

      if (targetIndex === -1) {
          // If not found, means we are hovering below all cards or column is empty
          targetIndex = cards.length;
      }
      return targetIndex;
  };
  
  // Set up drop functionality for the column (dropping cards INTO the column area)
  const [{ isOverCurrent, canDrop, draggedItem }, drop] = useDrop<
    CardDragItem, // Type of the dragged item
    void, // Type of the drop result (we don't need one here)
    { isOverCurrent: boolean; canDrop: boolean; draggedItem: CardDragItem | null } // Type of the collected props
  >({
    accept: ItemTypes.CARD,
    drop: (item: CardDragItem, monitor) => {
      setPlaceholderIndex(null); // Clear placeholder on drop
      
      // Column's drop handler now takes precedence to determine final position.
      if (!monitor.isOver({ shallow: true }) || !ref.current) {
        // If not dropped directly on this column or ref is missing, bail out.
        // The dragEnd handler in Board.tsx will handle cleanup if needed.
        return;
      }

      // Calculate final hover index at the moment of drop
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        console.warn("Cannot determine drop position: no client offset.");
        if (onDragEnd) onDragEnd();
        return; 
      }
      
      const columnRect = ref.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - columnRect.top + ref.current.scrollTop;
      const finalHoverIndex = calculateHoverIndex(hoverClientY, column.cards, ref.current); // Use original column.cards for stable calculation

      // Calculate the target order based on surrounding cards at the final index
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

      // Handle dropping a card INTO this column (either from another column or into empty space)
      console.log(`Card ${item.id} dropped into column ${column.id} at index ${finalHoverIndex} with target order ${targetOrder}`);
      moveCard(item.id, column.id, targetOrder); // Use the calculated targetOrder

      if (onDragEnd) {
        onDragEnd();
      }
    },
    hover: (item: CardDragItem, monitor) => {
      const isHoveringShallow = monitor.isOver({ shallow: true });
      setIsOver(isHoveringShallow); // Keep for visual feedback (column highlight)

      // Auto-scroll logic
      if (isHoveringShallow && ref.current) {
        handleAutoScroll(monitor, ref.current);
      } else {
        stopAutoScroll();
      }
      
      // Placeholder and Visual Reordering Logic
      if (!ref.current || !isHoveringShallow) {
        if (placeholderIndex !== null) {
            setPlaceholderIndex(null); // Clear placeholder if not hovering shallowly over this column
        }
        return; 
      }
      
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
         if (placeholderIndex !== null) setPlaceholderIndex(null);
         return;
      }

      const dragIndexInInternal = internalCards.findIndex(c => c.id === item.id); // Find dragged card in *this* column's state
      const columnRect = ref.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - columnRect.top + ref.current.scrollTop; // Adjust for scroll position

      // Calculate target index for placeholder or visual reordering
      const hoverIndex = calculateHoverIndex(hoverClientY, internalCards, ref.current);

      // --- Logic branching based on source column ---
      
      // A) Dragging within the same column: Perform visual reordering
      if (item.columnId === column.id) {
        setPlaceholderIndex(null); // Ensure no placeholder in source column
        if (dragIndexInInternal === -1 || dragIndexInInternal === hoverIndex) {
          return; // Item not found in internal state or no move needed
        }
        moveCardInternally(dragIndexInInternal, hoverIndex);
      } 
      // B) Dragging from a different column: Show placeholder
      else {
        if (hoverIndex !== placeholderIndex) {
           // Update placeholder height based on the dragged item if possible
           // This requires accessing the dragged item's element size, which is tricky.
           // We'll use a fixed height for now, but ideally, this would be dynamic.
           // Consider passing height in the drag item if possible.
           setPlaceholderHeight(PLACEHOLDER_HEIGHT); // Or get height from item if available
           setPlaceholderIndex(hoverIndex);
        }
      }
    },
    collect: (monitor) => ({
      isOverCurrent: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem() // Get the dragged item info
    }),
  });

  // Auto-scroll handling function
  const handleAutoScroll = (monitor: DropTargetMonitor<CardDragItem, void>, scrollElement: HTMLDivElement) => {
    const clientOffset = monitor.getClientOffset();
    if (!clientOffset) {
      stopAutoScroll();
      return;
    }

    const elementRect = scrollElement.getBoundingClientRect();
    const hoverY = clientOffset.y - elementRect.top;

    let scrollDirection = 0;

    // Check if near top edge
    if (hoverY < SCROLL_AREA_HEIGHT) {
      scrollDirection = -1; // Scroll up
    }
    // Check if near bottom edge
    else if (elementRect.height - hoverY < SCROLL_AREA_HEIGHT) {
      scrollDirection = 1; // Scroll down
    }

    if (scrollDirection !== 0) {
      startAutoScroll(scrollElement, scrollDirection);
    } else {
      stopAutoScroll();
    }
  };

  // Function to start the scrolling interval
  const startAutoScroll = (element: HTMLDivElement, direction: number) => {
    if (scrollIntervalRef.current) return; // Already scrolling

    scrollIntervalRef.current = setInterval(() => {
      element.scrollTop += direction * SCROLL_SPEED;
    }, 16); // Approx 60 FPS
  };

  // Function to stop the scrolling interval
  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // Cleanup scroll interval on unmount or when dragging stops externally
  useEffect(() => {
    return () => stopAutoScroll();
  }, []);

  // Also stop scroll when the drag ends globally (handled by Board.tsx)
  useEffect(() => {
    if (!isDraggingCard) {
      stopAutoScroll();
      setPlaceholderIndex(null); // Clear placeholder when drag ends globally
    }
  }, [isDraggingCard]);

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
  
  // Apply the drop ref to the column content area (the scrollable div)
  drop(ref);
  
  // Render using the internal state for smooth animations
  const sortedCards = internalCards;
  
  // Determine column appearance during drag operations
  const getColumnClasses = useCallback(() => {
    // Start with the base glass column style and add layout/border/shadow utilities
    let classes = "flex flex-col h-full glass-column p-4 relative border rounded-lg shadow-md hover:shadow-lg"; 
    
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
        <div className="flex items-center gap-2">
          <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
            {sortedCards.length}
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
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pr-1 -mr-1"
        style={{ 
          maskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 20px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black calc(100% - 20px), transparent 100%)'
        }}
      >
        <AnimatePresence mode="popLayout">
          {[...Array(sortedCards.length + 1)].map((_, index) => {
            // Render placeholder if index matches and it should be shown
            if (placeholderIndex === index) {
              return (
                <motion.div
                  key="placeholder"
                  className="bg-white/10 rounded-lg border-2 border-dashed border-white/30"
                  style={{ height: placeholderHeight }}
                  initial={{ opacity: 0.5, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout // Ensures smooth animation when placeholder appears/disappears
                />
              );
            }
            
            // Adjust card index if placeholder is rendered before it
            const cardIndex = placeholderIndex !== null && index > placeholderIndex ? index - 1 : index;
            const card = sortedCards[cardIndex];

            // Don't render anything further if card doesn't exist (handles the +1 in the map array)
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
                  layout: { 
                    duration: 0.15, // Faster duration
                    ease: "easeOut" // Use a standard ease-out for snappiness
                  },
                  // Keep spring for initial mount/exit animations if desired
                  type: "spring", 
                  stiffness: 400, 
                  damping: 30
                }}
                layout // Keep layout prop enabled, but configure its transition separately
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

export { Column }; 