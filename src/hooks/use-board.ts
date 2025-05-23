'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import type { Board } from '~/types';

// HTTP client functions for API calls
async function fetchBoard(boardId: string): Promise<Board> {
  const response = await fetch(`/api/boards?boardId=${boardId}`, {
    method: 'GET',
    credentials: 'include',
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

export interface UseBoardResult {
  board: Board | null;
  loading: boolean;
  error: Error | null;
  refreshBoard: () => Promise<void>;
}

export function useBoard(boardId?: string): UseBoardResult {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { data: session } = useSession();

  const refreshBoard = useCallback(async () => {
    if (!boardId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const boardData = await fetchBoard(boardId);
      setBoard(boardData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load board'));
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

  return {
    board,
    loading,
    error,
    refreshBoard,
  };
}

export interface UseBoardListResult {
  boards: Pick<Board, 'id' | 'title' | 'theme'>[];
  loading: boolean;
  error: Error | null;
  refreshBoards: () => Promise<void>;
}

export function useBoardList(): UseBoardListResult {
  const [boards, setBoards] = useState<Pick<Board, 'id' | 'title' | 'theme'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { data: session } = useSession();

  const refreshBoards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const boardsData = await fetchBoards();
      setBoards(boardsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load boards'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBoards();
  }, [refreshBoards]);

  return {
    boards,
    loading,
    error,
    refreshBoards,
  };
} 