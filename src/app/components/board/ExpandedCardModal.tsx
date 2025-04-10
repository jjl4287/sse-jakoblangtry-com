import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CalendarIcon } from 'lucide-react'; // Added CalendarIcon
import { format } from 'date-fns'; // For formatting date
import type { Card as CardType, Priority } from '~/types'; // Import CardType and Priority
import { Input } from '~/components/ui/input'; // Import Shadcn Input
import { Textarea } from '~/components/ui/textarea'; // Import Shadcn Textarea
import { Label } from '~/components/ui/label'; // Import Shadcn Label
import { useBoard } from '~/services/board-context'; // Import useBoard
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"; // Import Select components
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"; // Import Popover components
import { Button } from "~/components/ui/button"; // Import Button
import { Calendar } from "~/components/ui/calendar"; // Import Calendar
import { Badge } from "~/components/ui/badge"; // Import Badge
import { cn } from "~/lib/utils"; // Import cn utility

interface ExpandedCardModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardType; // Pass the full card object
  children?: React.ReactNode; // Make children optional for now
}

// Define priority options
const priorityOptions: Priority[] = ['low', 'medium', 'high'];

export const ExpandedCardModal: React.FC<ExpandedCardModalProps> = ({
  isOpen,
  onOpenChange,
  card, // Use the card object
  children,
}) => {
  const { updateCard } = useBoard(); // Get updateCard function
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState<Priority>(card.priority || 'medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(card.dueDate ? new Date(card.dueDate) : undefined);
  const [isSaving, setIsSaving] = useState(false); // Add saving state indicator
  const [titleError, setTitleError] = useState<string | null>(null); // State for title validation

  // Effect to reset form state when the modal opens for a different card
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || '');
      setPriority(card.priority || 'medium');
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
      setIsSaving(false); // Reset saving state
      setTitleError(null); // Reset validation error
    }
  }, [isOpen, card]);

  // Validation effect for Title
  useEffect(() => {
      if (isOpen && title.trim() === '') {
          setTitleError('Title cannot be empty.');
      } else {
          setTitleError(null);
      }
  }, [title, isOpen]);

  // Debounced auto-save effect (now includes priority and dueDate)
  useEffect(() => {
    const originalDueDateStr = card.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : null;
    const currentDueDateStr = dueDate ? dueDate.toISOString().split('T')[0] : null;

    const hasChanges = title !== card.title || 
                       description !== (card.description || '') || 
                       priority !== (card.priority || 'medium') || 
                       originalDueDateStr !== currentDueDateStr;

    if (!isOpen || !hasChanges || titleError) { // Don't save if no changes or validation error
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    const handler = setTimeout(() => {
      console.log('Auto-saving card:', card.id, { title, description, priority, dueDate });
      updateCard(card.id, { 
          title, 
          description, 
          priority, 
          dueDate: dueDate ? dueDate.toISOString() : null // Store as ISO string or null
      });
      setIsSaving(false);
    }, 750);

    return () => {
      clearTimeout(handler);
    };
  }, [title, description, priority, dueDate, card, updateCard, isOpen, titleError]); // Added dependencies

  // TODO: Implement validation logic

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay with glassmorphism */}
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm data-[state=open]:animate-overlayShow z-40" />
        {/* Modal Content */}
        <Dialog.Content
          className="
            fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[90vw] max-w-lg max-h-[90vh] p-6 rounded-lg shadow-xl /* Increased max-w and max-h */
            bg-white/10 backdrop-blur-lg border border-white/20
            text-white focus:outline-none z-50
            data-[state=open]:animate-contentShow
          "
        >
          {/* Re-add Dialog.Title for accessibility, hidden visually */}
          <Dialog.Title className="sr-only">Edit Card: {card.title}</Dialog.Title>
          
          {/* Saving Indicator (optional) */}
          {isSaving && <div className="absolute top-4 left-4 text-xs text-yellow-400 animate-pulse">Saving...</div>}

          {/* Title will be part of the form now */}
          {/* <Dialog.Title className="text-xl font-semibold mb-2">
            {title}
          </Dialog.Title> */}

          {/* Description can be removed or repurposed */}
          {/* <Dialog.Description className="text-sm text-gray-300 mb-5">
            View and edit card details below.
          </Dialog.Description> */}

          {/* Dynamic Content Area */}
          <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-4 pr-3"> {/* Added padding-right for scrollbar */}
            {/* Title Field with Validation */}
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor={`card-title-${card.id}`} className="text-xs text-gray-400">Title</Label>
              <Input 
                id={`card-title-${card.id}`}
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title"
                className={cn(
                  "bg-white/5 border-white/20 placeholder:text-gray-400 focus-visible:ring-offset-0 focus-visible:ring-white/50",
                  titleError && "border-red-500 focus-visible:ring-red-500"
                )} 
              />
              {titleError && <p className="text-xs text-red-400 mt-1">{titleError}</p>}
            </div>

            {/* Description Field */}
            <div className="grid w-full gap-1.5">
              <Label htmlFor={`card-description-${card.id}`} className="text-xs text-gray-400">Description</Label>
              <Textarea 
                id={`card-description-${card.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                className="bg-white/5 border-white/20 placeholder:text-gray-400 focus-visible:ring-offset-0 focus-visible:ring-white/50 min-h-[80px]" // Custom styles
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4"> {/* Grid for Priority and Due Date */}
              {/* Priority Field */}
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor={`card-priority-${card.id}`} className="text-xs text-gray-400">Priority</Label>
                   <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
                      <SelectTrigger id={`card-priority-${card.id}`} className="w-full bg-white/5 border-white/20 focus:ring-offset-0 focus:ring-white/50">
                          <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800/80 backdrop-blur border-white/20 text-white">
                          {priorityOptions.map(option => (
                              <SelectItem key={option} value={option} className="capitalize focus:bg-white/20">
                                  {option}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>

              {/* Due Date Field */}
              <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor={`card-dueDate-${card.id}`} className="text-xs text-gray-400">Due Date</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              id={`card-dueDate-${card.id}`}
                              variant={"outline"}
                              className={cn(
                                  "w-full justify-start text-left font-normal bg-white/5 border-white/20 hover:bg-white/10 hover:text-white",
                                  !dueDate && "text-gray-400"
                              )}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-800/80 backdrop-blur border-white/20 text-white" align="start">
                          <Calendar
                              mode="single"
                              selected={dueDate}
                              onSelect={setDueDate}
                              initialFocus
                              className="[&>div]:bg-transparent [&_button]:bg-transparent [&_button]:border-0"
                          />
                      </PopoverContent>
                  </Popover>
              </div>
            </div>

            {/* Labels Display (Read-only for now) */}
            {card.labels.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Labels</Label>
                <div className="flex gap-1 flex-wrap">
                  {card.labels.map((label) => (
                    <Badge key={label.id} variant="outline" style={{ borderColor: `${label.color}80`, backgroundColor: `${label.color}30` }} className="text-white/90">
                      {label.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

             {/* Assignees Display (Read-only for now) */}
            {card.assignees.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Assignees</Label>
                <div className="flex gap-1 flex-wrap">
                  {card.assignees.map((assignee, index) => (
                    <Badge key={index} variant="outline" className="border-white/20 bg-white/10 text-white/90">
                      {assignee}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {children} {/* Keep for potential future extensibility */} 
          </div>

          {/* Close Button */}
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// Note: Tailwind animation keyframes (overlayShow, contentShow) need to be defined
// in tailwind.config.ts for the animations to work.
// Example:
// keyframes: {
//   overlayShow: { from: { opacity: '0' }, to: { opacity: '1' } },
//   contentShow: {
//     from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.96)' },
//     to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
//   },
// },
// animation: {
//   overlayShow: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
//   contentShow: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
// }, 