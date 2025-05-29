import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { Board } from '~/types';
import { localStorageService } from '~/lib/services/local-storage-service';

// Optimized board state interface
interface BoardState {
  board: Board | null;
  loading: boolean;
  error: Error | null;
  lastFetch: number;
}

// Cache management
const boardCache = new Map<string, {
  data: Board;
  timestamp: number;
  isStale: boolean;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const STALE_WHILE_REVALIDATE = 30 * 1000; // 30 seconds

// HTTP client functions with optimized caching
async function fetchBoardOptimized(boardId: string, useCache = true): Promise<Board> {
  // Check if it's a local board first
  const localBoard = localStorageService.getLocalBoard(boardId);
  if (localBoard) {
    const convertedBoard = localStorageService.convertToApiBoard(localBoard);
    
    // Cache local boards too for consistency
    if (useCache) {
      boardCache.set(boardId, {
        data: convertedBoard,
        timestamp: Date.now(),
        isStale: false
      });
    }
    
    return convertedBoard;
  }

  const now = Date.now();
  const cached = boardCache.get(boardId);
  
  // Return cached data if fresh
  if (useCache && cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  
  // Return stale data immediately while fetching fresh data in background
  if (useCache && cached && !cached.isStale) {
    cached.isStale = true;
    // Background refresh
    fetchBoardOptimized(boardId, false).then(freshData => {
      boardCache.set(boardId, {
        data: freshData,
        timestamp: now,
        isStale: false
      });
    }).catch(console.error);
    
    return cached.data;
  }
  
  const response = await fetch(`/api/boards?boardId=${boardId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch board: ${response.statusText}`);
  }

  const board = await response.json();
  
  // Update cache
  boardCache.set(boardId, {
    data: board,
    timestamp: now,
    isStale: false
  });

  return board;
}

// Optimized partial board update
function updateBoardCache(boardId: string, updater: (board: Board) => Board) {
  const cached = boardCache.get(boardId);
  if (cached) {
    const updated = updater(cached.data);
    boardCache.set(boardId, {
      ...cached,
      data: updated,
      timestamp: Date.now()
    });

    // If it's a local board, also update local storage
    if (localStorageService.isLocalBoard(boardId)) {
      // Convert back to local format and save
      const localUpdate = {
        title: updated.title,
        pinned: updated.pinned,
        columns: updated.columns.map(col => ({
          id: col.id,
          title: col.title,
          order: col.order,
          width: col.width,
          cards: col.cards.map(card => ({
            id: card.id,
            title: card.title,
            description: card.description,
            order: card.order,
            priority: card.priority,
            dueDate: card.dueDate,
            weight: card.weight,
            columnId: card.columnId,
            labels: card.labels.map(label => ({
              id: label.id,
              name: label.name,
              color: label.color
            })),
            attachments: card.attachments.map(att => ({
              id: att.id,
              fileName: att.fileName,
              fileSize: att.fileSize,
              contentType: att.contentType,
              url: att.url
            }))
          }))
        }))
      };
      localStorageService.updateLocalBoard(boardId, localUpdate);
    }
  }
}

// Invalidate cache when needed
function invalidateBoardCache(boardId: string) {
  boardCache.delete(boardId);
}

export function useBoardOptimized(boardId: string | null) {
  const [state, setState] = useState<BoardState>({
    board: null,
    loading: false,
    error: null,
    lastFetch: 0
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBoardData = useCallback(async (forceRefresh = false) => {
    if (!boardId) {
      setState({
        board: null,
        loading: false,
        error: null,
        lastFetch: 0
      });
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check if we have fresh cached data and don't need to fetch
    const now = Date.now();
    const cached = boardCache.get(boardId);
    if (!forceRefresh && cached && (now - cached.timestamp) < STALE_WHILE_REVALIDATE) {
      setState(prev => ({
        ...prev,
        board: cached.data,
        loading: false,
        error: null,
        lastFetch: cached.timestamp
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const board = await fetchBoardOptimized(boardId, !forceRefresh);
      setState({
        board,
        loading: false,
        error: null,
        lastFetch: now
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Failed to fetch board'),
      }));
      toast.error('Failed to load board');
    }
  }, [boardId]);

  // Optimized selective refresh - only refresh if data is actually stale
  const smartRefetch = useCallback(() => {
    if (!boardId) return;
    
    const cached = boardCache.get(boardId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < STALE_WHILE_REVALIDATE) {
      // Data is fresh, no need to refetch
      return;
    }
    
    return fetchBoardData(true);
  }, [boardId, fetchBoardData]);

  // Immediate local update for optimistic UI
  const updateBoardLocal = useCallback((updater: (board: Board) => Board) => {
    if (!boardId || !state.board) return;
    
    const updated = updater(state.board);
    setState(prev => ({ ...prev, board: updated }));
    updateBoardCache(boardId, updater);
  }, [boardId, state.board]);

  useEffect(() => {
    fetchBoardData();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchBoardData]);

  return {
    board: state.board,
    loading: state.loading,
    error: state.error,
    refetch: smartRefetch,
    updateLocal: updateBoardLocal,
    invalidateCache: () => boardId && invalidateBoardCache(boardId)
  };
} 