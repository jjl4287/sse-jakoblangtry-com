import React, { useMemo, useCallback, useState, memo } from 'react';
import { XIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetClose, SheetTitle } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { CardHeader } from './card/CardHeader';
import { CardDescription } from './card/CardDescription';
import { CardLabels } from './card/CardLabels';
import { CardAssignees } from './card/CardAssignees';
import { CardAttachments } from './card/CardAttachments';
import { CardDueDate } from './card/CardDueDate';
import { CardPriority } from './card/CardPriority';
import { CardWeight } from './card/CardWeight';
import { CardActivity } from './card/CardActivity';
import { CardComments } from './card/CardComments';
import type { Card } from '~/types';
import { useCardComments } from '~/hooks/use-comments';
import { useCardActivity } from '~/hooks/use-activity';
import { useBoardLabels } from '~/hooks/useLabels';
import { useBoardMembers } from '~/hooks/useBoardMembers';
import { useCommentMutations } from '~/hooks/use-comments';
import { useLabelMutations } from '~/hooks/useLabels';
import { toast } from 'react-hot-toast';

interface CardDetailsSheetOptimizedProps {
  card: Card;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardId?: string;
  onUpdateCard: (cardId: string, updates: any) => Promise<void>;
  onAddAttachment: (cardId: string, data: FormData | { url: string; name: string; type: string }) => Promise<void>;
  onDeleteAttachment: (cardId: string, attachmentId: string) => Promise<void>;
}

export const CardDetailsSheetOptimized: React.FC<CardDetailsSheetOptimizedProps> = memo(({ 
  card, 
  isOpen, 
  onOpenChange,
  boardId: propBoardId,
  onUpdateCard,
  onAddAttachment,
  onDeleteAttachment
}) => {
  const boardId = propBoardId || null;
  
  // Only fetch data when sheet is open - with selective caching
  const { comments, loading: isLoadingComments } = useCardComments(isOpen ? card?.id : null);
  const { activityLogs: rawActivityLogs, loading: isLoadingActivityLogs } = useCardActivity(isOpen ? card?.id : null);
  const { labels: boardLabels } = useBoardLabels(boardId);
  const { availableUsers } = useBoardMembers(boardId);
  
  // Hooks for mutations - these will handle their own optimistic updates
  const { createComment } = useCommentMutations();
  const { createLabel } = useLabelMutations();

  // State for new comment
  const [newCommentContent, setNewCommentContent] = useState('');

  // Memoized combined feed items with stable sorting
  const combinedFeedItems = useMemo(() => {
    const activityItems = rawActivityLogs.map(activity => ({ 
      ...activity, 
      itemType: 'activity' as const 
    }));
    const commentItems = comments.map(comment => ({ 
      ...comment, 
      itemType: 'comment' as const 
    }));
    
    return [...activityItems, ...commentItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [rawActivityLogs, comments]);

  // Optimized handlers that use parent callbacks for immediate updates
  const handleUpdateTitle = useCallback(async (cardId: string, title: string) => {
    try {
      await onUpdateCard(cardId, { title });
      toast.success('Title updated');
    } catch (error) {
      console.error('Error updating title:', error);
      toast.error('Failed to update title');
    }
  }, [onUpdateCard]);
  
  const handleUpdateDescription = useCallback(async (cardId: string, description: string) => {
    try {
      await onUpdateCard(cardId, { description });
      toast.success('Description updated');
    } catch (error) {
      console.error('Error updating description:', error);
      toast.error('Failed to update description');
    }
  }, [onUpdateCard]);
  
  const handleUpdateCard = useCallback(async (cardId: string, updates: any) => {
    try {
      await onUpdateCard(cardId, updates);
      toast.success('Card updated');
    } catch (error) {
      console.error('Error updating card:', error);
      toast.error('Failed to update card');
    }
  }, [onUpdateCard]);
  
  const handleToggleLabel = useCallback(async (labelId: string) => {
    try {
      const isCurrentlyAssigned = card.labels.some(l => l.id === labelId);
      if (isCurrentlyAssigned) {
        await onUpdateCard(card.id, { labelIdsToRemove: [labelId] });
      } else {
        await onUpdateCard(card.id, { labelIdsToAdd: [labelId] });
      }
    } catch (error) {
      console.error('Error toggling label:', error);
      toast.error('Failed to update label');
    }
  }, [card.id, card.labels, onUpdateCard]);
  
  const handleCreateLabel = useCallback(async (name: string, color: string) => {
    try {
      if (!boardId) {
        console.error('No board ID available');
        return null;
      }
      const newLabel = await createLabel(boardId, { name, color });
      toast.success('Label created');
      return newLabel;
    } catch (error) {
      console.error('Error creating label:', error);
      toast.error('Failed to create label');
      return null;
    }
  }, [boardId, createLabel]);
  
  const handleToggleAssignee = useCallback(async (assigneeId: string) => {
    try {
      const isCurrentlyAssigned = card.assignees?.some(a => a.id === assigneeId);
      if (isCurrentlyAssigned) {
        await onUpdateCard(card.id, { assigneeIdsToRemove: [assigneeId] });
      } else {
        await onUpdateCard(card.id, { assigneeIdsToAdd: [assigneeId] });
      }
    } catch (error) {
      console.error('Error toggling assignee:', error);
      toast.error('Failed to update assignee');
    }
  }, [card.id, card.assignees, onUpdateCard]);
  
  const handleAddAttachment = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await onAddAttachment(card.id, formData);
      toast.success('Attachment added');
    } catch (error) {
      console.error('Error adding attachment:', error);
      toast.error('Failed to add attachment');
      throw error;
    }
  }, [card.id, onAddAttachment]);
  
  const handleAddAttachmentUrl = useCallback(async (url: string, name: string, type: string) => {
    try {
      await onAddAttachment(card.id, { url, name, type });
      toast.success('Attachment added');
    } catch (error) {
      console.error('Error adding attachment URL:', error);
      toast.error('Failed to add attachment');
      throw error;
    }
  }, [card.id, onAddAttachment]);
  
  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await onDeleteAttachment(card.id, attachmentId);
      toast.success('Attachment deleted');
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Failed to delete attachment');
      throw error;
    }
  }, [card.id, onDeleteAttachment]);

  const handlePostComment = useCallback(async () => {
    if (!newCommentContent.trim()) return;

    try {
      await createComment(card.id, newCommentContent);
      setNewCommentContent('');
      toast.success('Comment added');
      // The createComment hook should handle optimistic updates
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Failed to post comment');
    }
  }, [newCommentContent, card.id, createComment]);

  // Memoized handlers object to prevent recreation
  const handlers = useMemo(() => ({
    handleUpdateTitle,
    handleUpdateDescription,
    handleUpdateCard,
    handleToggleLabel,
    handleCreateLabel,
    handleToggleAssignee,
    handleAddAttachment,
    handleAddAttachmentUrl,
    handleDeleteAttachment
  }), [
    handleUpdateTitle,
    handleUpdateDescription,
    handleUpdateCard,
    handleToggleLabel,
    handleCreateLabel,
    handleToggleAssignee,
    handleAddAttachment,
    handleAddAttachmentUrl,
    handleDeleteAttachment
  ]);

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
                onUpdate={handlers.handleUpdateDescription}
              />

              {/* Attachments */}
              <CardAttachments
                card={card}
                onAddFile={handlers.handleAddAttachment}
                onAddUrl={handlers.handleAddAttachmentUrl}
                onDelete={handlers.handleDeleteAttachment}
              />

              {/* Activity & Comments Feed */}
              <CardActivity
                combinedFeedItems={combinedFeedItems}
                isLoadingComments={isLoadingComments}
                isLoadingActivityLogs={isLoadingActivityLogs}
                newCommentContent={newCommentContent}
                onCommentContentChange={setNewCommentContent}
                onPostComment={handlePostComment}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="col-span-1 border-l p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Labels */}
              <CardLabels
                card={card}
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

              {/* Due Date */}
              <CardDueDate
                card={card}
                onUpdate={handlers.handleUpdateCard}
              />

              {/* Priority */}
              <CardPriority
                card={card}
                onUpdate={handlers.handleUpdateCard}
              />

              {/* Weight */}
              <CardWeight
                card={card}
                onUpdate={handlers.handleUpdateCard}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});

CardDetailsSheetOptimized.displayName = 'CardDetailsSheetOptimized'; 