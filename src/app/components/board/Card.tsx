'use client';

import React, { useRef, memo, useEffect, useState, useCallback } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
import type { Card as CardType } from '~/types';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';
import { useBoard } from '~/services/board-context';
import { ExpandedCardModal } from './ExpandedCardModal';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Copy, Calendar, User, ArrowUp, ArrowDown, ArrowRight, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { AttachmentPreview } from './AttachmentPreview';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';

// Define the drop result type
interface CardDropResult {
  droppedOnCard: boolean;
  targetCardId: string;
  targetColumnId: string;
  targetOrder: number;
}

interface CardProps {
  card: CardType;
  index: number;
  columnId: string;
  onMoveCard?: (dragIndex: number, hoverIndex: number) => void;
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

// Card appearance animation variants
const cardVariants = {
  dragging: {
    scale: 1.05,
    rotate: 2,
    boxShadow: "0 15px 25px rgba(0,0,0,0.25)",
    opacity: 0.9,
    cursor: "grabbing",
    zIndex: 50,
  },
  normal: {
    scale: 1,
    rotate: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    opacity: 1,
    cursor: "grab",
    zIndex: 1,
    transition: { duration: 0.05 }
  },
  hover: {
    scale: 1.05,
    y: -4,
    x: 0,
    boxShadow: "0 20px 25px rgba(0,0,0,0.25)",
    zIndex: 100,
    transition: { duration: 0.05 },
    opacity: 1
  }
};

export const Card = memo(({ 
  card, 
  index, 
  columnId,
  onMoveCard,
  onDragStart,
  onDragEnd
}: CardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { moveCard, deleteCard, duplicateCard } = useBoard();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Use the custom hook for the lighting effect
  useMousePositionStyle(ref);
  
  // Set up drag functionality
  const [{ isDragging }, drag] = useDrag<CardDragItem, void, { isDragging: boolean }>({
    type: ItemTypes.CARD,
    item: () => {
      const item: CardDragItem = { 
        type: ItemTypes.CARD,
        id: card.id,
        columnId,
        index, 
        order: card.order, 
        originalIndex: index,
        originalColumnId: columnId
      };
      
      if (onDragStart) {
        setTimeout(() => onDragStart(item), 0);
      }
      
      return item;
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      const didDrop = monitor.didDrop();
      
      if (onDragEnd) {
        onDragEnd();
      }
      
      if (!didDrop) {
        console.log('Card was dropped outside a valid drop target or drag cancelled');
      }
    }
  });

  // Set up drop functionality for hovering/dropping ON this card
  const [{ handlerId, isOver, canDrop }, drop] = useDrop<CardDragItem, CardDropResult, { handlerId: string | symbol | null, isOver: boolean, canDrop: boolean }>({
    accept: ItemTypes.CARD,
    collect: (monitor) => ({
        handlerId: monitor.getHandlerId(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
    }),
    hover: (item: CardDragItem, monitor) => {
      if (!ref.current) return;
      
      const dragIndex = item.index ?? -1;
      const hoverIndex = index;
      const dragColumnId = item.columnId ?? '';
      const hoverColumnId = columnId;

      if (dragIndex === -1 || dragColumnId === '') return;
      if (dragIndex === hoverIndex && dragColumnId === hoverColumnId) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Dragging downwards - only move when cursor is below 50%
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      // Dragging upwards - only move when cursor is above 50%
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      if (dragColumnId === hoverColumnId && onMoveCard) { 
        onMoveCard(dragIndex, hoverIndex);
        item.index = hoverIndex; 
      }
    },
    drop: (item: CardDragItem): CardDropResult => {
        const dragOriginalIndex = item.originalIndex ?? -1;
        const hoverIndex = index;
        const dragOriginalColumnId = item.originalColumnId ?? '';
        const hoverColumnId = columnId;

        if (dragOriginalColumnId === hoverColumnId && dragOriginalIndex !== hoverIndex) {
            moveCard(item.id, hoverColumnId, card.order);
        }
        return { 
          droppedOnCard: true, 
          targetCardId: card.id, 
          targetColumnId: hoverColumnId, 
          targetOrder: card.order 
        };
    }
  });
  
  // Initialize drag and drop refs
  drag(drop(ref));

  const handleOpenModal = useCallback(() => {
    if (isDropdownOpen) return;
    setIsModalOpen(true);
  }, [isDropdownOpen]);

  const handleDropdownTriggerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleDropdownOpenChange = useCallback((open: boolean) => {
    setIsDropdownOpen(open);
  }, []);

  const handleDelete = useCallback((e: Event) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete card "${card.title}"?`)) {
      deleteCard(card.id).catch(err => console.error("Error deleting card:", err));
    }
  }, [card.id, card.title, deleteCard]);

  const handleDuplicate = useCallback((e: Event) => {
    e.stopPropagation();
    duplicateCard(card.id, columnId).catch(err => console.error("Error duplicating card:", err));
  }, [card.id, columnId, duplicateCard]);

  // Helper function to get priority icon and color
  const getPriorityInfo = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return { Icon: ArrowUp, color: 'text-red-500' };
      case 'medium':
        return { Icon: ArrowRight, color: 'text-yellow-500' };
      case 'low':
      default:
        return { Icon: ArrowDown, color: 'text-green-500' };
    }
  };

  const { Icon: PriorityIcon, color: priorityColor } = getPriorityInfo(card.priority ?? 'low');

  const cardAnimationState = isDragging ? "dragging" : isDropdownOpen ? "normal" : "normal";

  return (
    <>
      <motion.div
        ref={ref}
        layoutId={`card-${card.id}`}
        className={`relative glass-card p-2 cursor-pointer transition-transform transition-shadow duration-[50ms] group 
                   border rounded-lg shadow-md hover:shadow-lg 
                   ${isDragging ? 'opacity-50' : ''}`}
        data-card-id={card.id}
        variants={cardVariants}
        initial="normal"
        animate={cardAnimationState}
        whileHover={!isDragging && !isDropdownOpen ? "hover" : "normal"}
        drag={!isDropdownOpen}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={0.1}
        data-handler-id={handlerId}
        onClick={handleOpenModal}
        style={{
          transformOrigin: '50% 50%',
          position: 'relative',
        }}
      >
        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-[50ms]" onClick={handleDropdownTriggerClick}>
          <DropdownMenu onOpenChange={handleDropdownOpenChange} open={isDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 rounded-full">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Card Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                <span>Duplicate Card</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Card</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-grow p-1">
          {card.attachments && card.attachments.length > 0 && (
            <div className="mb-2">
              {card.attachments.map((url, idx) => (
                <AttachmentPreview key={idx} url={url} />
              ))}
            </div>
          )}

          <h3 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms]">{card.title}</h3>
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 whitespace-pre-wrap break-words truncate max-h-10 overflow-hidden">
              {card.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-2">
              <span className={`flex items-center ${priorityColor}`}>
                <PriorityIcon className="h-3 w-3 mr-1" />
              </span>

              {card.dueDate && (
                <span className="flex items-center ">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(card.dueDate), 'MMM d')}
                </span>
              )}
              
              {card.attachments && card.attachments.length > 0 && (
                 <span className="flex items-center ">
                  <Paperclip className="h-3 w-3" />
                </span>
              )}
            </div>

            {card.assignedTo && (
              <span className="flex items-center justify-center h-5 w-5 bg-gray-300 dark:bg-gray-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300" title={card.assignedTo}>
                {card.assignedTo.substring(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </motion.div>
      {isModalOpen && (
        <ExpandedCardModal 
          card={card} 
          columnId={columnId} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </>
  );
});

Card.displayName = 'Card'; 