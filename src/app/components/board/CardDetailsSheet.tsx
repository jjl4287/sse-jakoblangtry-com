// Add two-column Card Details sheet with right-side slide-in and framer-motion transitions
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, CalendarIcon, Trash2, Edit3Icon, MessageSquareText, History } from 'lucide-react';
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
import type { Card, Priority, Label as LabelType, User as UserType, Comment as CommentType, ActivityLog as ActivityLogType } from '~/types';
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
import { PlusCircleIcon, CheckIcon, XIcon as CloseIconLucide } from 'lucide-react';
import { getContrastingTextColor } from '~/lib/utils';

// Helper function to format activity log entries
const formatActivity = (activity: ActivityLogType): string => {
  const details = activity.details as any; // Cast details to any for easier access, consider defining types for details per actionType later
  switch (activity.actionType) {
    case 'CREATE_CARD':
      return `created this card${details?.title ? ': \"' + details.title + '\"' : ''}.`;
    case 'UPDATE_CARD_TITLE':
      return `updated the title from "${details?.old || ''}" to "${details?.new || ''}".`;
    case 'UPDATE_CARD_DESCRIPTION':
      return `updated the description.`; // Descriptions can be long, so not showing old/new for brevity
    case 'UPDATE_CARD_PRIORITY':
      return `changed the priority from ${details?.old || 'N/A'} to ${details?.new || 'N/A'}.`;
    case 'UPDATE_CARD_DUEDATE':
      const oldDate = details?.old ? format(new Date(details.old), 'MMM d, yyyy') : 'none';
      const newDate = details?.new ? format(new Date(details.new), 'MMM d, yyyy') : 'none';
      if (details?.new && !details?.old) return `set the due date to ${newDate}.`;
      if (!details?.new && details?.old) return `removed the due date (was ${oldDate}).`;
      return `changed the due date from ${oldDate} to ${newDate}.`;
    case 'ADD_LABEL_TO_CARD':
      return `added label "${details?.labelName || details?.labelId || 'Unknown Label'}".`;
    case 'REMOVE_LABEL_FROM_CARD':
      return `removed label "${details?.labelName || details?.labelId || 'Unknown Label'}".`;
    case 'ADD_ASSIGNEE_TO_CARD':
      return `assigned this card to ${details?.assigneeName || details?.assigneeId || 'Unknown User'}.`;
    case 'REMOVE_ASSIGNEE_FROM_CARD':
      return `unassigned ${details?.assigneeName || details?.assigneeId || 'Unknown User'} from this card.`;
    case 'DELETE_CARD':
      return `deleted card "${details?.title || 'Untitled Card'}".`;
    case 'MOVE_CARD':
      return `moved this card from column "${details?.oldColumnName || details?.oldColumnId}" to "${details?.newColumnName || details?.newColumnId}".`;
    // Add more cases as new activity types are logged
    default:
      return `performed an action: ${activity.actionType}.`;
  }
};

interface CardDetailsSheetProps {
  card: Card;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  } = useBoard();
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
  const cardTitleInputRef = useRef<HTMLInputElement>(null);

  // State for Label Picker
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchText, setLabelSearchText] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#cccccc'); // Default color
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);

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

  // Effect for core card data resets (when card prop changes or sheet opens)
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description);
      setPriority(card.priority);
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
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
      setIsSaving(false);
      setIsEditingTitle(false);
      // Close pickers and reset their specific forms/search state
      setIsLabelPickerOpen(false);
      setLabelSearchText('');
      setNewLabelName('');
      setNewLabelColor('#cccccc');
      setShowNewLabelForm(false);
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

  // Effect for fetching comments (when sheet opens for a card or card.id changes)
  useEffect(() => {
    if (isOpen && card.id) {
      setIsLoadingComments(true);
      fetchCommentsForCard(card.id)
        .then(fetchedComments => {
          if (fetchedComments) {
            setComments(fetchedComments);
          }
        })
        .catch(err => {
          console.error(`Failed to fetch comments for card ${card.id}:`, err);
          setComments([]); // Clear comments or show error state
        })
        .finally(() => setIsLoadingComments(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, card.id]); // fetchCommentsForCard is intentionally omitted

  // Effect for fetching activity logs (when sheet opens for a card or card.id changes)
  useEffect(() => {
    if (isOpen && card.id && fetchActivityLogsForCard) {
      // setIsLoadingActivityLogs is handled by the context
      fetchActivityLogsForCard(card.id)
        .catch(err => {
          console.error(`Failed to fetch activity logs for card ${card.id}:`, err);
          // Potentially show an error message to the user
        });
    }
    // fetchActivityLogsForCard is a dependency now
  }, [isOpen, card.id, fetchActivityLogsForCard]);

  // Effect to merge and sort comments and activity logs
  useEffect(() => {
    const mappedComments: FeedItem[] = comments.map(c => ({ ...c, itemType: 'comment' as const }));
    const mappedActivityLogs: FeedItem[] = (rawActivityLogs || []).map(a => ({ ...a, itemType: 'activity' as const }));
    
    const allItems = [...mappedComments, ...mappedActivityLogs];
    
    allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    setCombinedFeedItems(allItems);
  }, [comments, rawActivityLogs]);

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
      setShowNewLabelForm(false);
      setLabelSearchText(''); // Clear search to show the new label
    }
  };
  
  const availableBoardLabels = boardLabels || [];
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

  const boardMembers = useBoard().board?.members || [];
  // Display assignees directly from the card prop, assuming it's populated with UserType[]
  const cardAssigneesToDisplay: UserType[] = card.assignees || [];
  // --- End Assignee Logic ---

  // --- Comment Logic ---
  const handlePostComment = async () => {
    if (!newCommentContent.trim() || !createCommentInCard) return;
    try {
      const createdComment = await createCommentInCard(card.id, newCommentContent.trim());
      if (createdComment) {
        setComments(prevComments => [...prevComments, createdComment]); // Optimistically add to local state
        setNewCommentContent(''); // Clear textarea
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      // Optionally, show an error message to the user
    }
  };
  // --- End Comment Logic ---

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
              className="bg-background fixed inset-y-0 right-0 w-[70%] p-4 flex flex-col shadow-lg z-50 isolate"
            >
              {/* Absolute close button top-right */}
              <SheetClose asChild>
                <button className="absolute top-4 right-4 p-2 rounded hover:bg-muted/10 z-50">
                  <XIcon className="h-5 w-5" />
                </button>
              </SheetClose>
              <SheetHeader className="flex items-center justify-start border-b p-2 w-full">
                <SheetPrimitive.Title className="sr-only">
                  {title || 'Card Details'} 
                </SheetPrimitive.Title>
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
                  className="text-2xl font-bold w-full text-left bg-transparent"
                  ref={cardTitleInputRef}
                  // inputProps={{
                  //   autoFocus: false,
                  //   className: "bg-transparent"
                  // }}
                />
              </SheetHeader>

              <div className="flex-1 overflow-auto mt-4 grid grid-cols-3 gap-6">
                {/* Left pane */}
                <div className="col-span-2 space-y-4">
                  {/* Description: inline editable */}
                  {isEditingDescription ? (
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      onBlur={() => { setIsEditingDescription(false); void handleDescriptionBlur(); }}
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
                    <h3 className="text-lg font-semibold mb-3 flex items-center">
                      <MessageSquareText className="h-5 w-5 mr-2" />
                      Activity & Comments
                    </h3>
                    {/* Combined Feed List */}
                    <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                      {(isLoadingComments || isLoadingActivityLogs) && <p className="text-xs text-muted-foreground">Loading feed...</p>}
                      {!(isLoadingComments || isLoadingActivityLogs) && combinedFeedItems.length === 0 && <p className="text-xs text-muted-foreground">No activity or comments yet.</p>}
                      {combinedFeedItems.map((item) => {
                        if (item.itemType === 'comment') {
                          const comment = item; // item is a CommentType
                          return (
                            <div key={`comment-${comment.id}`} className="flex items-start space-x-3">
                              {comment.user?.image ? (
                                <img src={comment.user.image} alt={comment.user.name || 'User avatar'} className="w-8 h-8 rounded-full" />
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                  {(comment.user?.name || comment.user?.email || 'U').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-semibold text-sm text-foreground">{comment.user?.name || comment.user?.email}</span>
                                  <span className="text-xs text-muted-foreground">
                                    commented {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                              </div>
                            </div>
                          );
                        } else if (item.itemType === 'activity') {
                          const activity = item; // item is an ActivityLogType
                          // Basic display for activity, to be enhanced with a formatter function
                          return (
                            <div key={`activity-${activity.id}`} className="flex items-start space-x-3 text-xs">
                               {activity.user?.image ? (
                                <img src={activity.user.image} alt={activity.user.name || 'User avatar'} className="w-6 h-6 rounded-full" />
                              ) : (
                                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                                  {(activity.user?.name || activity.user?.email || 'S').substring(0, 1).toUpperCase()}
                                </span>
                              )}
                              <div className="flex-1 pt-1">
                                <span className="font-semibold text-muted-foreground">{activity.user?.name || activity.user?.email || 'System'}</span>
                                <span className="text-muted-foreground"> {formatActivity(activity)} </span>
                                <span className="text-muted-foreground/80 ml-1">
                                  ({format(new Date(activity.createdAt), 'MMM d, h:mm a')})
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {/* New Comment Input */}
                    <div className="mt-auto border-t pt-4">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newCommentContent}
                        onChange={(e) => setNewCommentContent(e.target.value)}
                        rows={3}
                        className="mb-2"
                      />
                      <Button onClick={handlePostComment} disabled={!newCommentContent.trim()}>
                        Comment
                      </Button>
                    </div>
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
                      <PopoverContent portalled={false} className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={date => {
                            const d = date ?? undefined;
                            setDueDate(d);
                            setCalendarOpen(false);
                            void updateCard(card.id, { dueDate: d });
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Labels Section */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex justify-between items-center">
                      Labels
                      <div className="flex items-center">
                        <Popover open={isLabelPickerOpen} onOpenChange={setIsLabelPickerOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" title="Add label to card">
                              <PlusCircleIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent portalled={false} 
                            className="w-[250px] p-0" 
                            align="start"
                            onPointerDownOutside={(event) => {
                              // Prevent closing if the click is on the trigger button itself
                              // This can happen if the trigger is part of what's considered "outside"
                              const target = event.target as HTMLElement;
                              if (target.closest('[aria-controls="radix-"]')) { // Heuristic for trigger
                                event.preventDefault();
                              }
                            }}
                          >
                            <Command>
                              <CommandInput 
                                placeholder="Search or create label..." 
                                value={labelSearchText}
                                onValueChange={setLabelSearchText}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {showNewLabelForm ? '' : (labelSearchText.length > 0 ? 'No labels found.' : 'Type to search or create.')}
                                </CommandEmpty>
                                <CommandGroup>
                                  {availableBoardLabels
                                    .filter(label => label.name.toLowerCase().includes(labelSearchText.toLowerCase()))
                                    .map((label) => (
                                      <CommandItem
                                        key={label.id}
                                        value={label.name}
                                        onSelect={() => {
                                          handleToggleLabel(label.id);
                                          // Consider closing popover or not based on UX preference
                                          // setIsLabelPickerOpen(false);
                                        }}
                                        className="flex justify-between items-center"
                                      >
                                        <span style={{ backgroundColor: label.color }} className="inline-block w-3 h-3 rounded-sm mr-2"></span>
                                        {label.name}
                                        {currentCardLabelIds.has(label.id) && <CheckIcon className="h-4 w-4 ml-auto" />}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Popover open={isManageLabelsOpen} onOpenChange={setIsManageLabelsOpen} modal={true}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="ml-2" title="Manage board labels">
                              Manage
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent portalled={false} className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Filter labels..." /> {/* Basic filter, can be enhanced later */}
                              <CommandList>
                                <CommandEmpty>No labels found.</CommandEmpty>
                                <CommandGroup heading="Board Labels">
                                  {availableBoardLabels.map((label) => (
                                    <CommandItem
                                      key={label.id}
                                      className="flex justify-between items-center"
                                      onSelect={() => {
                                        // Future: clicking could select for edit
                                        setEditingLabel(label);
                                        setNewBoardLabelName(label.name); // Pre-fill for editing
                                        setNewBoardLabelColor(label.color); // Pre-fill for editing
                                      }}
                                    >
                                      <div className="flex items-center">
                                        <span style={{ backgroundColor: label.color }} className="inline-block w-3 h-3 rounded-sm mr-2"></span>
                                        {label.name}
                                      </div>
                                      {/* Placeholder for Edit/Delete buttons */}
                                      <div className="flex items-center">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit label" onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setEditingLabel(label); 
                                          setNewBoardLabelName(label.name); 
                                          setNewBoardLabelColor(label.color);
                                        }}>
                                          <Edit3Icon className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" title="Delete label" onClick={async (e) => { 
                                          e.stopPropagation(); 
                                          if (window.confirm(`Are you sure you want to delete label "${label.name}"? This will remove it from all cards.`)) {
                                            await deleteBoardLabel(label.id);
                                            // If this was the label being edited, reset the edit form
                                            if (editingLabel?.id === label.id) {
                                              setEditingLabel(null);
                                              setNewBoardLabelName('');
                                              setNewBoardLabelColor('#4287f5');
                                            }
                                          }
                                        }}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                                <CommandSeparator />
                                <CommandGroup heading={editingLabel ? "Edit Label" : "Create New Label"}>
                                  <div className="p-2 space-y-2">
                                    <Input 
                                      type="text" 
                                      placeholder="Label name" 
                                      value={editingLabel ? newBoardLabelName : newBoardLabelName} // Use newBoardLabelName for both create and edit flows for now
                                      onChange={(e) => setNewBoardLabelName(e.target.value)}
                                      className="h-8"
                                    />
                                    <div className="flex items-center space-x-2">
                                      <Input 
                                        type="color" 
                                        value={editingLabel ? newBoardLabelColor : newBoardLabelColor} // Use newBoardLabelColor for both
                                        onChange={(e) => setNewBoardLabelColor(e.target.value)}
                                        className="h-8 w-14 p-1"
                                      />
                                      <Button 
                                        onClick={async () => {
                                          if (editingLabel) {
                                            if (newBoardLabelName.trim() && newBoardLabelColor) {
                                              await updateBoardLabel(editingLabel.id, newBoardLabelName.trim(), newBoardLabelColor);
                                              setEditingLabel(null); // Reset after edit
                                            }
                                          } else {
                                            if (newBoardLabelName.trim() && newBoardLabelColor) {
                                              await createBoardLabel(newBoardLabelName.trim(), newBoardLabelColor);
                                            }
                                          }
                                          setNewBoardLabelName(''); // Reset form
                                          setNewBoardLabelColor('#4287f5');
                                        }}
                                        size="sm" 
                                        className="flex-1 h-8"
                                        disabled={!newBoardLabelName.trim()}
                                      >
                                        {editingLabel ? 'Save Changes' : 'Create Label'}
                                      </Button>
                                      {editingLabel && (
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingLabel(null); setNewBoardLabelName(''); setNewBoardLabelColor('#4287f5'); }} className="h-8">Cancel Edit</Button>
                                      )}
                                    </div>
                                  </div>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </h3>
                    <div className="flex flex-wrap gap-1 min-h-[20px]">
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

                  {/* Assignees Section */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-sm">Assignees</h4>
                      <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen} modal={true}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="p-1 h-auto">
                            <PlusCircleIcon className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent portalled={false} 
                          className="w-[250px] p-0" 
                          align="start"
                          onPointerDownOutside={(event) => {
                            const target = event.target as HTMLElement;
                            if (target.closest('[aria-controls="radix-"]')) { // Heuristic for trigger
                              event.preventDefault();
                            }
                          }}
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
                                      member.user.name?.toLowerCase().includes(assigneeSearchText.toLowerCase()) ||
                                      member.user.email?.toLowerCase().includes(assigneeSearchText.toLowerCase())
                                      )
                                  )
                                  .map((member) => (
                                    <CommandItem
                                      key={member.user.id}
                                      value={member.user.name || member.user.email || member.user.id} // Value for search/filter
                                      onSelect={() => handleToggleAssignee(member.user.id)}
                                      className="cursor-pointer flex justify-between items-center"
                                    >
                                      <div className="flex items-center">
                                        {member.user.image ? (
                                          <img src={member.user.image} alt={member.user.name || member.user.email || 'User avatar'} className="w-6 h-6 rounded-full mr-2" />
                                        ) : (
                                          <span className="w-6 h-6 rounded-full mr-2 bg-muted flex items-center justify-center text-xs">
                                            {(member.user.name || member.user.email || 'U').substring(0, 2).toUpperCase()}
                                          </span>
                                        )}
                                        {member.user.name || member.user.email}
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
                    {cardAssigneesToDisplay.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cardAssigneesToDisplay.map((assignee) => (
                          <Badge key={assignee.id} variant="secondary" className="flex items-center gap-1 pr-1">
                            {assignee.image ? (
                              <img src={assignee.image} alt={assignee.name || assignee.email || 'User avatar'} className="w-4 h-4 rounded-full" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-xs">
                                {(assignee.name || assignee.email || 'U').substring(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className="ml-1">{assignee.name || assignee.email}</span>
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