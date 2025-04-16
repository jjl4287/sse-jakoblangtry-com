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
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import { useAutoScroll } from '~/hooks/useAutoScroll';

// Removed scroll constants, now defined in the hook
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
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  
  // Use the custom hook for the lighting effect
  useMousePositionStyle(columnMotionRef);
  
  // Use the custom hook for auto-scrolling
  // Pass the ref of the scrollable container and the global isDraggingCard flag
  const { handleHoverForScroll, stopAutoScroll } = useAutoScroll(ref, isDraggingCard);

  // Update internal state when the column prop changes
  useEffect(() => {
    setInternalCards(column.cards.sort((a, b) => a.order - b.order));
  }, [column.cards]);
  
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
      stopAutoScroll(); // Ensure scrolling stops on drop
      
      if (!monitor.isOver({ shallow: true }) || !ref.current) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        console.warn("Cannot determine drop position: no client offset.");
        if (onDragEnd) onDragEnd();
        return; 
      }
      
      const columnRect = ref.current.getBoundingClientRect();
      const hoverClientY = clientOffset.y - columnRect.top + ref.current.scrollTop;
      // Pass the current internalCards state to calculateHoverIndex for accurate positioning during drag
      const finalHoverIndex = calculateHoverIndex(hoverClientY, internalCards, ref.current); 

      // Calculate target order based on surrounding cards (using original column cards for persistence)
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

      moveCard(item.id, column.id, targetOrder); // Call context function to persist move
      if (onDragEnd) onDragEnd(); // Notify parent drag ended
    },
    hover: (item: CardDragItem, monitor) => {
      // Use the handler from the hook for auto-scroll
      handleHoverForScroll(monitor); 
      
      // Placeholder and Visual Reordering Logic (remains mostly the same)
      if (!ref.current || !monitor.isOver({ shallow: true })) {
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
      // Pass internalCards for accurate hover index during drag
      const hoverIndex = calculateHoverIndex(hoverClientY, internalCards, ref.current); 
      
      if (item.columnId === column.id) {
        // Intra-column drag: Use visual reordering
        setPlaceholderIndex(null); // No placeholder needed
        if (dragIndexInInternal === -1 || dragIndexInInternal === hoverIndex) return;
        moveCardInternally(dragIndexInInternal, hoverIndex);
      } else {
        // Inter-column drag: Show placeholder
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

  // Callback for visual reordering within the column during hover
  const moveCardInternally = useCallback((dragIndex: number, hoverIndex: number) => {
    setInternalCards((prevCards) => {
      if (!prevCards) return [];
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
          [dragIndex, 1],
          [hoverIndex, 0, cardToMove],
        ],
      });
    });
  }, []); // Dependency array is empty as it only uses setInternalCards

  const handleAddCardClick = useCallback(() => {
    setIsCardModalOpen(true);
  }, []);
  
  const handleCardDragStart = useCallback((item: CardDragItem) => {
    if (onDragStart) {
      onDragStart(item);
    }
  }, [onDragStart]);
  
  // --- JSX Rendering Starts Here ---
  
  const cardElements = [];
  const cardsToRender = internalCards;
  
  let placeholderRendered = false;
  for (let i = 0; i < cardsToRender.length; i++) {
    if (placeholderIndex === i && !isSourceColumn) {
      cardElements.push(<PlaceholderCard key="placeholder-start" layoutId="placeholder" />);
      placeholderRendered = true;
    }
    const card = cardsToRender[i];
    if (!(isSourceColumn && isDraggingCard && card.id === draggedItem?.id)) {
      cardElements.push(
        <motion.div
          key={card.id}
          layout
          className="relative group card-wrapper"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30, duration: 0.15 }}
        >
          <Card 
            card={card} 
            index={i} 
            columnId={column.id} 
            onDragStart={handleCardDragStart}
            onDragEnd={onDragEnd} 
            onMoveCard={moveCardInternally} 
          />
        </motion.div>
      );
    }
  }
  if (placeholderIndex === cardsToRender.length && !isSourceColumn && !placeholderRendered) {
     cardElements.push(<PlaceholderCard key="placeholder-end" layoutId="placeholder" />);
  }

  return (
    <motion.div
      ref={columnMotionRef}
      layout
      className={`flex flex-col h-full glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible 
                 ${isOverCurrent && canDrop ? 'ring-2 ring-accent/50' : ''}`}
      style={{
        width: '25%',
        padding: '0.75rem',
        margin: '3px 0.125rem',
        overflow: 'visible',
      }}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold hover:text-primary-light transition-colors">{column.title}</h3>
        <div className="flex items-center gap-2">
          <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
            {column.cards.length}
          </span>
          <button 
            onClick={handleAddCardClick}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-white/10 transition-colors hover-lift"
            aria-label="Add Card"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div 
        ref={drop(ref)}
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
        <AnimatePresence initial={false}>
           <div className="relative z-0 w-full">
            {cardElements}
           </div>
        </AnimatePresence>
      </div>
      
      {/* New Card Modal */}
      {isCardModalOpen && (
        <ExpandedCardModal
          columnId={column.id}
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
        />
      )}
    </motion.div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column';

// --- Placeholder Component ---
const PlaceholderCard: React.FC<PlaceholderCardProps> = ({ layoutId }) => (
  <motion.div
    key={layoutId} // Use layoutId as key for consistency
    className="bg-white/10 border-2 border-dashed border-gray-400 rounded-lg"
    style={{ height: `${PLACEHOLDER_HEIGHT}px`, marginBottom: '0.5rem' }} 
    layoutId={layoutId} // Use the passed layoutId
    initial={{ opacity: 0.5, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
  />
);
// --- End Placeholder Component --- 