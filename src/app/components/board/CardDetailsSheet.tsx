/* eslint-disable */
// The rest of the file's linting is disabled for now

// Add two-column Card Details sheet with right-side slide-in and framer-motion transitions
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, CalendarIcon, Trash2, Edit3Icon, MessageSquareText, History, Type, CheckSquare, CircleSlash, ArrowUp, ArrowDown, ArrowRight, Weight, Paperclip, PlusCircleIcon, Link2 } from 'lucide-react';
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
import { InlineEdit } from '~/components/ui/InlineEdit';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { useBoard } from '~/services/board-context';
import { cn } from '~/lib/utils';
import type { Card, Priority, Label as LabelType, User as UserType, Comment as CommentType, ActivityLog as ActivityLogType, Attachment as BaseAttachment } from '~/types';
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Badge } from '~/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '~/components/ui/command';
import { CheckIcon, XIcon as CloseIconLucide } from 'lucide-react';
import { getContrastingTextColor } from '~/lib/utils';
import Markdown from '~/components/ui/Markdown';
import MarkdownEditor from '~/components/ui/MarkdownEditor';
import { AttachmentPreview } from './AttachmentPreview';

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
// Helper function to format activity log entries
const formatActivity = (activity: ActivityLogType): string => {
  const details = activity.details; // details may be any JSON from the server
  switch (activity.actionType) {
    case 'CREATE_CARD':
      return `created this card${details?.title ? `: \"${details.title}\"` : ''}.`;
    case 'UPDATE_CARD_TITLE':
      return `updated the title from \"${details.old ?? ''}\" to \"${details.new ?? ''}\".`;
    case 'UPDATE_CARD_DESCRIPTION':
      return `updated the description.`;
    case 'UPDATE_CARD_PRIORITY':
      return `changed the priority from ${details.old ?? 'N/A'} to ${details.new ?? 'N/A'}.`;
    case 'UPDATE_CARD_DUEDATE':
      const oldDate = details.old ? format(new Date(details.old), 'MMM d, yyyy') : 'none';
      const newDate = details.new ? format(new Date(details.new), 'MMM d, yyyy') : 'none';
      if (details?.new && !details?.old) return `set the due date to ${newDate}.`;
      if (!details?.new && details?.old) return `removed the due date (was ${oldDate}).`;
      return `changed the due date from ${oldDate} to ${newDate}.`;
    case 'ADD_LABEL_TO_CARD':
      return `added label \"${details.labelName ?? details.labelId ?? 'Unknown Label'}\".`;
    case 'REMOVE_LABEL_FROM_CARD':
      return `removed label \"${details.labelName ?? details.labelId ?? 'Unknown Label'}\".`;
    case 'ADD_ASSIGNEE_TO_CARD':
      return `assigned this card to ${details.assigneeName ?? details.assigneeId ?? 'Unknown User'}.`;
    case 'REMOVE_ASSIGNEE_FROM_CARD':
      return `unassigned ${details.assigneeName ?? details.assigneeId ?? 'Unknown User'} from this card.`;
    case 'DELETE_CARD':
      return `deleted card \"${details.title ?? 'Untitled Card'}\".`;
    case 'MOVE_CARD':
      return `moved this card from column \"${details.oldColumnName ?? details.oldColumnId}\" to \"${details.newColumnName ?? details.newColumnId}\".`;
    default:
      return `performed an action: ${activity.actionType}.`;
  }
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/prefer-nullish-coalescing */

interface CardDetailsSheetProps {
  card: Card;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

// Base type for attachments from the server
// interface BaseAttachment defined in ~/types

// Type for attachments that are being optimistically added to the UI
interface OptimisticUIAttachment extends BaseAttachment {
  cardId: string; // Useful for optimistic operations
  isOptimistic: true;
}

// Type for attachments that are confirmed and from the server (for rendering)
interface ConfirmedUIAttachment extends BaseAttachment {
  isOptimistic: false;
}

// Union type for what's rendered in the list
type DisplayAttachment = OptimisticUIAttachment | ConfirmedUIAttachment;

export const CardDetailsSheet: React.FC<CardDetailsSheetProps> = ({ card, isOpen, onOpenChange }) => {
  const {
    updateCard,
    addAttachment,
    deleteAttachment,
    boardLabels,
    createBoardLabel,
    deleteBoardLabel,
    updateBoardLabel,
    fetchCommentsForCard,
    createCommentInCard,
    activityLogs: rawActivityLogs,
    isLoadingActivityLogs,
    fetchActivityLogsForCard,
    board,
  } = useBoard();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [priority, setPriority] = useState<Priority>(card.priority || 'medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(card.dueDate ? new Date(card.dueDate) : undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weight, setWeight] = useState<number | undefined>(card.weight);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('');
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isSavingAttachment, setIsSavingAttachment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticAttachments, setOptimisticAttachments] = useState<OptimisticUIAttachment[]>([]);
  const cardTitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for Label Picker
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchText, setLabelSearchText] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#cccccc'); // Default color
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);
  // Add a view state to toggle between list and create views
  const [labelPickerView, setLabelPickerView] = useState<'list' | 'create'>('list');

  // Derived state for current card's labels (IDs)
  const [currentCardLabelIds, setCurrentCardLabelIds] = useState<Set<string>>(() => new Set(card.labels.map(l => l.id)));

  // State for Assignee Picker
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearchText, setAssigneeSearchText] = useState('');
  // Derived state for current card's assignees (IDs)
  const [currentCardAssigneeIds, setCurrentCardAssigneeIds] = useState<Set<string>>(
    () => new Set(card.assignees?.map(a => a.id) || [])
  );

  // State for Label Management Popover
  const [isManageLabelsOpen, setIsManageLabelsOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null); // For editing existing label
  const [newBoardLabelName, setNewBoardLabelName] = useState(''); // For creating new label in manager
  const [newBoardLabelColor, setNewBoardLabelColor] = useState('#4287f5'); // Default color for new labels

  // State for Comments
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // State for combined feed
  type FeedItem = (CommentType & { itemType: 'comment' }) | (ActivityLogType & { itemType: 'activity' });
  const [combinedFeedItems, setCombinedFeedItems] = useState<FeedItem[]>([]);

  // Determine card status (Open/Closed)
  const [isCardClosed, setIsCardClosed] = useState(false);
  useEffect(() => {
    if (board && board.columns && card) {
      const currentColumn = board.columns.find(col => col.id === card.columnId);
      if (currentColumn) {
        const isLastColumn = board.columns[board.columns.length - 1]?.id === currentColumn.id;
        const isClosedColumn = currentColumn.title.toLowerCase().includes('closed');
        setIsCardClosed(isLastColumn || isClosedColumn);
      } else {
        setIsCardClosed(false); // Default to open if column not found
      }
    }
  }, [board, card]);

  // When the card changes while the sheet is open, clear previous comments and feed
  useEffect(() => {
    if (isOpen) {
      setComments([]);
      setCombinedFeedItems([]);
    }
  }, [card.id, isOpen]);

  // Effect for fetching comments
  useEffect(() => {
    if (isOpen && card.id) {
      setIsLoadingComments(true);
      fetchCommentsForCard(card.id)
        .then(fetchedComments => {
          if (fetchedComments) {
            setComments(fetchedComments);
          } else {
            setComments([]);
          }
        })
        .catch(err => {
          console.error(`Failed to fetch comments for card ${card.id}:`, err);
          setComments([]);
        })
        .finally(() => setIsLoadingComments(false));
    }
  }, [isOpen, card.id, fetchCommentsForCard]);

  // Effect for fetching activity logs
  useEffect(() => {
    if (isOpen && card.id && fetchActivityLogsForCard) {
      fetchActivityLogsForCard(card.id);
    }
  }, [isOpen, card.id, fetchActivityLogsForCard]);

  // Effect to merge and sort comments and activity logs
  useEffect(() => {
    const mappedComments: FeedItem[] = comments.map(c => ({ ...c, itemType: 'comment' as const }));
    const mappedActivityLogs: FeedItem[] = (rawActivityLogs || []).map(a => ({ ...a, itemType: 'activity' as const }));
    const allItems = [...mappedComments, ...mappedActivityLogs];
    allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setCombinedFeedItems(allItems);
  }, [comments, rawActivityLogs]);

  // Effect for core card data resets (when card prop changes or sheet opens)
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || '');
      setPriority(card.priority || 'medium');
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
      setWeight(card.weight);
      setCurrentCardLabelIds(new Set(card.labels.map(l => l.id)));
      setCurrentCardAssigneeIds(new Set(card.assignees?.map(a => a.id) || []));
    }
    // Note: Picker open states, new label forms are reset in the next effect focused on isOpen.
  }, [isOpen, card]); // Effect for core card data when card or isOpen changes

  // Effect for sheet open/close (to reset transient UI states)
  useEffect(() => {
    if (isOpen) {
      // Reset states that should be fresh each time sheet opens
      setCalendarOpen(false);
      setAttachmentUrl('');
      setAttachmentLinkUrl('');
      setAttachmentLinkName('');
      setIsSavingAttachment(false);
      setIsSaving(false);
      setIsEditingTitle(false);
      // Close pickers and reset their specific forms/search state
      setIsLabelPickerOpen(false);
      setLabelSearchText('');
      setNewLabelName('');
      setNewLabelColor('#cccccc');
      setShowNewLabelForm(false);
      setLabelPickerView('list'); // Reset to list view
      setIsAssigneePickerOpen(false);
      setAssigneeSearchText('');
      // Reset label management popover states
      setIsManageLabelsOpen(false);
      setEditingLabel(null);
      setNewBoardLabelName('');
      setNewBoardLabelColor('#4287f5');
      // Reset comment input
      setNewCommentContent('');
      // Clear activity logs from local state when sheet opens to ensure fresh fetch for the new card
      // (rawActivityLogs from context will be the source of truth during fetch)
    } else {
      // If sheet is closing for any reason, ensure pickers are also marked as closed
      // and their transient states are reset. This prevents stale state if reopened.
      setIsLabelPickerOpen(false);
      setLabelSearchText('');
      setNewLabelName('');
      setNewLabelColor('#cccccc');
      setShowNewLabelForm(false);
      setLabelPickerView('list'); // Reset to list view
      setIsAssigneePickerOpen(false);
      setAssigneeSearchText('');
      setIsManageLabelsOpen(false);
      setEditingLabel(null);
      setNewBoardLabelName('');
      setNewBoardLabelColor('#4287f5');
      // Clear comments when sheet closes
      setComments([]); 
      // Also clear combined feed when sheet closes
      setCombinedFeedItems([]);
    }
  }, [isOpen]); // Only depends on isOpen

  // Auto-save handler for title
  const handleTitleSave = useCallback(async () => {
    if (title.trim() === '') {
      setTitle(card.title);
      void updateCard(card.id, { title: card.title });
    } else if (title !== card.title) {
      void updateCard(card.id, { title });
    }
  }, [card.id, card.title, title, updateCard]);

  // Auto-save handlers for inline edits
  const handleSaveDescription = async () => {
    if (description !== card.description) {
      await updateCard(card.id, { description: description ?? null });
    }
    setIsEditingDescription(false);
  };

  const handlePriorityChange = useCallback(async (newPriority: Priority) => {
    setPriority(newPriority);
    await updateCard(card.id, { priority: newPriority });
  }, [card.id, updateCard]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    await updateCard(card.id, { title, description, priority, dueDate, weight });
    setIsSaving(false);
    onOpenChange(false);
  }, [card.id, title, description, priority, dueDate, weight, updateCard, onOpenChange]);

  const handleAddAttachment = useCallback(async () => {
    const rawUrl = attachmentUrl.trim();
    if (!rawUrl) return;
    try {
      // Ensure URL has protocol; default to https if missing
      const formattedUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawUrl)
        ? rawUrl
        : `https://${rawUrl}`;
      const url = new URL(formattedUrl);
      const name = url.hostname.replace('www.', '') + url.pathname;
      await addAttachment(card.id, new File([formattedUrl], name, { type: 'text/uri-list' }));
      setAttachmentUrl('');
    } catch (error) {
      console.error('Failed to add attachment:', error);
    }
  }, [attachmentUrl, card.id, addAttachment]);

  const handleFileAttachment = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    try {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await addAttachment(card.id, file);
      }
      // Clear the input so the same file can be selected again
      e.target.value = '';
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  }, [card.id, addAttachment]);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDeleteAttachment = async (attachmentId: string, isOptimistic?: boolean) => {
    if (isOptimistic) {
      setOptimisticAttachments(prev => prev.filter(att => att.id !== attachmentId));
      return;
    }

    // For non-optimistic attachments, proceed with API call
    const originalAttachments = card.attachments || [];
    // Optimistically remove from UI (assuming card.attachments is part of the state or re-renders)
    // This requires that the `card` prop is updated after deletion by the BoardProvider,
    // or that we manually manage a local version of attachments derived from `card.attachments`.
    // For now, we'll rely on the BoardProvider to update `card`.
    // To show immediate effect, one might filter `card.attachments` into a local state,
    // then update that local state.

    try {
      await deleteAttachment(card.id, attachmentId);
      // BoardProvider should refresh and update card.attachments
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      alert("Failed to delete attachment. Please try again.");
      // Revert UI if necessary, though typically a re-fetch/context update handles this.
    }
  };

  const handleToggleLabel = (labelId: string) => {
    const newSelectedIds = new Set(currentCardLabelIds);
    const idsToAdd: string[] = [];
    const idsToRemove: string[] = [];

    if (newSelectedIds.has(labelId)) {
      newSelectedIds.delete(labelId);
      idsToRemove.push(labelId);
    } else {
      newSelectedIds.add(labelId);
      idsToAdd.push(labelId);
    }
    setCurrentCardLabelIds(newSelectedIds);
    void updateCard(card.id, { labelIdsToAdd: idsToAdd, labelIdsToRemove: idsToRemove });
  };

  const handleCreateNewLabel = async () => {
    if (!newLabelName.trim() || !createBoardLabel) return;
    const createdLabel = await createBoardLabel(newLabelName.trim(), newLabelColor);
    if (createdLabel) {
      handleToggleLabel(createdLabel.id); // Automatically add to current card
      setNewLabelName('');
      setNewLabelColor('#cccccc');
      setLabelPickerView('list'); // Switch back to list view after creating
      setLabelSearchText(''); // Clear search to show the new label
    }
  };
  
  const availableBoardLabels = boardLabels ?? [];
  const cardLabelsToDisplay = availableBoardLabels.filter(boardLabel => currentCardLabelIds.has(boardLabel.id));

  // --- Assignee Logic ---
  const handleToggleAssignee = (assigneeId: string) => {
    const newSelectedIds = new Set(currentCardAssigneeIds);
    const idsToAdd: string[] = [];
    const idsToRemove: string[] = [];

    if (newSelectedIds.has(assigneeId)) {
      newSelectedIds.delete(assigneeId);
      idsToRemove.push(assigneeId);
    } else {
      newSelectedIds.add(assigneeId);
      idsToAdd.push(assigneeId);
    }
    setCurrentCardAssigneeIds(newSelectedIds);
    void updateCard(card.id, { assigneeIdsToAdd: idsToAdd, assigneeIdsToRemove: idsToRemove });
  };

  const boardMembers = useBoard().board?.members ?? [];
  // Display assignees directly from the card prop, assuming it's populated with UserType[]
  const cardAssigneesToDisplay: UserType[] = card.assignees ?? [];
  // --- End Assignee Logic ---

  // --- Comment Logic ---
  const handlePostComment = async () => {
    if (!newCommentContent.trim()) return;
    try {
      await createCommentInCard(card.id, newCommentContent);
      setNewCommentContent('');
    } catch (error) {
      console.error('Failed to post comment:', error);
    }
  };
  // --- End Comment Logic ---

  const handleWeightChange = useCallback((value: number | undefined) => {
    setWeight(value);
    void updateCard(card.id, { weight: value });
  }, [card.id, updateCard]);

  const stableRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[handleFileUpload Started]');
    console.log('event.target.files:', event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.log('[handleFileUpload] No file selected or event.target.files is null.');
      return;
    }

    setIsSavingAttachment(true);
    const optimisticId = `optimistic-file-${Date.now()}`;
    const tempOptimisticFileUrl = URL.createObjectURL(file); // Store for matching later
    const newOptimisticAttachment: OptimisticUIAttachment = {
      id: optimisticId,
      cardId: card.id,
      name: file.name,
      url: tempOptimisticFileUrl, 
      type: file.type.startsWith('image/') ? 'image' : 'file',
      createdAt: new Date(),
      isOptimistic: true,
    };
    setOptimisticAttachments(prev => [...prev, newOptimisticAttachment]);

    try {
      const savedAttachment = await addAttachment(card.id, file); // addAttachment from useBoard
      
      if (savedAttachment) {
        // Remove the successfully saved optimistic attachment
        setOptimisticAttachments(prev => prev.filter(att => 
          !(att.isOptimistic && att.url === tempOptimisticFileUrl && att.name === file.name)
        ));
      } else {
        // If addAttachment didn't return anything (e.g. error handled within context but not thrown here)
        // or if it failed silently for some reason, we might still need to remove the optimistic one.
        // However, the catch block should handle explicit failures.
        console.warn('File upload succeeded but no attachment data returned from context.');
         // Fallback: remove based on optimisticId if context didn't return the new attachment
        setOptimisticAttachments(prev => prev.filter(att => att.id !== optimisticId));
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
      setOptimisticAttachments(prev => prev.filter(att => att.id !== optimisticId));
    } finally {
      setIsSavingAttachment(false);
    }
  };

  const handleAddLinkAttachment = async () => {
    if (!(attachmentLinkUrl ?? '').trim()) {
      alert("Please enter a valid URL.");
      return;
    }
    let validUrl: URL;
    try {
      validUrl = new URL(attachmentLinkUrl!);
    } catch (_) {
      alert("Invalid URL format.");
      return;
    }

    setIsSavingAttachment(true);
    const optimisticId = `optimistic-link-${Date.now()}`;
    const linkNameToSave = (attachmentLinkName ?? '').trim() || validUrl.href;
    const linkUrlToSave = validUrl.href;

    const newLinkAttachment: OptimisticUIAttachment = {
      id: optimisticId,
      cardId: card.id,
      name: linkNameToSave,
      url: linkUrlToSave,
      type: 'link',
      createdAt: new Date(),
      isOptimistic: true,
    };

    setOptimisticAttachments(prev => [...prev, newLinkAttachment]);
    const currentLinkUrl = attachmentLinkUrl; // Capture before clearing
    const currentLinkName = attachmentLinkName; // Capture before clearing

    setAttachmentLinkUrl('');
    setAttachmentLinkName('');
    setIsLinkPopoverOpen(false);

    try {
      const savedAttachment = await addAttachment(card.id, {
        url: linkUrlToSave,
        name: linkNameToSave,
        type: 'link',
      });

      if (savedAttachment) {
        // Remove the successfully saved optimistic attachment
        setOptimisticAttachments(prev => prev.filter(att => 
          !(att.isOptimistic && att.url === linkUrlToSave && att.name === linkNameToSave)
        ));
      } else {
        console.warn('Link attachment succeeded but no attachment data returned from context.');
        // Fallback: remove based on optimisticId if context didn't return the new attachment
        setOptimisticAttachments(prev => prev.filter(att => att.id !== optimisticId));
      }

    } catch (error) {
      console.error("Failed to add link attachment:", error);
      alert("Failed to add link. Please try again.");
      setOptimisticAttachments(prev => prev.filter(att => att.id !== optimisticId));
    } finally {
      setIsSavingAttachment(false);
    }
  };

  // Reset optimistic attachments only when the sheet is closed or the fundamental card context changes.
  useEffect(() => {
    if (!isOpen) {
      setOptimisticAttachments([]);
    } else {
      // If card.id changes while sheet is open, clear optimistic items for the *previous* card.
      // Check if any existing optimistic attachments belong to a different card ID.
      const currentCardId = card?.id;
      setOptimisticAttachments(prev => prev.filter(att => att.cardId === currentCardId));
    }
  }, [isOpen, card?.id]); // Depend on card.id for context change detection

  if (!card) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <SheetContent 
            asChild 
            side="right" 
            forceMount
            // Radix Dialog/Sheet manages focus and overlay interaction blocking.
            // We are adding specific handlers to the content div for dnd-kit.
          >
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-background fixed inset-y-0 right-0 w-[70%] flex flex-col shadow-lg z-50 isolate"
              onPointerDownCapture={(e: React.PointerEvent<HTMLDivElement>) => {
                // Only stop propagation for pointer down on sheet background
                if (e.target === e.currentTarget) {
                e.stopPropagation();
                }
              }}
              onKeyDownCapture={(e: React.KeyboardEvent<HTMLDivElement>) => {
                const target = e.target as HTMLElement;
                // Allow Enter to reach the card title input when editing
                if (e.key === 'Enter' && isEditingTitle && target === cardTitleInputRef.current) {
                  return;
                }
                // Stop propagation for Space or Enter elsewhere to prevent DnD activation
                if (e.key === ' ' || e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
            >
              <SheetHeader className="flex-row items-center justify-between border-b">
                <div className="flex items-center gap-3 min-w-0">
                  <InlineEdit
                    value={title}
                    onChange={val => setTitle(val)}
                    isEditing={isEditingTitle}
                    onEditStart={() => {
                      setIsEditingTitle(true);
                      requestAnimationFrame(() => cardTitleInputRef.current?.select());
                    }}
                    onSave={() => {
                      setIsEditingTitle(false);
                      void handleTitleSave();
                    }}
                    onCancel={() => {
                      setIsEditingTitle(false);
                      setTitle(card.title);
                    }}
                    placeholder="Card Title"
                    className="text-xl font-semibold text-left bg-transparent truncate flex-shrink flex-1"
                    ref={cardTitleInputRef}
                  />
                  {isCardClosed ? (
                    <Badge variant="destructive" className="flex-shrink-0">
                      <CircleSlash className="h-3 w-3 mr-1" /> Closed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-500 text-green-500 flex-shrink-0">
                      <CheckSquare className="h-3 w-3 mr-1" /> Open
                    </Badge>
                  )}
                  <SheetTitle className="sr-only">{title ?? 'Card Details'} - {isCardClosed ? 'Closed' : 'Open'}</SheetTitle>
                </div>
                <SheetClose asChild className="flex-shrink-0">
                  <button className="p-1 rounded hover:bg-muted/10">
                    <XIcon className="h-5 w-5" />
                  </button>
                </SheetClose>
              </SheetHeader>
              
              <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
                
                <div className="col-span-2 flex flex-col overflow-hidden p-4">
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-foreground/90">Description</h3>
                      {!isEditingDescription && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingDescription(true)} className="text-sm">
                          <Edit3Icon className="w-4 h-4 mr-1" /> Edit
                        </Button>
                      )}
                    </div>
                    {isEditingDescription ? (
                      <div className="mt-2">
                        <MarkdownEditor
                          value={description ?? ''}
                          onChange={(value) => setDescription(value ?? '')}
                          placeholder="Add a more detailed description..."
                          height={150}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            setDescription(card.description || '');
                            setIsEditingDescription(false);
                          }}>Cancel</Button>
                          <Button size="sm" onClick={handleSaveDescription}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      description ? (
                        <div className="mt-2 text-foreground/80">
                          <Markdown content={description} className="prose-sm" />
                        </div>
                      ) : (
                        <div
                          className="mt-2 text-sm text-muted-foreground italic cursor-pointer hover:text-foreground/70"
                          onClick={() => setIsEditingDescription(true)}
                        >
                          Add a more detailed description...
                        </div>
                      )
                    )}
                    <div className="mt-6 text-sm">
                      <h3 className="text-base font-semibold mb-3 flex items-center text-foreground">
                        <MessageSquareText className="h-5 w-5 mr-2" />
                        Activity & Comments
                      </h3>
                      <div className="space-y-4 mb-6">
                        {(isLoadingComments || isLoadingActivityLogs) && <p className="text-xs text-muted-foreground">Loading feed...</p>}
                        {!(isLoadingComments || isLoadingActivityLogs) && combinedFeedItems.length === 0 && <p className="text-xs text-muted-foreground">No activity or comments yet.</p>}
                        {combinedFeedItems.map((item) => {
                          if (item.itemType === 'comment') {
                            const comment = item;
                            return (
                              <div key={`comment-${comment.id}`} className="flex items-start space-x-3">
                                {comment.user?.image ? (
                                  <img src={comment.user.image} alt={comment.user.name ?? 'User avatar'} className="w-7 h-7 rounded-full mt-1" />
                                ) : (
                                  <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold mt-1">
                                    {(comment.user?.name ?? comment.user?.email ?? 'U').substring(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <div className="flex-1 bg-muted/30 p-3 rounded-lg border border-muted/50">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-semibold text-sm text-foreground">{comment.user?.name ?? comment.user?.email}</span>
                                    <span className="text-xs text-muted-foreground">
                                      commented {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                                    </span>
                                  </div>
                                  <div className="text-sm text-foreground whitespace-pre-wrap">
                                    <Markdown content={comment.content} className="prose-sm" />
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (item.itemType === 'activity') {
                            const activity = item;
                            return (
                              <div key={`activity-${activity.id}`} className="flex items-start space-x-3 text-xs py-1">
                                 {activity.user?.image ? (
                                  <img src={activity.user.image} alt={activity.user.name ?? 'User avatar'} className="w-7 h-7 rounded-full" />
                                ) : (
                                  <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                                    {(activity.user?.name ?? activity.user?.email ?? 'S').substring(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <div className="flex-1 pt-1 text-muted-foreground">
                                  <span className="font-semibold">{activity.user?.name ?? activity.user?.email ?? 'System'}</span>
                                  <span> {formatActivity(activity)} </span>
                                  <span className="opacity-80 ml-1">
                                    ({format(new Date(activity.createdAt), 'MMM d, h:mm a')})
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background flex-shrink-0">
                    <MarkdownEditor
                      className="rounded-b-md"
                      value={newCommentContent}
                      onChange={(value) => setNewCommentContent(value ?? '')}
                      placeholder="Write a comment..."
                      height={120}
                      theme="dark"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button onClick={handlePostComment} disabled={!newCommentContent.trim()} size="sm">
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>

                <div 
                  className="col-span-1 space-y-6 overflow-y-auto p-4"
                  style={{ 
                    overscrollBehavior: 'contain',
                    scrollbarWidth: 'thin',
                    scrollbarGutter: 'stable',
                    msOverflowStyle: 'scrollbar',
                  }}
                >
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Actions</h3>
                    <div className="space-y-2">
                      <Select value={priority} onValueChange={(value) => handlePriorityChange(value as Priority)}>
                        <SelectTrigger className="w-full justify-start text-left font-normal [&>*:last-child]:hidden">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center">
                              <ArrowDown className="h-4 w-4 mr-2 text-green-500" />
                              <span>Low</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center">
                              <ArrowRight className="h-4 w-4 mr-2 text-yellow-500" />
                              <span>Medium</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center">
                              <ArrowUp className="h-4 w-4 mr-2 text-red-500" />
                              <span>High</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="flex items-center w-full justify-start text-left font-normal gap-2 rounded-md border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-3">
                        <Weight className="h-4 w-4 mr-2" />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Weight"
                          value={weight ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWeight(val ? Number(val) : undefined);
                          }}
                          onBlur={() => {
                            if (weight !== card.weight) {
                              void updateCard(card.id, { weight });
                            }
                          }}
                          className="border-0 focus-visible:ring-0 bg-transparent w-full p-0 shadow-none dark:bg-transparent dark:text-foreground"
                          style={{ backgroundColor: 'transparent' }}
                        />
                      </div>

                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                          className={cn(
                              "w-full justify-start text-left font-normal",
                              !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "PPP") : <span>Add due date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent portalled={false} className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                            onSelect={(date) => {
                              setDueDate(date ?? undefined);
                              if (date) {
                                void updateCard(card.id, { dueDate: date });
                              }
                            setCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Combined Attachment Actions Container - MOVED TO THE END OF ACTIONS */}
                    <div className="pt-2 mt-2 border-t"> {/* Visual separator */}
                      <div className="flex flex-col items-start gap-2 mt-2">
                        {/* Attach File Button Block */}
                        <div className="w-full">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              console.log('[Attach File Button Clicked]');
                              console.log('isSavingAttachment:', isSavingAttachment);
                              console.log('fileInputRef.current:', fileInputRef.current);
                              if (fileInputRef.current) {
                                console.log('Calling fileInputRef.current.click()');
                                fileInputRef.current.click();
                                console.log('Called fileInputRef.current.click()');
                              } else {
                                console.error('fileInputRef.current is null or undefined');
                              }
                            }} 
                            disabled={isSavingAttachment} 
                            className="w-full justify-start"
                          >
                            <Paperclip className="mr-2 h-4 w-4" />
                            Attach File
                          </Button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(event) => {
                              console.log('[File Input onChange Triggered]');
                              handleFileUpload(event);
                            }}
                            className="hidden"
                            disabled={isSavingAttachment}
                          />
                        </div>

                        {/* Add Link Popover Block */}
                        <div className="w-full">
                          <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start">
                                <Link2 className="mr-2 h-4 w-4" />
                                Add Link
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent portalled={false} side="bottom" align="start" className="w-[300px] p-4">
                              <Input
                                type="url"
                                placeholder="Add link URL (e.g., https://example.com)"
                                value={attachmentLinkUrl}
                                onChange={(e) => setAttachmentLinkUrl(e.target.value)}
                                disabled={isSavingAttachment}
                                className="w-full mb-2"
                              />
                              <Input
                                type="text"
                                placeholder="Optional: Link name"
                                value={attachmentLinkName}
                                onChange={(e) => setAttachmentLinkName(e.target.value)}
                                disabled={isSavingAttachment}
                                className="w-full mb-2"
                              />
                              <Button
                                onClick={handleAddLinkAttachment} // No need for async here, it's handled inside
                                disabled={isSavingAttachment || !attachmentLinkUrl.trim()}
                                className="w-full"
                              >
                                {isSavingAttachment ? 'Adding...' : 'Add Link'}
                              </Button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                    {/* End Combined Attachment Actions Container */}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-sm font-semibold">Labels</h3>
                      <div className="w-[28px] h-[28px] relative flex-shrink-0 flex items-center justify-center">
                        <Popover open={isLabelPickerOpen} onOpenChange={setIsLabelPickerOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              <PlusCircleIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            portalled={false}
                            className="w-[250px] p-0" 
                            align="end"
                            sideOffset={5}
                          >
                            {labelPickerView === 'list' ? (
                              <div className="flex flex-col">
                                <Command className="overflow-visible">
                                  <CommandInput
                                    placeholder="Search labels..."
                                    value={labelSearchText}
                                    onValueChange={setLabelSearchText}
                                  />
                                  <CommandList className="max-h-[200px]">
                                    <CommandEmpty>
                                      {!labelSearchText && availableBoardLabels.length === 0 && "No labels on this board."}
                                      {labelSearchText && "No labels found."}
                                      {!labelSearchText && availableBoardLabels.length > 0 && "Type to search labels."}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {availableBoardLabels
                                        .filter(
                                          (label) =>
                                            !labelSearchText ||
                                            label.name.toLowerCase().includes(labelSearchText.toLowerCase())
                                        )
                                        .map((label) => (
                                          <CommandItem
                                            key={label.id}
                                            value={label.name}
                                            onSelect={() => handleToggleLabel(label.id)}
                                            className="cursor-pointer flex justify-between items-center"
                                          >
                                            <div className="flex items-center">
                                              <span 
                                                className="w-3 h-3 rounded-full mr-2" 
                                                style={{ backgroundColor: label.color }} 
                                              />
                                              {label.name}
                                            </div>
                                            {currentCardLabelIds.has(label.id) && (
                                              <CheckIcon className="ml-2 h-4 w-4" />
                                            )}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                                {/* Sticky footer with Create button */}
                                <div className="border-t p-2 bg-popover">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full flex items-center justify-center"
                                    onClick={() => {
                                      setLabelPickerView('create');
                                      setNewLabelName('');
                                      setNewLabelColor('#4287f5');
                                    }}
                                  >
                                    <PlusCircleIcon className="h-4 w-4 mr-2" />
                                    Create new label
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-medium">Create new label</h3>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0" 
                                    onClick={() => setLabelPickerView('list')}
                                  >
                                    <XIcon className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="space-y-3">
                                  <Input
                                    placeholder="Label name"
                                    value={newLabelName}
                                    onChange={(e) => setNewLabelName(e.target.value)}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={newLabelColor}
                                      onChange={(e) => setNewLabelColor(e.target.value)}
                                      className="w-10 h-10 rounded cursor-pointer"
                                    />
                                    <Button
                                      className="flex-1"
                                      onClick={handleCreateNewLabel}
                                      disabled={!newLabelName.trim()}
                                    >
                                      Create and Add
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 min-h-[20px] mt-1">
                      {cardLabelsToDisplay.length > 0 ? (
                        cardLabelsToDisplay.map(label => (
                          <Badge key={label.id} variant="outline" className="font-normal" style={{ backgroundColor: label.color, color: getContrastingTextColor(label.color) }}>
                            {label.name}
                            <button onClick={() => handleToggleLabel(label.id)} className="ml-1 opacity-75 hover:opacity-100">
                              <CloseIconLucide className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No labels</p>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-sm">Assignees</h4>
                      <div className="w-[28px] h-[28px] relative flex-shrink-0 flex items-center justify-center">
                        <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                              <PlusCircleIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            portalled={false}
                            className="w-[250px] p-0" 
                            align="end"
                            sideOffset={5}
                          >
                            <Command>
                              <CommandInput
                                placeholder="Search assignees..."
                                value={assigneeSearchText}
                                onValueChange={setAssigneeSearchText}
                              />
                              <CommandList>
                                <CommandEmpty>No assignees found.</CommandEmpty>
                                <CommandGroup>
                                  {boardMembers
                                    .filter(
                                      (member) =>
                                        member.user && (
                                        !assigneeSearchText ||
                                        (member.user.name?.toLowerCase().includes(assigneeSearchText.toLowerCase()) ?? false) ||
                                        (member.user.email?.toLowerCase().includes(assigneeSearchText.toLowerCase()) ?? false)
                                        )
                                    )
                                    .map((member) => (
                                      <CommandItem
                                        key={member.user.id}
                                        value={member.user.name ?? member.user.email ?? member.user.id}
                                        onSelect={() => handleToggleAssignee(member.user.id)}
                                        className="cursor-pointer flex justify-between items-center"
                                      >
                                        <div className="flex items-center">
                                          {member.user.image ? (
                                            <img src={member.user.image} alt={member.user.name ?? member.user.email ?? 'User avatar'} className="w-6 h-6 rounded-full mr-2" />
                                          ) : (
                                            <span className="w-6 h-6 rounded-full mr-2 bg-muted flex items-center justify-center text-xs">
                                              {(member.user.name ?? member.user.email ?? 'U').substring(0, 2).toUpperCase()}
                                            </span>
                                          )}
                                          {member.user.name ?? member.user.email}
                                        </div>
                                        {currentCardAssigneeIds.has(member.user.id) && (
                                          <CheckIcon className="ml-2 h-4 w-4" />
                                        )}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    {cardAssigneesToDisplay.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cardAssigneesToDisplay.map((assignee) => (
                          <Badge key={assignee.id} variant="secondary" className="flex items-center gap-1 pr-1">
                            {assignee.image ? (
                              <img src={assignee.image} alt={assignee.name ?? assignee.email ?? 'User avatar'} className="w-4 h-4 rounded-full" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-xs">
                                {(assignee.name ?? assignee.email ?? 'U').substring(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="ml-1">{assignee.name ?? assignee.email}</span>
                            <button
                              onClick={() => handleToggleAssignee(assignee.id)}
                              className="ml-1 opacity-75 hover:opacity-100 p-0.5 rounded-full hover:bg-muted-foreground/20"
                            >
                              <CloseIconLucide className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No assignees yet.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                      <span>Attachments</span>
                      {isSavingAttachment && <span className="text-xs text-muted-foreground">Processing...</span>}
                    </h3>
                    <div className="space-y-2 mt-1">
                      {(() => {
                        const confirmedAttachments: ConfirmedUIAttachment[] = (card.attachments ?? []).map(att => ({ 
                          ...att, 
                          isOptimistic: false 
                        }));
                        
                        const allDisplayAttachments: DisplayAttachment[] = [...confirmedAttachments, ...optimisticAttachments];
                        
                        if (allDisplayAttachments.length === 0) {
                          return <p className="text-xs text-muted-foreground">No attachments yet.</p>;
                        }

                        const uniqueAttachments = allDisplayAttachments.filter((att, index, self) =>
                          index === self.findIndex(a => {
                            // If both have server IDs, that's the primary key for uniqueness
                            if (!a.isOptimistic && !att.isOptimistic) {
                              return a.id === att.id;
                            }
                            // If one is optimistic and one is not, they might be the same if URLs/names match
                            // This can happen briefly if server data arrives while optimistic one is shown
                            if (a.isOptimistic !== att.isOptimistic) {
                               // A more robust check might involve a temporary correlation ID
                               // For now, if URLs and names match, consider them the same to avoid brief duplication
                               return a.url === att.url && a.name === att.name;
                            }
                            // If both are optimistic, their generated IDs are unique
                            if (a.isOptimistic && att.isOptimistic) {
                                return a.id === att.id;
                            }
                            return a.id === att.id; // Fallback, should be covered by above
                          })
                        );

                        return uniqueAttachments.map((attachment) => (
                          <AttachmentPreview 
                            key={attachment.id} 
                            url={attachment.url}
                            filename={attachment.name}
                            type={attachment.type}
                            onDelete={() => handleDeleteAttachment(attachment.id, attachment.isOptimistic)}
                            isOptimistic={attachment.isOptimistic}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              {/* Invisible reference element for stable popover positioning */}
              <div 
                ref={stableRef} 
                className="fixed bottom-4 right-4 w-0 h-0 pointer-events-none opacity-0"
                aria-hidden="true"
              />
            </motion.div>
          </SheetContent>
        )}
      </AnimatePresence>
    </Sheet>
  );
}; 