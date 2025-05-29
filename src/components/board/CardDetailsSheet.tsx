'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import MarkdownEditor from '~/components/ui/MarkdownEditor';
import { useCardMutations, type CardUpdateInput } from '~/hooks/useCard';
import { useComments as useCardComments, useCommentMutations } from '~/hooks/useComments';
import { useCardActivity } from '~/hooks/useActivity';
import { useBoardLabels, useLabelMutations } from '~/hooks/useLabels';
import { useBoardMembers } from '~/hooks/useBoardMembers';
import type { Card, Label, User } from '~/types';

// Import the new components
import { CardHeader } from '~/components/card/CardHeader';
import { CardDescription } from '~/components/card/CardDescription';
import { CardLabelManager } from '~/components/card/CardLabelManager';
import { CardAssignees } from '~/components/card/CardAssignees';
import { CardActions } from '~/components/card/CardActions';
import { CardAttachments } from '~/components/card/CardAttachments';
import { CardActivityFeed } from '~/components/card/CardActivityFeed';

interface CardDetailsSheetProps {
  card: Card;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardId?: string;
  onCardUpdate?: (updatedCard: Card) => void;  // Callback to update parent's card state
}

export const CardDetailsSheet: React.FC<CardDetailsSheetProps> = ({ 
  card, 
  isOpen, 
  onOpenChange,
  boardId: propBoardId,
  onCardUpdate
}) => {
  const { updateCard, addAttachment, deleteAttachment } = useCardMutations();
  
  // Use the provided boardId prop (fallback to null if not provided)
  const boardId = propBoardId || null;
  
  // Real hooks for fetching data
  const { comments, loading: isLoadingComments, refetch: refetchComments } = useCardComments(isOpen ? card?.id : null);
  const { activityLogs: rawActivityLogs, loading: isLoadingActivityLogs, refetch: refetchActivity } = useCardActivity(isOpen ? card?.id : null);
  const { labels: boardLabels, refetch: refetchLabels } = useBoardLabels(boardId);
  const { availableUsers } = useBoardMembers(boardId);
  
  // Hooks for mutations
  const { createComment } = useCommentMutations();
  const { createLabel } = useLabelMutations();

  // State for new comment
  const [newCommentContent, setNewCommentContent] = useState('');

  // Optimistic UI state for labels and assignees
  const [optimisticLabels, setOptimisticLabels] = useState<Label[]>(card.labels);
  const [optimisticAssignees, setOptimisticAssignees] = useState<User[]>(card.assignees || []);
  const [pendingLabelChanges, setPendingLabelChanges] = useState<Set<string>>(new Set());
  const [pendingAssigneeChanges, setPendingAssigneeChanges] = useState<Set<string>>(new Set());

  // Sync optimistic state when card prop changes
  useEffect(() => {
    setOptimisticLabels(card.labels);
    setOptimisticAssignees(card.assignees || []);
  }, [card.labels, card.assignees]);

  // Add/remove global class to prevent card dragging when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add('card-details-sheet-open');
    } else {
      document.documentElement.classList.remove('card-details-sheet-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.documentElement.classList.remove('card-details-sheet-open');
    };
  }, [isOpen]);

  // Memoize combined feed items
  const combinedFeedItems = useMemo(() => {
    const activityItems = (rawActivityLogs || []).map(activity => ({ 
      ...activity, 
      itemType: 'activity' as const 
    }));
    const commentItems = (comments || []).map(comment => ({ 
      ...comment, 
      itemType: 'comment' as const 
    }));
    
    return [...activityItems, ...commentItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rawActivityLogs, comments]);

  // Memoized handlers to prevent re-creation
  const handlers = useMemo(() => ({
    handleUpdateTitle: async (cardId: string, title: string) => {
      try {
        await updateCard(cardId, { title });
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error updating title:', error);
      }
    },
    
    handleUpdateDescription: async (cardId: string, description: string) => {
      try {
        await updateCard(cardId, { description });
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error updating description:', error);
      }
    },
    
    handleUpdateCard: async (cardId: string, updates: CardUpdateInput) => {
      try {
        await updateCard(cardId, updates);
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error updating card:', error);
      }
    },
    
    handleToggleLabel: async (labelId: string) => {
      try {
        const label = boardLabels.find(l => l.id === labelId);
        if (!label) return;

        const isCurrentlyAssigned = optimisticLabels.some(l => l.id === labelId);
        
        // Optimistic update
        setPendingLabelChanges(prev => new Set(prev).add(labelId));
        
        if (isCurrentlyAssigned) {
          // Remove label optimistically
          setOptimisticLabels(prev => prev.filter(l => l.id !== labelId));
          
          // Update parent card state if callback provided
          if (onCardUpdate) {
            onCardUpdate({
              ...card,
              labels: optimisticLabels.filter(l => l.id !== labelId)
            });
          }
          
          // API call in background
          await updateCard(card.id, { labelIdsToRemove: [labelId] });
        } else {
          // Add label optimistically  
          setOptimisticLabels(prev => [...prev, label]);
          
          // Update parent card state if callback provided
          if (onCardUpdate) {
            onCardUpdate({
              ...card,
              labels: [...optimisticLabels, label]
            });
          }
          
          // API call in background
          await updateCard(card.id, { labelIdsToAdd: [labelId] });
        }
        
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error toggling label:', error);
        
        // Revert optimistic update on error
        setOptimisticLabels(card.labels);
        if (onCardUpdate) {
          onCardUpdate(card);
        }
      } finally {
        // Remove from pending changes
        setPendingLabelChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(labelId);
          return newSet;
        });
      }
    },
    
    handleCreateLabel: async (name: string, color: string) => {
      try {
        if (!boardId) {
          console.error('No board ID available');
          return null;
        }
        const newLabel = await createLabel(boardId, { name, color });
        // Refetch labels to show new label
        await refetchLabels();
        return newLabel;
      } catch (error) {
        console.error('Error creating label:', error);
        return null;
      }
    },
    
    handleToggleAssignee: async (assigneeId: string) => {
      try {
        const user = availableUsers.find(u => u.id === assigneeId);
        if (!user) return;

        const isCurrentlyAssigned = optimisticAssignees.some(a => a.id === assigneeId);
        
        // Optimistic update
        setPendingAssigneeChanges(prev => new Set(prev).add(assigneeId));
        
        if (isCurrentlyAssigned) {
          // Remove assignee optimistically
          setOptimisticAssignees(prev => prev.filter(a => a.id !== assigneeId));
          
          // Update parent card state if callback provided
          if (onCardUpdate) {
            onCardUpdate({
              ...card,
              assignees: optimisticAssignees.filter(a => a.id !== assigneeId)
            });
          }
          
          // API call in background
          await updateCard(card.id, { assigneeIdsToRemove: [assigneeId] });
        } else {
          // Add assignee optimistically
          setOptimisticAssignees(prev => [...prev, user]);
          
          // Update parent card state if callback provided
          if (onCardUpdate) {
            onCardUpdate({
              ...card,
              assignees: [...optimisticAssignees, user]
            });
          }
          
          // API call in background
          await updateCard(card.id, { assigneeIdsToAdd: [assigneeId] });
        }
        
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error toggling assignee:', error);
        
        // Revert optimistic update on error
        setOptimisticAssignees(card.assignees || []);
        if (onCardUpdate) {
          onCardUpdate(card);
        }
      } finally {
        // Remove from pending changes
        setPendingAssigneeChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(assigneeId);
          return newSet;
        });
      }
    },
    
    handleAddAttachment: async (file: File) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const newAttachment = await addAttachment(card.id, formData);
        
        // Update local card state with new attachment
        if (onCardUpdate && newAttachment) {
          const updatedCard = {
            ...card,
            attachments: [...card.attachments, newAttachment]
          };
          onCardUpdate(updatedCard);
        }
        
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error adding attachment:', error);
        throw error;
      }
    },
    
    handleAddAttachmentUrl: async (url: string, name: string, type: string) => {
      try {
        const newAttachment = await addAttachment(card.id, { url, name, type });
        
        // Update local card state with new attachment
        if (onCardUpdate && newAttachment) {
          const updatedCard = {
            ...card,
            attachments: [...card.attachments, newAttachment]
          };
          onCardUpdate(updatedCard);
        }
        
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error adding attachment URL:', error);
        throw error;
      }
    },
    
    handleDeleteAttachment: async (attachmentId: string) => {
      try {
        await deleteAttachment(card.id, attachmentId);
        
        // Update local card state by removing the attachment
        if (onCardUpdate) {
          const updatedCard = {
            ...card,
            attachments: card.attachments.filter(att => att.id !== attachmentId)
          };
          onCardUpdate(updatedCard);
        }
        
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error deleting attachment:', error);
        throw error;
      }
    }
  }), [card, updateCard, addAttachment, deleteAttachment, createLabel, boardId, refetchActivity, refetchLabels, optimisticLabels, optimisticAssignees, boardLabels, availableUsers, onCardUpdate]);

  const handlePostComment = useCallback(async () => {
    if (!newCommentContent.trim()) return;

    try {
      await createComment(card.id, newCommentContent);
      setNewCommentContent('');
      // Refresh comments and activity after posting
      await refetchComments();
      await refetchActivity();
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  }, [newCommentContent, card.id, createComment, refetchComments, refetchActivity]);

  if (!card) return null;

  // Create optimistic card object for components
  const optimisticCard: Card = {
    ...card,
    labels: optimisticLabels,
    assignees: optimisticAssignees
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[80%] max-w-5xl flex flex-col shadow-2xl card-details-sheet-rounded"
        data-no-dnd="true"
        onKeyDown={(e) => {
          // Prevent space and enter keys from bubbling up and triggering drag operations
          if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.code === 'Enter') {
            e.stopPropagation();
          }
        }}
      >
        <SheetHeader className="flex-row items-center justify-between border-b px-6 py-4">
          <div className="flex-1 min-w-0 max-w-[80%]">
            <CardHeader
              card={card}
              onUpdateTitle={handlers.handleUpdateTitle}
              isCardClosed={false}
            />
          </div>
          <SheetClose asChild className="flex-shrink-0 ml-6">
            <Button variant="ghost" size="sm" className="p-2">
              <XIcon className="h-6 w-6" />
            </Button>
          </SheetClose>
          <SheetTitle className="sr-only">{card.title} - Open</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 grid grid-cols-5 gap-6 overflow-hidden">
          {/* Main Content */}
          <div className="col-span-3 flex flex-col overflow-hidden px-6 py-4">
            <div className="flex-1 space-y-6 overflow-y-auto pr-3" style={{ lineHeight: '1.6' }}>
              {/* Description */}
              <CardDescription
                card={card}
                onUpdateDescription={handlers.handleUpdateDescription}
              />

              {/* Activity Feed */}
              <CardActivityFeed
                cardId={card.id}
                isLoadingComments={isLoadingComments}
                isLoadingActivityLogs={isLoadingActivityLogs}
                combinedFeedItems={combinedFeedItems}
              />
            </div>
            
            {/* Comment Input */}
            <div className="bg-background/80 backdrop-blur-sm flex-shrink-0 pt-6 border-t border-border/50" data-no-dnd="true">
              <div className="space-y-4">
                <MarkdownEditor
                  value={newCommentContent}
                  onChange={(value) => setNewCommentContent(value ?? '')}
                  placeholder="Leave a comment..."
                  height={120}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (newCommentContent.trim()) {
                        handlePostComment();
                      }
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground/75 flex items-center">
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted/60 border border-border/50 rounded shadow-sm">⌘</kbd>
                    <span className="mx-1.5">+</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-muted/60 border border-border/50 rounded shadow-sm">↵</kbd>
                    <span className="ml-2">to submit</span>
                  </div>
                  <Button 
                    onClick={handlePostComment} 
                    disabled={!newCommentContent.trim()} 
                    size="sm"
                    className="px-6 py-2 transition-all duration-200 hover:scale-105 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Comment
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-2 space-y-5 overflow-y-auto px-6 py-4 border-l border-border/50">
            {/* Labels */}
            <CardLabelManager
              cardId={card.id}
              currentLabels={optimisticLabels}
              availableLabels={boardLabels}
              onToggleLabel={handlers.handleToggleLabel}
              onCreateLabel={handlers.handleCreateLabel}
              pendingLabelChanges={pendingLabelChanges}
            />

            {/* Assignees */}
            <CardAssignees
              card={optimisticCard}
              availableUsers={availableUsers}
              onToggleAssignee={handlers.handleToggleAssignee}
              pendingAssigneeChanges={pendingAssigneeChanges}
            />

            {/* Actions (Priority, Due Date, Weight) */}
            <CardActions
              card={card}
              onUpdateCard={handlers.handleUpdateCard}
            />

            {/* Attachments */}
            <CardAttachments
              card={card}
              onAddAttachment={handlers.handleAddAttachment}
              onAddAttachmentUrl={handlers.handleAddAttachmentUrl}
              onDeleteAttachment={handlers.handleDeleteAttachment}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}; 