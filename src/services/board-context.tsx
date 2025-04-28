/**
 * BoardContext provides board state and mutators.
 * - Optimistic local updates
 * - Debounced full-board PATCH for authenticated users
 * - Save status indicator and retry on error
 * - In-memory board for unauthenticated users
 */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Board, Column, Card, Label, Attachment, Comment } from '~/types';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { BoardService } from './board-service';
import debounce from 'lodash/debounce';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface BoardContextType {
  board: Board | null;
  loading: boolean;
  error: Error | null;
  saveStatus: SaveStatus;
  saveError: Error | null;
  refreshBoard: () => Promise<void>;
  updateTheme: (theme: 'light' | 'dark') => Promise<void> | void;
  createColumn: (title: string, width: number) => Promise<void> | void;
  updateColumn: (columnId: string, updates: Partial<Column>) => Promise<void> | void;
  deleteColumn: (columnId: string) => Promise<void> | void;
  moveColumn: (columnId: string, newIndex: number) => void;
  createCard: (columnId: string, data: Omit<Card, 'id' | 'columnId' | 'order'>) => Promise<void> | void;
  updateCard: (cardId: string, updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>) => Promise<void> | void;
  deleteCard: (cardId: string) => Promise<void> | void;
  moveCard: (cardId: string, targetColumnId: string, newOrder: number) => void;
  duplicateCard: (cardId: string, targetColumnId?: string) => Promise<void> | void;
  addLabel: (cardId: string, name: string, color: string) => Promise<void> | void;
  removeLabel: (cardId: string, labelId: string) => Promise<void> | void;
  addComment: (cardId: string, author: string, content: string) => Promise<void> | void;
  deleteComment: (cardId: string, commentId: string) => Promise<void> | void;
  addAttachment: (cardId: string, name: string, url: string, type: string) => Promise<void> | void;
  deleteAttachment: (cardId: string, attachmentId: string) => Promise<void> | void;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export const BoardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<Error | null>(null);

  const { data: session, status: sessionStatus } = useSession();

  // Fetch or initialize board
  const refreshBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (session) {
        const b = await BoardService.getBoard();
        setBoard(b);
      } else {
        const stored = localStorage.getItem('board-local');
        if (stored) setBoard(JSON.parse(stored));
        else setBoard({ id: 'demo', title: 'Demo Board', theme: 'light', columns: [] });
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    refreshBoard();
  }, [session, sessionStatus, refreshBoard]);

  // Optimistic local update helper
  const updateBoardState = useCallback(
    (fn: (prev: Board) => Board) => {
      setBoard(prev => {
        if (!prev) return prev;
        const next = fn(prev);
        try { localStorage.setItem('board-local', JSON.stringify(next)); } catch {}
        return next;
      });
    }, []
  );

  const moveCardDebouncers = useRef<Record<string, (cid: string, colId: string, ord: number) => void>>({});
  const moveColumnDebouncers = useRef<Record<string, (colId: string, idx: number) => void>>({});

  // Debounce individual card moves via BoardService, updating state from returned board
  const enqueueMoveCard = useCallback(
    (cardId: string, targetColumnId: string, order: number) => {
      if (!moveCardDebouncers.current[cardId]) {
        moveCardDebouncers.current[cardId] = debounce(
          async (cid: string, colId: string, ord: number) => {
            setSaveStatus('saving');
            try {
              const updatedBoard = await BoardService.moveCard(cid, colId, ord);
              setBoard(updatedBoard);
              setSaveStatus('saved');
            } catch (err) {
              console.error('Failed to move card', err);
              setSaveStatus('error');
            }
          },
          300,
          { leading: false, trailing: true }
        );
      }
      moveCardDebouncers.current[cardId](cardId, targetColumnId, order);
    },
    []
  );

  // Debounce individual column moves via BoardService, updating state from returned board
  const enqueueMoveColumn = useCallback(
    (columnId: string, newIndex: number) => {
      if (!moveColumnDebouncers.current[columnId]) {
        moveColumnDebouncers.current[columnId] = debounce(
          async (cid: string, idx: number) => {
            setSaveStatus('saving');
            try {
              const updatedBoard = await BoardService.moveColumn(cid, idx);
              setBoard(updatedBoard);
              setSaveStatus('saved');
            } catch (err) {
              console.error('Failed to move column', err);
              setSaveStatus('error');
            }
          },
          300,
          { leading: false, trailing: true }
        );
      }
      moveColumnDebouncers.current[columnId](columnId, newIndex);
    },
    []
  );

  // Flush pending move patches on pagehide or unmount
  useEffect(() => {
    const flushAll = () => {
      Object.values(moveCardDebouncers.current).forEach(fn => fn.flush?.());
      Object.values(moveColumnDebouncers.current).forEach(fn => fn.flush?.());
    };
    window.addEventListener('pagehide', flushAll);
    return () => {
      flushAll();
      window.removeEventListener('pagehide', flushAll);
    };
  }, []);

  // Mutators:
  const updateTheme = useCallback(async (theme: 'light' | 'dark') => {
    updateBoardState(prev => ({ ...prev!, theme }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.updateTheme(theme);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const createColumn = useCallback(async (title: string, width: number) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: [
        ...prev!.columns,
        { id: uuidv4(), title, width, order: prev!.columns.length, cards: [] }
      ]
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.createColumn(title, width);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const updateColumn = useCallback(async (columnId: string, updates: Partial<Column>) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => c.id === columnId ? { ...c, ...updates } : c)
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.updateColumn(columnId, updates);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const deleteColumn = useCallback(async (columnId: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.filter(c => c.id !== columnId)
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.deleteColumn(columnId);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const moveColumn = useCallback((columnId: string, newIndex: number) => {
    updateBoardState(prev => {
      const cols = [...prev!.columns];
      const i = cols.findIndex(c => c.id === columnId);
      if (i < 0) return prev!;
      const [m] = cols.splice(i, 1);
      cols.splice(newIndex, 0, m);
      return { ...prev!, columns: cols };
    });
    if (session) {
      setSaveStatus('saving');
      enqueueMoveColumn(columnId, newIndex);
    }
  }, [session, enqueueMoveColumn, updateBoardState]);

  const createCard = useCallback(async (columnId: string, data: Omit<Card, 'id' | 'columnId' | 'order'>) => {
    updateBoardState(prev => {
      const cols = prev!.columns.map(c => ({ ...c, cards: [...c.cards] }));
      const col = cols.find(c => c.id === columnId);
      if (col) col.cards.push({ id: uuidv4(), columnId, order: col.cards.length, ...data });
      return { ...prev!, columns: cols };
    });
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.createCard(columnId, data);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, ...updates } : card)
      }))
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.updateCard(cardId, updates as any);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const deleteCard = useCallback(async (cardId: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.filter(card => card.id !== cardId)
      }))
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updated = await BoardService.deleteCard(cardId);
      setBoard(updated);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const moveCard = useCallback((cardId: string, targetColumnId: string, newOrder: number) => {
    updateBoardState(prev => {
      const cols = prev!.columns.map(c => ({ ...c, cards: [...c.cards] }));
      let moved: Card | undefined;
      let fromId: string | undefined;
      for (const c of cols) {
        const idx = c.cards.findIndex(card => card.id === cardId);
        if (idx >= 0) { [moved] = c.cards.splice(idx, 1); fromId = c.id; break; }
      }
      if (!moved) return prev!;
      const dest = cols.find(c => c.id === targetColumnId);
      if (!dest) return prev!;
      moved.columnId = targetColumnId;
      dest.cards.splice(newOrder, 0, moved);
      const recalc = (arr: Card[]) => arr.map((card, i) => ({ ...card, order: i }));
      return { ...prev!, columns: cols.map(c => c.id === fromId || c.id === targetColumnId ? { ...c, cards: recalc(c.cards) } : c) };
    });
    if (session) {
      setSaveStatus('saving');
      enqueueMoveCard(cardId, targetColumnId, newOrder);
    }
  }, [session, enqueueMoveCard, updateBoardState]);

  const duplicateCard = useCallback((cardId: string, targetColumnId?: string) => {
    updateBoardState(prev => {
      const cols = prev!.columns.map(c => ({ ...c, cards: [...c.cards] }));
      const src = cols.find(c => c.cards.some(card => card.id === cardId));
      const orig = src?.cards.find(card => card.id === cardId);
      if (!orig) return prev!;
      const dest = cols.find(c => c.id === (targetColumnId ?? orig.columnId));
      if (dest) dest.cards.push({ ...orig, id: uuidv4() });
      return { ...prev!, columns: cols };
    });
  }, [updateBoardState]);

  const addLabel = useCallback((cardId: string, name: string, color: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, labels: [...card.labels, { id: uuidv4(), name, color }] } : card)
      }))
    }));
  }, [updateBoardState]);

  const removeLabel = useCallback((cardId: string, labelId: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, labels: card.labels.filter(l => l.id !== labelId) } : card)
      }))
    }));
  }, [updateBoardState]);

  const addComment = useCallback((cardId: string, author: string, content: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, comments: [...card.comments, { id: uuidv4(), author, content, createdAt: new Date() }] } : card)
      }))
    }));
  }, [updateBoardState]);

  const deleteComment = useCallback((cardId: string, commentId: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, comments: card.comments.filter(cm => cm.id !== commentId) } : card)
      }))
    }));
  }, [updateBoardState]);

  const addAttachment = useCallback((cardId: string, name: string, url: string, type: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, attachments: [...card.attachments, { id: uuidv4(), name, url, type, createdAt: new Date() }] } : card)
      }))
    }));
  }, [updateBoardState]);

  const deleteAttachment = useCallback((cardId: string, attachmentId: string) => {
    updateBoardState(prev => ({
      ...prev!,
      columns: prev!.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, attachments: card.attachments.filter(a => a.id !== attachmentId) } : card)
      }))
    }));
  }, [updateBoardState]);

  return (
    <BoardContext.Provider value={{
      board,
      loading,
      error,
      saveStatus,
      saveError,
      refreshBoard,
      updateTheme,
      createColumn,
      updateColumn,
      deleteColumn,
      moveColumn,
      createCard,
      updateCard,
      deleteCard,
      moveCard,
      duplicateCard,
      addLabel,
      removeLabel,
      addComment,
      deleteComment,
      addAttachment,
      deleteAttachment
    }}>
      {children}
    </BoardContext.Provider>
  );
};

export function useBoard(): BoardContextType {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used within BoardProvider');
  return ctx;
} 