// Add two-column Card Details sheet with right-side slide-in and framer-motion transitions
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '~/components/ui/sheet';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '~/components/ui/select';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { useBoard } from '~/services/board-context';
import { cn } from '~/lib/utils';
import type { Card, Priority } from '~/types';

interface CardDetailsSheetProps {
  card: Card;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CardDetailsSheet: React.FC<CardDetailsSheetProps> = ({ card, isOpen, onOpenChange }) => {
  const { updateCard, addAttachment, deleteAttachment } = useBoard();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    card.dueDate ? new Date(card.dueDate) : undefined
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset local state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description);
      setPriority(card.priority);
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
      setCalendarOpen(false);
      setAttachmentUrl('');
      setIsSaving(false);
    }
  }, [isOpen, card]);

  // Auto-save handlers for inline edits
  const handleTitleBlur = useCallback(async () => {
    await updateCard(card.id, { title });
  }, [card.id, title, updateCard]);
  const handleDescriptionBlur = useCallback(async () => {
    await updateCard(card.id, { description });
  }, [card.id, description, updateCard]);
  const handlePriorityChange = useCallback(async (newPriority: Priority) => {
    setPriority(newPriority);
    await updateCard(card.id, { priority: newPriority });
  }, [card.id, updateCard]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    await updateCard(card.id, { title, description, priority, dueDate });
    setIsSaving(false);
    onOpenChange(false);
  }, [card.id, title, description, priority, dueDate, updateCard, onOpenChange]);

  const handleAddAttachment = useCallback(async () => {
    if (!attachmentUrl.trim()) return;
    try {
      const url = new URL(attachmentUrl.trim());
      const name = url.hostname.replace('www.', '') + url.pathname;
      await addAttachment(card.id, name, attachmentUrl.trim(), url.protocol);
      setAttachmentUrl('');
    } catch (error) {
      console.error('Failed to add attachment:', error);
    }
  }, [attachmentUrl, card.id, addAttachment]);

  const handleDeleteAttachment = useCallback(
    async (attachmentId: string) => {
      if (window.confirm('Are you sure you want to delete this attachment?')) {
        await deleteAttachment(card.id, attachmentId);
      }
    },
    [card.id, deleteAttachment]
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <SheetContent asChild side="right" forceMount>
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-background fixed inset-y-0 right-0 w-[70%] p-4 flex flex-col shadow-lg z-50"
            >
              {/* Absolute close button top-right */}
              <SheetClose asChild>
                <button className="absolute top-4 right-4 p-2 rounded hover:bg-muted/10 z-50">
                  <XIcon className="h-5 w-5" />
                </button>
              </SheetClose>
              <SheetHeader className="flex items-center border-b p-2">
                <SheetTitle className="text-2xl font-bold">Card Details</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-auto mt-4 grid grid-cols-3 gap-6">
                {/* Left pane */}
                <div className="col-span-2 space-y-4">
                  {/* Title: inline editable */}
                  {isEditingTitle ? (
                    <Input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      onBlur={() => { setIsEditingTitle(false); handleTitleBlur(); }}
                      autoFocus
                    />
                  ) : (
                    <h2
                      className="text-2xl font-bold cursor-text"
                      onDoubleClick={() => setIsEditingTitle(true)}
                    >
                      {title || <span className="text-muted-foreground">Add a title</span>}
                    </h2>
                  )}
                  {/* Description: inline editable */}
                  {isEditingDescription ? (
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      onBlur={() => { setIsEditingDescription(false); handleDescriptionBlur(); }}
                      autoFocus
                      rows={6}
                    />
                  ) : (
                    <div
                      className="text-sm text-muted-foreground cursor-text"
                      onDoubleClick={() => setIsEditingDescription(true)}
                    >
                      {description || <span className="text-muted-foreground">Add a description</span>}
                    </div>
                  )}
                  <div className="mt-6 text-sm text-muted-foreground">
                    Activity & comments
                  </div>
                </div>

                {/* Right pane */}
                <div className="col-span-1 space-y-6">
                  {/* Priority */}
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Priority</h3>
                    <Select value={priority} onValueChange={handlePriorityChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Due Date</h3>
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !dueDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={date => {
                            const d = date || undefined;
                            setDueDate(d);
                            setCalendarOpen(false);
                            updateCard(card.id, { dueDate: d });
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Labels & Assignees */}
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Labels & Assignees</h3>
                    <div className="p-2 border rounded text-sm text-muted-foreground">
                      TODO: Labels & Assignees
                    </div>
                  </div>

                  {/* Attachments */}
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Attachments</h3>
                    <div className="space-y-2">
                      {card.attachments.map(att => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 bg-muted/10 rounded"
                        >
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="underline">
                            {att.name}
                          </a>
                          <button onClick={() => handleDeleteAttachment(att.id)}>
                            <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <Input
                        placeholder="Attachment URL"
                        value={attachmentUrl}
                        onChange={e => setAttachmentUrl(e.target.value)}
                      />
                      <Button onClick={handleAddAttachment}>Add</Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* End of content (footer removed) */}
            </motion.div>
          </SheetContent>
        )}
      </AnimatePresence>
    </Sheet>
  );
}; 