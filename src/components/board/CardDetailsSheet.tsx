'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { XIcon } from 'lucide-react';
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
import type { Card } from '~/types';

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
}

export const CardDetailsSheet: React.FC<CardDetailsSheetProps> = ({ 
  card, 
  isOpen, 
  onOpenChange,
  boardId: propBoardId
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
        const isCurrentlyAssigned = card.labels.some(l => l.id === labelId);
        if (isCurrentlyAssigned) {
          await updateCard(card.id, { labelIdsToRemove: [labelId] });
        } else {
          await updateCard(card.id, { labelIdsToAdd: [labelId] });
        }
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error toggling label:', error);
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
        const isCurrentlyAssigned = card.assignees?.some(a => a.id === assigneeId);
        if (isCurrentlyAssigned) {
          await updateCard(card.id, { assigneeIdsToRemove: [assigneeId] });
        } else {
          await updateCard(card.id, { assigneeIdsToAdd: [assigneeId] });
        }
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error toggling assignee:', error);
      }
    },
    
    handleAddAttachment: async (file: File) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        await addAttachment(card.id, formData);
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error adding attachment:', error);
        throw error;
      }
    },
    
    handleAddAttachmentUrl: async (url: string, name: string, type: string) => {
      try {
        await addAttachment(card.id, { url, name, type });
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
        // Refetch activity to show update
        await refetchActivity();
      } catch (error) {
        console.error('Error deleting attachment:', error);
        throw error;
      }
    }
  }), [card, updateCard, addAttachment, deleteAttachment, createLabel, boardId, refetchActivity, refetchLabels]);

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

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[70%] flex flex-col shadow-lg"
        data-no-dnd="true"
        onKeyDown={(e) => {
          // Prevent space and enter keys from bubbling up and triggering drag operations
          if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.code === 'Enter') {
            e.stopPropagation();
          }
        }}
      >
        <SheetHeader className="flex-row items-center justify-between border-b p-4">
          <div className="flex-1 min-w-0">
            <CardHeader
              card={card}
              onUpdateTitle={handlers.handleUpdateTitle}
              isCardClosed={false}
            />
          </div>
          <SheetClose asChild className="flex-shrink-0 ml-4">
            <Button variant="ghost" size="sm" className="p-2">
              <XIcon className="h-5 w-5" />
            </Button>
          </SheetClose>
          <SheetTitle className="sr-only">{card.title} - Open</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
          {/* Main Content */}
          <div className="col-span-2 flex flex-col overflow-hidden p-4">
            <div className="flex-1 space-y-6 overflow-y-auto pr-2">
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
            <div className="bg-background flex-shrink-0 pt-4 border-t" data-no-dnd="true">
              <MarkdownEditor
                className="rounded-md"
                value={newCommentContent}
                onChange={(value) => setNewCommentContent(value ?? '')}
                placeholder="Write a comment... (Cmd/Ctrl+Enter to submit)"
                height={120}
                theme="dark"
                onKeyDown={(e) => {
                  // Handle Cmd/Ctrl+Enter to submit comment
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (newCommentContent.trim()) {
                      handlePostComment();
                    }
                  }
                }}
              />
              <div className="mt-3 flex justify-end">
                <Button 
                  onClick={handlePostComment} 
                  disabled={!newCommentContent.trim()} 
                  size="sm"
                >
                  Comment
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-1 space-y-6 overflow-y-auto p-4">
            {/* Labels */}
            <CardLabelManager
              cardId={card.id}
              currentLabels={card.labels}
              availableLabels={boardLabels}
              onToggleLabel={handlers.handleToggleLabel}
              onCreateLabel={handlers.handleCreateLabel}
            />

            {/* Assignees */}
            <CardAssignees
              card={card}
              availableUsers={availableUsers}
              onToggleAssignee={handlers.handleToggleAssignee}
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