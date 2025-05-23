import { useState, useEffect, useCallback } from 'react';
import type { Board } from '~/types';

// HTTP client functions for API calls
async function fetchBoard(boardId: string): Promise<Board> {
  const response = await fetch(`/api/boards?boardId=${boardId}`, {
    method: 'GET',
    credentials: 'include', // Include session cookies
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch board: ${response.statusText}`);
  }

  return response.json();
}

async function fetchBoards(): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]> {
  const response = await fetch('/api/boards', {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch boards: ${response.statusText}`);
  }

  return response.json();
}

async function createBoardAPI(data: { title: string }): Promise<Board> {
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create board: ${response.statusText}`);
  }

  return response.json();
}

async function updateBoardAPI(boardId: string, updates: { title?: string; theme?: 'light' | 'dark' }): Promise<Board> {
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

  // For now, fetch the updated board since PATCH only returns success message
  return fetchBoard(boardId);
}

export function useBoard(boardId: string | null) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBoardData = useCallback(async () => {
    if (!boardId) {
      setBoard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const board = await fetchBoard(boardId);
      setBoard(board);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch board'));
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const refetch = useCallback(() => {
    return fetchBoardData();
  }, [fetchBoardData]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  return {
    board,
    loading,
    error,
    refetch
  };
}

export function useBoardMutations() {
  const updateBoard = useCallback(async (boardId: string, updates: Partial<Board>) => {
    // Extract only the fields that the API supports
    const apiUpdates: { title?: string; theme?: 'light' | 'dark' } = {};
    if (updates.title !== undefined) {
      apiUpdates.title = updates.title;
    }
    if (updates.theme !== undefined) {
      apiUpdates.theme = updates.theme;
    }
    
    return await updateBoardAPI(boardId, apiUpdates);
  }, []);

  const createBoard = useCallback(async (data: { title: string }) => {
    return await createBoardAPI(data);
  }, []);

  const deleteBoard = useCallback(async (boardId: string) => {
    const response = await fetch(`/api/boards/${boardId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete board: ${response.statusText}`);
    }

    return response.json();
  }, []);

  return {
    updateBoard,
    createBoard,
    deleteBoard
  };
}

export function useBoards() {
  const [boards, setBoards] = useState<Pick<Board, 'id' | 'title' | 'theme'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBoardsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const boards = await fetchBoards();
      setBoards(boards);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch boards'));
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    return fetchBoardsData();
  }, [fetchBoardsData]);

  useEffect(() => {
    fetchBoardsData();
  }, [fetchBoardsData]);

  return {
    boards,
    loading,
    error,
    refetch
  };
} 