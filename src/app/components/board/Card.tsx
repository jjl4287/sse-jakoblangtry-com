'use client';

import React, { useRef, memo, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { Card as CardType } from '~/types';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';

interface CardProps {
  card: CardType;
  index: number; // Position in the list
  onClick?: (card: CardType) => void;
  onMoveCard?: (dragIndex: number, hoverIndex: number) => void;
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

// Use memo to prevent unnecessary re-renders of cards that don't change
export const Card = memo(({ 
  card, 
  index, 
  onClick, 
  onMoveCard,
  onDragStart,
  onDragEnd
}: CardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  
  // Add mouse position tracking for lighting effect
  useEffect(() => {
    const cardElement = ref.current;
    if (!cardElement) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = cardElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      cardElement.style.setProperty('--x', `${x}%`);
      cardElement.style.setProperty('--y', `${y}%`);
    };
    
    cardElement.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      cardElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // Set up drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.CARD,
    item: () => {
      const item = { 
        type: ItemTypes.CARD,
        id: card.id,
        columnId: card.columnId,
        index, 
        order: card.order 
      } as CardDragItem;
      
      // Notify parent components about drag start
      if (onDragStart) {
        setTimeout(() => {
          onDragStart(item);
        }, 0);
      }
      
      return item;
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      const didDrop = monitor.didDrop();
      
      // Notify parent components about drag end
      if (onDragEnd) {
        onDragEnd();
      }
      
      // If the card was dropped outside a valid drop target or back on itself
      // no action is needed as the UI will reset to the original position
      if (!didDrop) {
        // The card was not dropped in a valid target
        console.log('Card was dropped outside a valid drop target');
      }
    }
  });

  // Set up drop functionality
  const [{ handlerId }, drop] = useDrop({
    accept: ItemTypes.CARD,
    hover: (item: CardDragItem, monitor) => {
      if (!ref.current) {
        return;
      }
      
      // Don't replace items with themselves
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // Don't do anything if we're hovering over the same card
      if (dragIndex === hoverIndex) {
        return;
      }
      
      // Only perform the move when hovering at the middle of the target
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;
      
      // Dragging downwards, but haven't passed the middle
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      
      // Dragging upwards, but haven't passed the middle
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      
      // Only call the move function if we're in the same column
      if (item.columnId === card.columnId && onMoveCard) {
        onMoveCard(dragIndex, hoverIndex);
        // Update the index for the dragged item
        item.index = hoverIndex;
      }
    },
    collect: (monitor) => ({
      handlerId: monitor.getHandlerId(),
    }),
  });
  
  // Initialize drag and drop refs
  drag(drop(ref));

  const handleClick = () => {
    if (onClick) {
      onClick(card);
    }
  };

  // Card appearance animation variants
  const cardVariants = {
    dragging: {
      scale: 1.03,
      boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
      opacity: 0.7,
      cursor: "grabbing",
      zIndex: 10,
    },
    normal: {
      scale: 1,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      opacity: 1,
      cursor: "grab",
      zIndex: 1,
    },
    hover: {
      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
      zIndex: 5,
      // We're removing scale and y transform as those are handled in CSS now
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`glass-card glass-depth-2 p-3 cursor-pointer transition-all group ${!isDragging && 'glass-border-animated'}`}
      style={{ 
        transformOrigin: "center center",
        // Initial position for lighting variables
        '--x': '50%',
        '--y': '50%'
      }}
      onClick={handleClick}
      data-handler-id={handlerId}
      initial="normal"
      animate={isDragging ? "dragging" : "normal"}
      whileHover="hover"
      variants={cardVariants}
      transition={{ 
        type: "spring", 
        damping: 20, 
        stiffness: 300,
        // Disable layout animations to prevent jittery movement
        layout: { duration: 0 }
      }}
    >
      <h4 className="font-medium">{card.title}</h4>
      
      {card.description && (
        <p className="text-sm opacity-80 mt-2 line-clamp-2">
          {card.description}
        </p>
      )}
      
      {card.labels.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 text-xs rounded-full glass-depth-1"
              style={{ backgroundColor: `${label.color}4D` }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center mt-3">
        {card.dueDate && (
          <div className="text-xs opacity-80">
            Due: {new Date(card.dueDate).toLocaleDateString()}
          </div>
        )}
        {card.priority && (
          <div className={`text-xs px-2 py-0.5 rounded-full glass-depth-1 ${
            card.priority === 'high' ? 'bg-red-500/30' :
            card.priority === 'medium' ? 'bg-yellow-500/30' : 'bg-green-500/30'
          }`}>
            {card.priority}
          </div>
        )}
      </div>
      
      {card.assignees.length > 0 && (
        <div className="flex mt-2 -space-x-2">
          {card.assignees.map((assignee, index) => (
            <div 
              key={index} 
              className="w-6 h-6 rounded-full glass-depth-1 flex items-center justify-center text-xs border border-white/10"
              title={assignee}
            >
              {assignee.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}); 