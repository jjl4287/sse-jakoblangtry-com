'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { Board } from '~/types';

// HTTP client functions for API calls
async function createBoardAPI(title: string): Promise<Board> {
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create board: ${response.statusText}`);
  }

  return response.json();
}

async function updateBoardAPI(boardId: string, updates: Partial<{ title: string; theme: 'light' | 'dark' }>): Promise<Board> {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update board: ${response.statusText}`);
  }

  // Since the PATCH endpoint returns success message, we need to fetch the board
  const boardResponse = await fetch(`/api/boards?boardId=${boardId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!boardResponse.ok) {
    throw new Error(`Failed to fetch updated board: ${boardResponse.statusText}`);
  }

  return boardResponse.json();
}

async function deleteBoardAPI(boardId: string): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete board: ${response.statusText}`);
  }
}

async function shareBoardAPI(boardId: string, targetUserId: string): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to share board: ${response.statusText}`);
  }
}

async function unshareBoardAPI(boardId: string, targetUserId: string): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ targetUserId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to unshare board: ${response.statusText}`);
  }
}

export interface UseBoardMutationsResult {
  createBoard: (title: string) => Promise<Board | null>;
  updateBoard: (boardId: string, updates: Partial<{ title: string; theme: 'light' | 'dark' }>) => Promise<Board | null>;
  deleteBoard: (boardId: string) => Promise<boolean>;
  shareBoard: (boardId: string, targetUserId: string) => Promise<boolean>;
  unshareBoard: (boardId: string, targetUserId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function useBoardMutations(): UseBoardMutationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();

  const createBoard = useCallback(async (title: string): Promise<Board | null> => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to create a board');
      return null;
    }

    setIsLoading(true);
    try {
      const board = await createBoardAPI(title);
      toast.success('Board created successfully');
      return board;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create board';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const updateBoard = useCallback(async (
    boardId: string, 
    updates: Partial<{ title: string; theme: 'light' | 'dark' }>
  ): Promise<Board | null> => {
    setIsLoading(true);
    try {
      const board = await updateBoardAPI(boardId, updates);
      toast.success('Board updated successfully');
      return board;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update board';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteBoard = useCallback(async (boardId: string): Promise<boolean> => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to delete a board');
      return false;
    }

    setIsLoading(true);
    try {
      await deleteBoardAPI(boardId);
      toast.success('Board deleted successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete board';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const shareBoard = useCallback(async (boardId: string, targetUserId: string): Promise<boolean> => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to share a board');
      return false;
    }

    setIsLoading(true);
    try {
      await shareBoardAPI(boardId, targetUserId);
      toast.success('Board shared successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share board';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  const unshareBoard = useCallback(async (boardId: string, targetUserId: string): Promise<boolean> => {
    if (!session?.user?.id) {
      toast.error('You must be logged in to unshare a board');
      return false;
    }

    setIsLoading(true);
    try {
      await unshareBoardAPI(boardId, targetUserId);
      toast.success('Board access removed successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove board access';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  return {
    createBoard,
    updateBoard,
    deleteBoard,
    shareBoard,
    unshareBoard,
    isLoading,
  };
} 