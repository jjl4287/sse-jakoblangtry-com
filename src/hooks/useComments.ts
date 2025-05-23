import { useState, useEffect, useCallback } from 'react';
import type { Comment } from '~/types';

// HTTP client functions for API calls
async function fetchCardComments(cardId: string): Promise<Comment[]> {
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
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create comment: ${response.statusText}`);
  }

  return response.json();
}

export function useCardComments(cardId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchComments = useCallback(async () => {
    if (!cardId) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const comments = await fetchCardComments(cardId);
      setComments(comments);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  const refetch = useCallback(() => {
    return fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    loading,
    error,
    refetch
  };
}

export function useCommentMutations() {
  const createComment = useCallback(async (cardId: string, content: string) => {
    return await createCommentAPI(cardId, content);
  }, []);

  return {
    createComment
  };
} 