'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { localStorageService } from '~/lib/services/local-storage-service';
import type { Comment } from '~/types';

// HTTP client functions for API calls
async function fetchComments(cardId: string): Promise<Comment[]> {
  const response = await fetch(`/api/cards/${cardId}/comments`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch comments: ${response.statusText}`);
  }

  return response.json();
}

async function createCommentAPI(cardId: string, content: string): Promise<Comment> {
  const response = await fetch(`/api/cards/${cardId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.statusText}`);
  }

  return response.json();
}

async function updateCommentAPI(cardId: string, commentId: string, content: string): Promise<Comment> {
  const response = await fetch(`/api/cards/${cardId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update comment: ${response.statusText}`);
  }

  return response.json();
}

async function deleteCommentAPI(commentId: string): Promise<void> {
  const response = await fetch(`/api/comments/${commentId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete comment: ${response.statusText}`);
  }
}

// Check if a card belongs to a local board
function isLocalCard(cardId: string): boolean {
  // Try to find the card in any local board
  const localBoards = localStorageService.getLocalBoards();
  return localBoards.some(board =>
    board.columns.some(column =>
      column.cards.some(card => card.id === cardId)
    )
  );
}

// Hook return types
interface UseCommentsResult {
  comments: Comment[];
  loading: boolean;
  error: Error | null;
  refreshComments: () => Promise<void>;
  refetch: () => Promise<void>;
}

// Hooks
export function useComments(cardId?: string): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshComments = useCallback(async () => {
    if (!cardId) {
      setComments([]);
      setLoading(false);
      return;
    }

    // Check if this is a local card
    if (isLocalCard(cardId)) {
      console.log('Skipping comment fetch for local card:', cardId);
      setComments([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const commentsData = await fetchComments(cardId);
      setComments(commentsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load comments'));
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  // Alias for backward compatibility
  const refetch = refreshComments;

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  return {
    comments,
    loading,
    error,
    refreshComments,
    refetch,
  };
}

interface UseCommentMutationsResult {
  createComment: (cardId: string, content: string) => Promise<Comment | null>;
  updateComment: (cardId: string, commentId: string, content: string) => Promise<Comment | null>;
  deleteComment: (commentId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function useCommentMutations(): UseCommentMutationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();

  const createComment = useCallback(async (cardId: string, content: string): Promise<Comment | null> => {
    // Check if this is a local card
    if (isLocalCard(cardId)) {
      toast.error('Comments are not supported for local boards yet');
      return null;
    }

    if (!session?.user?.id) {
      toast.error('You must be logged in to add comments');
      return null;
    }

    setIsLoading(true);
    try {
      const comment = await createCommentAPI(cardId, content);
      toast.success('Comment added successfully');
      return comment;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add comment';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const updateComment = useCallback(async (cardId: string, commentId: string, content: string): Promise<Comment | null> => {
    // Check if this is a local card
    if (isLocalCard(cardId)) {
      toast.error('Comment editing is not supported for local boards yet');
      return null;
    }

    if (!session?.user?.id) {
      toast.error('You must be logged in to edit comments');
      return null;
    }

    setIsLoading(true);
    try {
      const comment = await updateCommentAPI(cardId, commentId, content);
      // Don't show toast for checkbox interactions to avoid spam
      if (!content.includes('- [')) {
        toast.success('Comment updated successfully');
      }
      return comment;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update comment';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to delete comments');
      return false;
    }

    setIsLoading(true);
    try {
      await deleteCommentAPI(commentId);
      toast.success('Comment deleted successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete comment';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  return {
    createComment,
    updateComment,
    deleteComment,
    isLoading
  };
} 