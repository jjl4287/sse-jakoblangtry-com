import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, CalendarIcon, Paperclip, Link, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';
import type { Card as CardType, Priority, Attachment } from '~/types';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import { useBoard } from '~/services/board-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import Image from 'next/image';

interface ExpandedCardModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CardType; // Make card optional for new card creation
  columnId?: string; // Required for new card creation
  children?: React.ReactNode;
}

// Define priority options
const priorityOptions: Priority[] = ['low', 'medium', 'high'];

export const ExpandedCardModal: React.FC<ExpandedCardModalProps> = ({
  isOpen,
  onOpenChange,
  card,
  columnId,
}) => {
  // Determine if this is a new card
  const isNewCard = !card;
  
  const { createCard, updateCard, addAttachment, deleteAttachment } = useBoard();
  const [title, setTitle] = useState<string>(card?.title ?? '');
  const [description, setDescription] = useState<string>(card?.description ?? '');
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState<Date | null>(card?.dueDate ? new Date(card?.dueDate) : null);
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  
  // Get attachments - memoize to avoid unnecessary recalculations
  const attachments = useMemo(() => card?.attachments ?? [], [card?.attachments]);

  // Effect to reset form state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(card?.title ?? '');
      setDescription(card?.description ?? '');
      setPriority(card?.priority ?? 'medium');
      setDueDate(card?.dueDate ? new Date(card?.dueDate) : null);
      setAttachmentUrl('');
      setHasChanges(false);
      setIsSaving(false);
      setTitleError(null);
    }
  }, [isOpen, card]);

  // Validation effect for Title
  useEffect(() => {
    if (isOpen) {
      setTitleError(title.trim() === '' ? 'Title cannot be empty.' : null);
    }
  }, [title, isOpen]);

  // Track changes
  useEffect(() => {
    if (!isOpen) return;
    
    if (isNewCard) {
      // For new cards, having a title is enough to enable save
      setHasChanges(title.trim() !== '');
      return;
    }
    
    const originalDueDateStr = card?.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : null;
    const currentDueDateStr = dueDate ? dueDate.toISOString().split('T')[0] : null;

    setHasChanges(
      title !== card?.title || 
      description !== (card?.description || '') || 
      priority !== (card?.priority || 'medium') || 
      originalDueDateStr !== currentDueDateStr
    );
  }, [title, description, priority, dueDate, card, isOpen, isNewCard]);

  const handleSave = useCallback(async () => {
    if (titleError || !title.trim()) return;
    
    setIsSaving(true);
    
    try {
      if (isNewCard && columnId) {
        // Create a new card
        await createCard(columnId, {
          title,
          description,
          priority,
          dueDate: dueDate ?? undefined,
          labels: [],
          assignees: [],
          attachments: [],
          comments: [],
        });
      } else if (card) {
        // Update existing card
        await updateCard(card.id, {
          title,
          description,
          priority,
          dueDate: dueDate ?? undefined,
        });
      }
      
      // Close the modal after successful save
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving card:', error);
    } finally {
      setIsSaving(false);
    }
  }, [titleError, title, isNewCard, columnId, createCard, description, priority, dueDate, card, updateCard, onOpenChange]);

  const handleAddAttachment = useCallback(async () => {
    if (!attachmentUrl.trim() || !card) return;
    
    try {
      // Validate URL
      new URL(attachmentUrl.trim());
      
      // Extract domain for attachment name
      const url = new URL(attachmentUrl.trim());
      const name = url.hostname.replace('www.', '');
      
      // Add attachment
      await addAttachment(card.id, name, attachmentUrl.trim(), 'link');
      setAttachmentUrl('');
    } catch (error) {
      console.error("Failed to add attachment:", error);
    }
  }, [attachmentUrl, card, addAttachment]);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    if (!card) return;
    
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      try {
        await deleteAttachment(card.id, attachmentId);
      } catch (error) {
        console.error("Failed to delete attachment:", error);
      }
    }
  }, [card, deleteAttachment]);

  // Function to render URL embeds
  const renderAttachmentEmbed = useCallback((url: string) => {
    try {
      const parsedUrl = new URL(url);
      
      // YouTube embed
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        const videoId = parsedUrl.hostname.includes('youtube.com') 
          ? parsedUrl.searchParams.get('v')
          : parsedUrl.pathname.substring(1);
          
        if (videoId) {
          return (
            <div className="relative pt-[56.25%] w-full overflow-hidden rounded">
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
      const imageRegex = /\.(jpeg|jpg|gif|png)$/i;
      if (imageRegex.exec(url) !== null) {
        return (
          <Image
            src={url}
            alt="Attachment"
            width={400}
            height={200}
            className="max-w-full rounded h-auto max-h-48 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        );
      }
      
      // Default link preview with favicon
      return (
        <div className="flex items-center p-2 bg-white/5 rounded">
          <Image
            src={`${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 mr-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-xs truncate">{parsedUrl.hostname}</span>
        </div>
      );
    } catch (e) {
      return (
        <div className="text-xs text-red-400">Invalid URL</div>
      );
    }
  }, []);

  // Handle input changes
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, []);

  const handlePriorityChange = useCallback((value: Priority) => {
    setPriority(value);
  }, []);

  const handleAttachmentUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentUrl(e.target.value);
  }, []);

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Overlay with glassmorphism */}
        <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm data-[state=open]:animate-overlayShow z-40" />
        {/* Modal Content */}
        <Dialog.Content
          className="
            fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[90vw] max-w-lg max-h-[90vh] p-6 rounded-lg shadow-xl
            bg-white/10 backdrop-blur-lg border border-white/20
            text-white focus:outline-none z-50
            data-[state=open]:animate-contentShow
          "
        >
          {/* Accessibility title */}
          <Dialog.Title className="sr-only">
            {isNewCard ? 'Create New Card' : `Edit Card: ${card?.title}`}
          </Dialog.Title>
          
          {/* Saving Indicator (optional) */}
          {isSaving && <div className="absolute top-4 left-4 text-xs text-yellow-400 animate-pulse">Saving...</div>}

          {/* Dynamic Content Area */}
          <div className="overflow-y-auto max-h-[calc(90vh-100px)] space-y-6 pr-3">
            {/* Title Field with Validation */}
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="card-title" className="text-xs text-gray-400">Title</Label>
              <Input 
                id="card-title"
                type="text" 
                value={title}
                onChange={handleTitleChange}
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
              <Label htmlFor="card-description" className="text-xs text-gray-400">Description</Label>
              <Textarea 
                id="card-description"
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Add a more detailed description..."
                className="bg-white/5 border-white/20 placeholder:text-gray-400 focus-visible:ring-offset-0 focus-visible:ring-white/50 min-h-[80px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Priority Field */}
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="card-priority" className="text-xs text-gray-400">Priority</Label>
                <Select value={priority} onValueChange={handlePriorityChange as (value: string) => void}>
                  <SelectTrigger id="card-priority" className="w-full bg-white/5 border-white/20 focus:ring-offset-0 focus:ring-white/50">
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
                <Label htmlFor="card-dueDate" className="text-xs text-gray-400">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="card-dueDate"
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
                      selected={dueDate ?? undefined}
                      onSelect={(date) => setDueDate(date)}
                      initialFocus
                      className="[&>div]:bg-transparent [&_button]:bg-transparent [&_button]:border-0"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Labels Display (if present) */}
            {card?.labels && card.labels.length > 0 && (
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

            {/* Assignees Display (if present) */}
            {card?.assignees && card.assignees.length > 0 && (
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

            {/* Attachments Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center text-gray-300">
                <Paperclip className="mr-2 h-4 w-4" /> 
                {isNewCard ? 'Add Attachment Link' : `Attachments (${attachments.length})`}
              </Label>
              
              {/* Add URL Form */}
              <div className="flex items-end gap-2">
                <div className="flex-grow">
                  <Label htmlFor="attachment-url" className="sr-only">URL</Label>
                  <Input 
                    id="attachment-url"
                    value={attachmentUrl}
                    onChange={handleAttachmentUrlChange}
                    placeholder="Paste URL link here"
                    type="url"
                    className="bg-white/5 border-white/20 h-8 text-sm"
                  />
                </div>
                <Button 
                  onClick={handleAddAttachment} 
                  size="sm" 
                  className="h-8"
                  disabled={!attachmentUrl.trim() || isNewCard}
                >
                  <Link className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              
              {/* URL preview */}
              {attachmentUrl.trim() && (
                <div className="mt-2 border border-white/10 rounded-md p-2 bg-black/20">
                  <div className="text-xs text-gray-400 mb-1">URL Preview</div>
                  {renderAttachmentEmbed(attachmentUrl)}
                </div>
              )}
              
              {/* Existing Attachments */}
              {!isNewCard && attachments.length > 0 && (
                <div className="space-y-3 mt-3">
                  {attachments.map((att) => (
                    <div key={att.id} className="border border-white/10 rounded-md overflow-hidden">
                      <div className="flex items-center justify-between bg-white/5 px-3 py-1">
                        <a 
                          href={att.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs hover:underline truncate mr-2 text-blue-300"
                        >
                          {att.name || new URL(att.url).hostname}
                        </a>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-gray-400 hover:text-red-400"
                          onClick={() => handleDeleteAttachment(att.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-2">
                        {renderAttachmentEmbed(att.url)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Save Button */}
          <div className="mt-6 flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="bg-white/5 border-white/20 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!hasChanges || !!titleError || isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
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