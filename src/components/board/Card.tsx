'use client';

import React, { useRef, memo, useState, useCallback, useEffect } from 'react';
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
import { useCardMutations } from '~/hooks/useCard';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '~/components/ui/avatar';
import { getContrastingTextColor, extractMarkdownHeader, getCardPastelClass } from '~/lib/utils';
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
  boardId?: string;
}

export const Card = memo(({ 
  card: initialCard, 
  isDragging,
  boardId
}: CardProps) => {
  // Log invalid data but maintain hook order
  if (!initialCard?.id) {
    console.warn('Card component received undefined or invalid card data');
  }

  const ref = useRef<HTMLDivElement>(null);
  const { deleteCard } = useCardMutations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCardDeleteConfirmOpen, setIsCardDeleteConfirmOpen] = useState(false);
  
  // Local card state to support optimistic updates
  const [card, setCard] = useState(initialCard);

  // Update local state when prop changes
  useEffect(() => {
    setCard(initialCard);
  }, [initialCard]);
  
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
      await deleteCard(card.id);
    } catch (err) {
      console.error("Error deleting card:", err);
      // Optionally show a toast message here
    }
    setIsCardDeleteConfirmOpen(false); // Close dialog
  }, [card.id, deleteCard]);

  // Handler for card updates from the details sheet
  const handleCardUpdate = useCallback((updatedCard: CardType) => {
    setCard(updatedCard);
  }, []);

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

  // Get consistent pastel class for this card
  const pastelClass = getCardPastelClass(card.id);

  return (
    <>
      <div
        ref={ref}
        className={`relative glass-card ${pastelClass} p-1 cursor-pointer group border rounded-lg card-content`}
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
          {/* Title with Weight, Date, and Priority on same line */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-base text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-[50ms] flex-1 mr-2">{card.title}</h3>
            
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              {/* Weight Display */}
              {card.weight !== undefined && card.weight > 0 && (
                <span className="flex items-center">
                  <Weight className="h-3 w-3 mr-1" />
                  {card.weight}
                </span>
              )}

              {/* Due Date Display */}
              {card.dueDate && (
                <span className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(card.dueDate), 'MMM d')}
                </span>
              )}
              
              {/* Priority Display */}
              <span className={`flex items-center ${priorityColor}`}>
                <PriorityIcon className="h-3 w-3 mr-1" />
              </span>
            </div>
          </div>

          {/* Description with markdown header extraction */}
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 line-clamp-2 h-8">
              {extractMarkdownHeader(card.description)}
            </p>
          )}

          {/* Labels and Avatars at bottom - same row */}
          {(cardLabels.length > 0 || cardAssignees.length > 0) && (
            <div className="flex items-center justify-between mt-2">
              {/* Labels */}
              <div className="flex items-center flex-wrap gap-1">
                {cardLabels.slice(0, 3).map(label => (
                  <StyledLabelBadge key={label.id} label={label} />
                ))}
                {cardLabels.length > 3 && (
                  <Badge variant="outline" className="px-2 py-1 text-[10px] font-normal border">
                    +{cardLabels.length - 3}
                  </Badge>
                )}
              </div>

              {/* Assignee avatars */}
              {cardAssignees.length > 0 && (
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
              )}
            </div>
          )}
        </div>
      </div>
      {isModalOpen && (
        <CardDetailsSheet
          card={card}
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          boardId={boardId}
          onCardUpdate={handleCardUpdate}
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