'use client';

import React, { useRef, memo, useState, useCallback } from 'react';
import { useBoard } from '~/services/board-context';
import { CardDetailsSheet } from './CardDetailsSheet';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Copy, Calendar, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import type { Card as CardType, Label as LabelType } from '~/types';
import type { CardDragItem } from '~/constants/dnd-types';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { cn, getContrastingTextColor } from '~/lib/utils';

// Helper function for text color based on background (copied from NewCardSheet)
// TODO: Move to a shared utils file if used in multiple places
/*
function مناسبTextColor(bgColor: string | undefined | null): string {
    if (!bgColor) return '#000000';
    try {
        const color = bgColor.charAt(0) === '#' ? bgColor.substring(1, 7) : bgColor;
        const r = parseInt(color.substring(0, 2), 16); 
        const g = parseInt(color.substring(2, 4), 16); 
        const b = parseInt(color.substring(4, 6), 16); 
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#FFFFFF';
    } catch (e) {
        return '#000000';
    }
}
*/

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
  const cardLabels = card.labels || [];
  
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
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span>Delete Card</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="flex-grow p-1">
          <h3 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms]">{card.title}</h3>
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 line-clamp-2 h-8">
              {card.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`flex items-center ${priorityColor}`}>
                <PriorityIcon className="h-3 w-3 mr-0.5" />
              </span>

              {card.dueDate && (
                <span className="flex items-center ">
                  <Calendar className="h-3 w-3 mr-0.5" />
                  {format(new Date(card.dueDate), 'MMM d')}
                </span>
              )}
              
              {cardLabels.slice(0, 3).map(label => (
                <Badge 
                  key={label.id} 
                  variant="outline" 
                  className="px-1.5 py-0.5 text-[10px] font-normal border"
                  style={{ 
                    backgroundColor: label.color, 
                    color: getContrastingTextColor(label.color),
                    borderColor: getContrastingTextColor(label.color) === '#000000' ? '#00000030' : '#FFFFFF50',
                   }}
                >
                  {label.name}
                </Badge>
              ))}
              {cardLabels.length > 3 && (
                <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] font-normal border">
                  +{cardLabels.length - 3}
                </Badge>
              )}
            </div>

            {/* Display stacked assignee avatars */}
            <div className="flex items-center">
              {cardAssignees.slice(0, 3).map((assignee, idx) => (
                <Avatar
                  key={assignee.id}
                  className="h-5 w-5"
                  style={{ zIndex: cardAssignees.length - idx, marginLeft: idx > 0 ? '-4px' : '0px' }}
                  title={assignee.name || assignee.email || 'Assignee'}
                >
                  {assignee.image ? (
                    <AvatarImage
                      src={assignee.image}
                      alt={assignee.name || assignee.email || 'Assignee avatar'}
                    />
                  ) : (
                    <AvatarFallback>
                      {(assignee.name || assignee.email)?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
              ))}
              {cardAssignees.length > 3 && (
                <Avatar
                  className="h-5 w-5 bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400"
                  style={{ zIndex: 0, marginLeft: '-4px' }}
                  title={`${cardAssignees.length - 3} more assignees`}
                >
                  <AvatarFallback>+{cardAssignees.length - 3}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </div>
      {isModalOpen && (
        <CardDetailsSheet
          card={card}
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </>
  );
});

Card.displayName = 'Card'; 