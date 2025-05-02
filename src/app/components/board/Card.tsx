'use client';

import React, { useRef, memo, useState, useCallback } from 'react';
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
import { MoreHorizontal, Trash2, Copy, Calendar, ArrowUp, ArrowDown, ArrowRight, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { AttachmentPreview } from './AttachmentPreview';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import type { Card as CardType } from '~/types';
import type { CardDragItem } from '~/constants/dnd-types';

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
  isDragging?: boolean;
  onMoveCard?: (dragIndex: number, hoverIndex: number) => void;
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

export const Card = memo(({ 
  card, 
  index, 
  columnId,
  isDragging,
  onMoveCard,
  onDragStart,
  onDragEnd
}: CardProps) => {
  // Early return with fallback if card is undefined
  if (!card || !card.id) {
    console.warn('Card component received undefined or invalid card data');
    return null;
  }

  const ref = useRef<HTMLDivElement>(null);
  const { moveCard, deleteCard, duplicateCard } = useBoard();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Use the custom hook for the lighting effect
  useMousePositionStyle(ref);
  
  // no local drag; uses Hello Pangea DnD wrapper in Column

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

  // Safely access card properties
  const cardPriority = card.priority || 'low';
  const cardAttachments = card.attachments || [];
  const cardAssignees = card.assignees || [];
  
  const { Icon: PriorityIcon, color: priorityColor } = getPriorityInfo(cardPriority);

  return (
    <>
      <div
        ref={ref}
        className="relative glass-card p-2 cursor-pointer group border rounded-lg card-content"
        data-card-id={card.id}
        onClick={handleOpenModal}
        style={{ pointerEvents: 'auto' }}
      >
        {/* Conditionally render the ENTIRE DropdownMenu only when not dragging */}
        {!isDragging && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-[50ms]" onClick={handleDropdownTriggerClick}>
            <DropdownMenu onOpenChange={handleDropdownOpenChange} open={isDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
        )}

        <div className="flex-grow p-1">
          {cardAttachments.length > 0 && (
            <div className="mb-2">
              {cardAttachments.map((attachment) => (
                <AttachmentPreview key={attachment.id} url={attachment.url} />
              ))}
            </div>
          )}

          <h3 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms]">{card.title}</h3>
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 line-clamp-2 h-8">
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
              
              {cardAttachments.length > 0 && (
                 <span className="flex items-center ">
                  <Paperclip className="h-3 w-3" />
                </span>
              )}
            </div>

            {/* Show first assignee's initial */}
            {cardAssignees[0] && (
              <span className="flex items-center justify-center h-5 w-5 bg-gray-300 dark:bg-gray-600 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300" title={cardAssignees[0]}>
                {cardAssignees[0].charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
      {isModalOpen && (
        <ExpandedCardModal
          card={card}
          columnId={columnId}
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </>
  );
});

Card.displayName = 'Card'; 