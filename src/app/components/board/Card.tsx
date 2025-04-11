'use client';

import React, { useRef, memo, useEffect, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { XYCoord, DropTargetMonitor } from 'react-dnd';
import type { Card as CardType } from '~/types';
import { ItemTypes } from '~/constants/dnd-types';
import type { CardDragItem } from '~/constants/dnd-types';
import { motion } from 'framer-motion';
import { useBoard } from '~/services/board-context'; // Import useBoard
import { ExpandedCardModal } from './ExpandedCardModal'; // Import the modal
import { Button } from '~/components/ui/button'; // Import Button
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"; // Import DropdownMenu components
import { MoreHorizontal, Trash2, Copy, Calendar, User, ArrowUp, ArrowDown, ArrowRight, Paperclip } from 'lucide-react'; // Import icons
import { format } from 'date-fns'; // For date formatting

// Define the drop result type
interface CardDropResult {
  droppedOnCard: boolean;
  targetCardId: string;
  targetColumnId: string;
  targetOrder: number;
}

interface CardProps {
  card: CardType;
  index: number; // Position in the list
  columnId: string; // Pass columnId for drop logic
  // onClick is likely removed or repurposed now that the modal handles it
  // onClick?: (card: CardType) => void;
  onMoveCard?: (dragIndex: number, hoverIndex: number) => void; // Keep for potential visual-only updates if needed
  onDragStart?: (item: CardDragItem) => void;
  onDragEnd?: () => void;
}

// Use memo to prevent unnecessary re-renders of cards that don't change
export const Card = memo(({ 
  card, 
  index, 
  columnId, // Get columnId prop
  // onClick,
  onMoveCard,
  onDragStart,
  onDragEnd
}: CardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { moveCard, deleteCard, duplicateCard } = useBoard(); // Get moveCard and deleteCard from context
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal visibility
  
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
  const [{ isDragging }, drag] = useDrag<CardDragItem, void, { isDragging: boolean }>({
    type: ItemTypes.CARD,
    item: () => {
      const item: CardDragItem = { 
        type: ItemTypes.CARD,
        id: card.id,
        columnId: columnId, // Use passed columnId
        index, 
        order: card.order, 
        originalIndex: index, // Store original index
        originalColumnId: columnId // Store original columnId
      };
      
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
        console.log('Card was dropped outside a valid drop target or drag cancelled');
      }
    }
  });

  // Set up drop functionality for hovering/dropping ON this card
  const [{ handlerId, isOver, canDrop }, drop] = useDrop<CardDragItem, CardDropResult, { handlerId: string | symbol | null, isOver: boolean, canDrop: boolean }>({
    accept: ItemTypes.CARD,
    collect: (monitor: DropTargetMonitor<CardDragItem, CardDropResult>) => ({
        handlerId: monitor.getHandlerId(),
        isOver: monitor.isOver(), // Track if a card is hovering over this one
        canDrop: monitor.canDrop(),
    }),
    hover: (item: CardDragItem, monitor: DropTargetMonitor<CardDragItem, CardDropResult>) => {
      if (!ref.current) { return; }
      // Ensure item has index and columnId, provide defaults if necessary
      const dragIndex = item.index ?? -1;
      const hoverIndex = index;
      const dragColumnId = item.columnId ?? '';
      const hoverColumnId = columnId;

      if (dragIndex === -1 || dragColumnId === '') return; // Exit if item data is invalid
      if (dragIndex === hoverIndex && dragColumnId === hoverColumnId) { return; } // Don't replace items with themselves

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return; // Check if clientOffset is null
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) { return; }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) { return; }

      // Perform the move in the parent component's state for visual feedback
      if (dragColumnId === hoverColumnId && onMoveCard) { 
        onMoveCard(dragIndex, hoverIndex);
        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations, but it's common practice in react-dnd examples.
        // It changes the index of the dragged item on the fly to avoid index mismatches during hover.
        item.index = hoverIndex; 
      }
    },
    drop: (item: CardDragItem, monitor: DropTargetMonitor<CardDragItem, CardDropResult>): CardDropResult => {
        // --- Finalize the move when dropped ON this card --- 
        const dragOriginalIndex = item.originalIndex ?? -1;
        const hoverIndex = index;
        const dragOriginalColumnId = item.originalColumnId ?? '';
        const hoverColumnId = columnId;

        // Check if it's a valid drop within the same column and not on itself
        if (dragOriginalColumnId === hoverColumnId && dragOriginalIndex !== hoverIndex) {
            // Call the actual move function from the context, using the target card's order
            moveCard(item.id, hoverColumnId, card.order);
        }
        return { droppedOnCard: true, targetCardId: card.id, targetColumnId: hoverColumnId, targetOrder: card.order }; // Return info about the drop target
    }
  });
  
  // Initialize drag and drop refs
  drag(drop(ref));

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  // Stop propagation for dropdown trigger click to prevent opening modal
  const handleDropdownTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Use the actual deleteCard function
  const handleDelete = (e: Event) => {
      e.stopPropagation(); // Keep stopPropagation for DropdownMenuItem
      if (window.confirm(`Are you sure you want to delete card \"${card.title}\"?`)) {
        deleteCard(card.id).catch(err => console.error("Error deleting card:", err));
      }
  };

  // Use the actual duplicateCard function
  const handleDuplicate = (e: Event) => {
      e.stopPropagation(); // Keep stopPropagation for DropdownMenuItem
      // Duplicates the card in the same column by default
      duplicateCard(card.id, columnId).catch(err => console.error("Error duplicating card:", err));
  };

  // Card appearance animation variants
  const cardVariants = {
    dragging: {
      scale: 1.05, // Slightly larger scale for "pick-up"
      rotate: 2, // Slight rotation
      boxShadow: "0 15px 25px rgba(0,0,0,0.25)", // More pronounced shadow
      opacity: 0.9, // Slightly more opaque than before
      cursor: "grabbing",
      zIndex: 50, // Ensure it's above everything
    },
    normal: {
      scale: 1,
      rotate: 0, // Ensure rotation resets
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      opacity: 1,
      cursor: "grab",
      zIndex: 1,
      transition: { type: "spring", stiffness: 500, damping: 30 } // Smoother return
    },
    hover: {
      scale: 1.03, // Keep hover subtle
      y: -2,
      zIndex: 10,
      transition: { duration: 0.15 }
    }
  };

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

  // Function to render attachment embed
  const renderAttachmentEmbed = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      
      // YouTube embed
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        const videoId = parsedUrl.hostname.includes('youtube.com') 
          ? parsedUrl.searchParams.get('v')
          : parsedUrl.pathname.substring(1);
          
        if (videoId) {
          return (
            <div className="relative pt-[56.25%] w-full overflow-hidden rounded mb-2">
              <iframe 
                className="absolute top-0 left-0 w-full h-full border-0"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          );
        }
      }
      
      // Image embed
      if (url.match(/\.(jpeg|jpg|gif|png)$/) !== null) {
        return (
          <img 
            src={url} 
            alt="Attachment" 
            className="mb-2 max-w-full rounded h-auto max-h-28 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        );
      }
      
      // Default link preview
      return (
        <div className="flex items-center p-2 bg-white/5 rounded mb-2">
          <img 
            src={`${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`} 
            alt=""
            className="w-4 h-4 mr-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-xs truncate">{parsedUrl.hostname}</span>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  // Get the first attachment if there is one
  const firstAttachment = card.attachments && card.attachments.length > 0 ? card.attachments[0] : null;

  return (
    <>
      <motion.div
        ref={ref}
        className={`relative glass-card p-3 cursor-pointer transition-all group 
                   border rounded-lg shadow-md hover:shadow-lg 
                   ${isOver && canDrop && 'ring-2 ring-pink-400/50'}`}
        style={{ 
          originX: 0.5, // Ensure scaling/rotation is centered
          originY: 0.5,
          ['--x' as string]: '50%',
          ['--y' as string]: '50%' 
        }}
        variants={cardVariants}
        initial="normal"
        animate={isDragging ? "dragging" : "normal"}
        whileHover="hover"
        layout="position" // Crucial for smooth reordering animation
        data-handler-id={handlerId} // Attach handler ID for dnd
        data-card-id={card.id} // Add data attribute for querying in Column
        onClick={handleOpenModal} // Re-add modal opening on click
      >
        {/* Dropdown Menu for actions */}
        <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
           <DropdownMenu>
             <DropdownMenuTrigger asChild onClick={handleDropdownTriggerClick}>
               <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                 <MoreHorizontal className="h-4 w-4" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
               <DropdownMenuLabel>Actions</DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem onSelect={handleDuplicate} className="cursor-pointer">
                 <Copy className="mr-2 h-4 w-4" />
                 <span>Duplicate</span>
               </DropdownMenuItem>
               <DropdownMenuItem onSelect={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-100/50">
                 <Trash2 className="mr-2 h-4 w-4" />
                 <span>Delete</span>
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
        </div>

        {/* Card Content */}
        <div onClick={handleOpenModal} className="flex-grow">
          <h3 className="font-semibold text-sm mb-1 text-gray-800 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{card.title}</h3>
          
          {/* Attachment Embed (if exists) */}
          {firstAttachment && renderAttachmentEmbed(firstAttachment.url)}
          
          {/* Description */}
          {card.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 whitespace-pre-wrap break-words">
              {card.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-2">
              {card.priority && (() => {
                const { Icon, color } = getPriorityInfo(card.priority);
                return (
                  <span className={`flex items-center ${color}`}>
                    <Icon className="h-3 w-3 mr-1" />
                  </span>
                );
              })()}

              {/* Due Date */}
              {card.dueDate && (
                <span className={`flex items-center ${new Date(card.dueDate) < new Date() ? 'text-orange-400' : ''}`}>
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(card.dueDate), 'MMM d')}
                </span>
              )}

              {/* Assignees */}
              {card.assignees && card.assignees.length > 0 && (
                 <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    {/* Display first initial for simplicity, max 2 */}
                    {card.assignees.slice(0, 2).map((assignee, i) => (
                      <span key={i} className="bg-gray-600/50 rounded-full px-1.5 py-0.5 text-xs">
                        {assignee.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {card.assignees.length > 2 && (
                       <span className="text-xs">+{card.assignees.length - 2}</span>
                    )}
                 </div>
              )}
              
              {/* Attachments */}
              {card.attachments && card.attachments.length > 0 && (
                <span className="flex items-center">
                  <Paperclip className="h-3 w-3 mr-1" />
                  {card.attachments.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Labels */}
        {card.labels && card.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {card.labels.slice(0, 3).map((label) => (
              <span 
                key={label.id}
                className="px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: label.color, color: '#ffffff' }}
              >
                {label.name}
              </span>
            ))}
            {card.labels.length > 3 && (
               <span className="text-xs text-gray-400 mt-1">+{card.labels.length - 3} more</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
          {/* ... (rest of the existing code remains unchanged) ... */}
        </div>
      </motion.div>

      {/* Expanded Card Modal */}
      {isModalOpen && (
        <ExpandedCardModal 
          card={card} 
          isOpen={isModalOpen} 
          onOpenChange={setIsModalOpen}
        />
      )}
    </>
  );
});

Card.displayName = 'Card'; // Add display name for better debugging 