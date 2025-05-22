'use client';

import React, { useRef, memo, useState, useCallback } from 'react';
import { useBoard } from '~/services/board-context';
import { CardDetailsSheet } from './CardDetailsSheet';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Calendar, ArrowUp, ArrowDown, ArrowRight, Weight } from 'lucide-react';
import { format } from 'date-fns';
import { useMousePositionStyle } from '~/hooks/useMousePositionStyle';
import type { Card as CardType } from '~/types';
import type { CardDragItem } from '~/constants/dnd-types';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { getContrastingTextColor } from '~/lib/utils';
import { StyledLabelBadge } from '~/components/ui/StyledLabelBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';

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
  isDragging
}: CardProps) => {
  // Log invalid data but maintain hook order
  if (!card?.id) {
    console.warn('Card component received undefined or invalid card data');
  }

  const ref = useRef<HTMLDivElement>(null);
  const { deleteCard } = useBoard();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCardDeleteConfirmOpen, setIsCardDeleteConfirmOpen] = useState(false);
  
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

  // Opens the delete confirmation dialog
  const requestDeleteCard = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsCardDeleteConfirmOpen(true);
    setIsDropdownOpen(false); // Close the dropdown when dialog opens
  }, []);

  // Executes the card deletion
  const executeDeleteCard = useCallback(async () => {
    try {
      const deletePromise = deleteCard(card.id);
      if (deletePromise && typeof deletePromise.then === 'function') {
        await deletePromise;
      }
    } catch (err) {
      console.error("Error deleting card:", err);
      // Optionally show a toast message here
    }
    setIsCardDeleteConfirmOpen(false); // Close dialog
  }, [card.id, deleteCard]);

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
  const cardPriority = card.priority ?? 'low';
  const cardAssignees = card.assignees ?? [];
  const cardLabels = card.labels ?? [];
  
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
        {/* Conditionally render the Delete Button only when not dragging */}
        {!isDragging && (
          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-[50ms]" onClick={(e) => e.stopPropagation()}> {/* Prevent card click through */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 rounded-full"
              onClick={requestDeleteCard} 
              aria-label="Delete card"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-grow p-1">
          <h3 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms]">{card.title}</h3>
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 line-clamp-2 h-8">
              {card.description}
            </p>
          )}
          {/* Labels Display - Moved to its own row */}
          {cardLabels.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mb-2">
              {cardLabels.slice(0, 3).map(label => (
                <StyledLabelBadge key={label.id} label={label} />
              ))}
              {cardLabels.length > 3 && (
                <Badge variant="outline" className="px-1.5 py-0.5 text-[10px] font-normal border">
                  +{cardLabels.length - 3}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {/* Weight Display */}
              {card.weight !== undefined && card.weight > 0 && (
                <span className="flex items-center">
                  <Weight className="h-3 w-3 mr-0.5" />
                  {card.weight}
                </span>
              )}

              {/* Due Date Display */}
              {card.dueDate && (
                <span className="flex items-center ">
                  <Calendar className="h-3 w-3 mr-0.5" />
                  {format(new Date(card.dueDate), 'MMM d')}
                </span>
              )}
              
              {/* Priority Display (moved to last in this group) */}
              <span className={`flex items-center ${priorityColor}`}>
                <PriorityIcon className="h-3 w-3 mr-0.5" />
              </span>
            </div>

            {/* Display stacked assignee avatars */}
            <div className="flex items-center">
              {cardAssignees.slice(0, 3).map((assignee, idx) => (
                <Avatar
                  key={assignee.id}
                  className="h-5 w-5"
                  style={{ zIndex: cardAssignees.length - idx, marginLeft: idx > 0 ? '-4px' : '0px' }}
                  title={assignee.name ?? assignee.email ?? 'Assignee'}
                >
                  {assignee.image ? (
                    <AvatarImage
                      src={assignee.image}
                      alt={assignee.name ?? assignee.email ?? 'Assignee avatar'}
                    />
                  ) : (
                    <AvatarFallback>
                      {(assignee.name ?? assignee.email)?.charAt(0).toUpperCase() ?? '?'}
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
      {/* Card Delete Confirmation Dialog */}
      <AlertDialog open={isCardDeleteConfirmOpen} onOpenChange={setIsCardDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This action cannot be undone. This will permanently delete the card "${card.title}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteCard} className="bg-red-600 hover:bg-red-700">
              Delete Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

Card.displayName = 'Card'; 