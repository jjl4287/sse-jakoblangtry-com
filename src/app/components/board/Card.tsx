'use client';

import React, { useRef, memo, useEffect, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
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
import { MoreHorizontal, Trash2, Copy } from 'lucide-react'; // Import icons

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

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) { return; }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) { return; }

      // --- Perform visual swap only --- 
      if (dragColumnId === hoverColumnId) { 
        // Only mutate item index if it's within the same column for visual feedback
        item.index = hoverIndex; 
        // Call onMoveCard ONLY if it's needed for purely visual state updates in parent
        // For now, assume item.index mutation is enough.
        // if (onMoveCard) {
        //   onMoveCard(dragIndex, hoverIndex);
        // }
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
             console.log(`Card ${item.id} dropped onto card ${card.id} (order ${card.order}) in column ${hoverColumnId}`);
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
      e.stopPropagation();
      if (window.confirm(`Are you sure you want to delete card "${card.title}"?`)) {
        deleteCard(card.id).catch(err => console.error("Error deleting card:", err));
      }
  };

  // Use the actual duplicateCard function
  const handleDuplicate = (e: Event) => {
      e.stopPropagation();
      // Duplicates the card in the same column by default
      duplicateCard(card.id, columnId).catch(err => console.error("Error duplicating card:", err));
  };

  // Card appearance animation variants
  const cardVariants = {
    dragging: {
      scale: 1.03,
      boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
      opacity: 0.7,
      cursor: "grabbing",
      zIndex: 20,
    },
    normal: {
      scale: 1,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      opacity: 1,
      cursor: "grab",
      zIndex: 1,
    },
    hover: {
      scale: 1.02,
      y: -4,
      boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
      zIndex: 10,
    }
  };

  return (
    <>
      <motion.div
        ref={ref}
        className={`relative glass-card glass-depth-2 p-3 cursor-pointer transition-all group ${!isDragging && 'glass-border-animated'} ${isOver && canDrop && 'ring-2 ring-pink-400/50'}`}
        style={{ 
          transformOrigin: "center center",
          // Initial position for lighting variables
          ['--x' as string]: '50%',
          ['--y' as string]: '50%'
        }}
        onClick={handleOpenModal}
        data-handler-id={handlerId}
        initial="normal"
        animate={isDragging ? "dragging" : "normal"}
        whileHover="hover"
        variants={cardVariants}
        transition={{ 
          type: "spring", 
          damping: 20, 
          stiffness: 300,
          // Disable layout animations to prevent jittery movement during drag
          layout: { duration: 0 }
        }}
        layoutId={`card-${card.id}`}
      >
        {/* Dropdown Menu Trigger Button - visible on group hover */} 
        <DropdownMenu>
          <DropdownMenuTrigger asChild 
            onClick={handleDropdownTriggerClick} // Stop propagation
            className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Button variant="ghost" size="icon" className="h-6 w-6 bg-black/10 hover:bg-black/20">
              <MoreHorizontal className="h-4 w-4 text-white/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-gray-800/80 backdrop-blur border-white/20 text-white">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/20"/>
             {/* Edit action is handled by clicking the card itself now */} 
            <DropdownMenuItem onSelect={handleDuplicate} className="focus:bg-white/20 cursor-pointer">
              <Copy className="mr-2 h-4 w-4" />
              <span>Duplicate</span>
            </DropdownMenuItem>
            {/* Re-adding the Delete item */}
            <DropdownMenuSeparator className="bg-white/20"/>
            <DropdownMenuItem onSelect={handleDelete} className="focus:bg-red-500/30 text-red-400 focus:text-red-300 cursor-pointer">
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      {/* Pass the full card object to the Modal */}
      <ExpandedCardModal 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        card={card} // Pass the card object
      >
        {/* Children are no longer needed here as content is managed inside the modal */}
      </ExpandedCardModal>
    </>
  );
}); 