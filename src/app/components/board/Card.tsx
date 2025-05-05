'use client';

import React, { useRef, memo, useState, useCallback } from 'react';
import { useBoard } from '~/services/board-context';
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
import { Badge } from '~/components/ui/badge';
import { CardLabels } from './ui/CardLabels';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';

interface CardProps {
  card: CardType;
  isDragging?: boolean;
  onClick?: () => void;
}

export const Card = memo(({ 
  card, 
  isDragging,
  onClick
}: CardProps) => {
  if (!card || !card.id) {
    console.warn('Card component received undefined or invalid card data');
    return null;
  }

  const ref = useRef<HTMLDivElement>(null);
  const { deleteCard, duplicateCard } = useBoard();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  useMousePositionStyle(ref);
  
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
    setIsDropdownOpen(false);
  }, [card.id, card.title, deleteCard]);

  const handleDuplicate = useCallback((e: Event) => {
    e.stopPropagation();
    const currentColumnId = card.columnId;
    if (currentColumnId) {
      duplicateCard(card.id, currentColumnId).catch(err => console.error("Error duplicating card:", err));
    } else {
      console.error("Cannot duplicate card: columnId missing.");
    }
    setIsDropdownOpen(false);
  }, [card.id, card.columnId, duplicateCard]);

  const getPriorityInfo = (priority: 'low' | 'medium' | 'high' = 'low') => {
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

  const cardPriority = card.priority || 'low';
  const cardAttachments = card.attachments || [];
  const cardAssignees = card.assignees || [];
  
  const { Icon: PriorityIcon, color: priorityColor } = getPriorityInfo(cardPriority);

  return (
    <div
      ref={ref}
      className="relative glass-card p-2 cursor-pointer group border rounded-lg card-content"
      data-card-id={card.id}
      onClick={() => {
        console.log(`[Card.tsx] onClick fired for cardId: ${card.id}`);
        onClick?.();
      }}
      style={{ pointerEvents: 'auto' }}
    >
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
            <AttachmentPreview key={cardAttachments[0].id} url={cardAttachments[0].url} type={cardAttachments[0].type} />
          </div>
        )}

        <CardLabels labels={card.labels || []} cardId={card.id} editable={false} />

        <h3 className="font-semibold text-sm mt-2 mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms]">{card.title}</h3>
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
                <Paperclip className="h-3 w-3 mr-1" /> {cardAttachments.length}
              </span>
            )}
          </div>

          <div className="flex items-center -space-x-1">
            {cardAssignees.map((assignee, index) => {
               if (!assignee || typeof assignee !== 'object' || !assignee.id) {
                 console.warn(`Card ${card.id}: Invalid assignee data or missing ID at index ${index}:`, assignee);
                 return (
                   <Avatar key={`invalid-assignee-${index}`} className="h-5 w-5 border border-red-500 text-xs bg-red-100">
                     <AvatarFallback title="Invalid Assignee">!</AvatarFallback>
                   </Avatar>
                 );
               }
               return (
                 <Avatar key={assignee.id} className="h-5 w-5 border border-background text-xs">
                   <AvatarFallback title={assignee.name || assignee.email || 'Unknown User'}>{assignee.name?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                 </Avatar>
               );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

Card.displayName = 'Card'; 