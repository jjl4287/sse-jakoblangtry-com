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
import type { Board, Column, Card, Label, Attachment, Comment, BoardMember, Milestone, User, Priority } from '~/types';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { BoardService } from './board-service';
import debounce from 'lodash/debounce';
import { createDefaultBoard } from '~/types/defaults';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Define the full Card type for creation
// This needs to align with what NewCardSheet prepares and BoardService expects
type CreateCardData = Partial<Omit<Card, 'id' | 'order' | 'columnId'>> & {
  title: string;
  columnId: string;
  order?: number; // order might be calculated on server
  // Use Prisma connect syntax for relations
  assignees?: { connect: { id: string }[] };
  labels?: { connect: { id: string }[] };
};

interface BoardContextType {
  board: Board | null;
  boardMembers: { id: string; name: string; email?: string; joinedAt: string }[];
  milestones: Milestone[];
  labels: Label[];
  loading: boolean;
  error: Error | null;
  saveStatus: SaveStatus;
  saveError: Error | null;
  refreshBoard: () => Promise<void>;
  updateTheme: (theme: 'light' | 'dark') => Promise<void> | void;
  updateTitle: (title: string) => void;
  createColumn: (title: string, width: number) => Promise<void> | void;
  updateColumn: (columnId: string, updates: Partial<Column>) => Promise<void> | void;
  deleteColumn: (columnId: string) => Promise<void> | void;
  moveColumn: (columnId: string, newIndex: number) => void;
  createCard: (columnId: string, data: CreateCardData) => Promise<void> | void;
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
  assignUserToCard: (cardId: string, userId: string) => Promise<void> | void;
  setCardMilestone: (cardId: string, milestoneId: string) => Promise<void> | void;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export const BoardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardMembers, setBoardMembers] = useState<{ id: string; name: string; email?: string; joinedAt: string }[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<Error | null>(null);

  const { data: session, status: sessionStatus } = useSession();

  // Fetch or initialize board AND related data
  const refreshBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (session) {
        const fullBoardData = await BoardService.getBoard();
        setBoard(fullBoardData);
        // Fetch and populate board members explicitly
        try {
          const membersList = await BoardService.listBoardMembers(fullBoardData.id);
          setBoardMembers(membersList);
        } catch (err) {
          console.error('Failed to fetch board members:', err);
          setBoardMembers([]);
        }
        // Clear or initialize milestones and labels until Plan A is complete
        setMilestones([]);
        setLabels([]);
      } else {
        // Handle local storage / demo board
        const stored = localStorage.getItem('board-local');
        if (stored) {
           const localBoard = JSON.parse(stored);
           setBoard(localBoard);
           // Demo boards likely won't have these, set to empty
           setBoardMembers([]);
           setMilestones([]);
           setLabels([]);
        } else {
          // Initialize with default board structure for unauthenticated users
          setBoard(createDefaultBoard());
           setBoardMembers([]);
           setMilestones([]);
           setLabels([]);
        }
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

  // Update only the title locally
  const updateTitle = useCallback((title: string) => {
    updateBoardState(prev => ({ ...prev!, title }));
  }, [updateBoardState]);

  const moveCardDebouncers = useRef<Record<string, ReturnType<typeof debounce>>>({});
  const moveColumnDebouncers = useRef<Record<string, ReturnType<typeof debounce>>>({});

  // Debounce individual card moves via BoardService, updating state from returned board
  const enqueueMoveCard = useCallback(
    (cardId: string, targetColumnId: string, order: number) => {
      if (!moveCardDebouncers.current[cardId]) {
        moveCardDebouncers.current[cardId] = debounce(
          async (cid: string, colId: string, ord: number) => {
            setSaveStatus('saving');
            try {
              // Just save without refreshing the entire board
              await BoardService.moveCard(cid, colId, ord);
              setSaveStatus('saved');
            } catch (err) {
              console.error('Failed to move card', err);
              setSaveStatus('error');
            }
          },
          2500,
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
              // Just save without refreshing the entire board
              await BoardService.moveColumn(cid, idx);
              setSaveStatus('saved');
            } catch (err) {
              console.error('Failed to move column', err);
              setSaveStatus('error');
            }
          },
          2500,
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
      Object.values(moveCardDebouncers.current).forEach(fn => {
        if (typeof fn.flush === 'function') fn.flush();
      });
      Object.values(moveColumnDebouncers.current).forEach(fn => {
        if (typeof fn.flush === 'function') fn.flush();
      });
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
      if (m) {
        cols.splice(newIndex, 0, m);
      }
      return { ...prev!, columns: cols };
    });
    if (session) {
      setSaveStatus('saving');
      enqueueMoveColumn(columnId, newIndex);
    }
  }, [session, enqueueMoveColumn, updateBoardState]);

  const createCard = useCallback(async (columnId: string, data: CreateCardData) => {
    // Optimistic Update (create a temporary card)
    const tempId = uuidv4();
    const now = new Date().toISOString();
    const newCard: Card = {
      id: tempId,
      columnId,
      title: data.title,
      description: data.description || '',
      order: data.order ?? Date.now(), // Use provided order or timestamp
      createdAt: now,
      updatedAt: now,
      // --- Add default/empty values for other fields ---      
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority ?? Priority.medium, // Default priority? Or null?
      // TEMP: Simulate relations locally - Need full objects which we don't have easily here
      assignees: [], // Will be updated on save
      labels: [], // Will be updated on save
      comments: [], // Will be updated on save
      attachments: [], // Will be updated on save
      milestone: null, // Will be updated on save
      milestoneId: data.milestoneId || null,
    };

    updateBoardState(prev => {
      const cols = prev!.columns.map(c => {
        if (c.id === columnId) {
          // Add new card, ensuring cards array exists
          const cards = [...(c.cards || []), newCard].sort((a, b) => a.order - b.order);
          return { ...c, cards };
        }
        return c;
      });
      return { ...prev!, columns: cols };
    });

    if (!session) return; // No server save for demo boards

    setSaveStatus('saving');
    try {
      // Call BoardService with the correct structure
      const updatedBoard = await BoardService.createCard(columnId, data);
      setBoard(updatedBoard); // Update board with server state (includes real ID)
      // Update related data if the service returns it
      setBoardMembers(updatedBoard.members || []);
      setMilestones(updatedBoard.milestones || []);
      setLabels(updatedBoard.labels || []);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      // Rollback? Or just log error and keep optimistic state?
      console.error("Failed to save new card:", e);
      // Simple rollback: Remove the temp card
      updateBoardState(prev => {
         const cols = prev!.columns.map(c => {
          if (c.id === columnId) {
            return { ...c, cards: (c.cards || []).filter(card => card.id !== tempId) };
          }
          return c;
        });
        return { ...prev!, columns: cols };
      });
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

  // Assign user to card
  const assignUserToCard = useCallback(async (cardId: string, userId: string) => {
    try {
      const updated = await BoardService.assignUserToCard(cardId, userId);
      setBoard(updated);
    } catch (err: unknown) {
      console.error('Failed to assign user to card:', err);
    }
  }, []);

  // Set milestone for card
  const setCardMilestone = useCallback(async (cardId: string, milestoneId: string) => {
    try {
      const updated = await BoardService.setCardMilestone(cardId, milestoneId);
      setBoard(updated);
    } catch (err: unknown) {
      console.error('Failed to set milestone for card:', err);
    }
  }, []);

  // Update context value
  const contextValue = useMemo(() => ({
    board,
    boardMembers,
    milestones,
    labels,
    loading,
    error,
    saveStatus,
    saveError,
    refreshBoard,
    updateTheme,
    updateTitle,
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
    deleteAttachment,
    assignUserToCard,
    setCardMilestone,
  }), [
    board,
    boardMembers,
    milestones,
    labels,
    loading,
    error,
    saveStatus,
    saveError,
    refreshBoard,
    updateTheme,
    updateTitle,
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
    deleteAttachment,
    assignUserToCard,
    setCardMilestone,
  ]);

  return <BoardContext.Provider value={contextValue}>{children}</BoardContext.Provider>;
};

export function useBoard(): BoardContextType {
  const context = useContext(BoardContext);
  if (context === undefined) {
    throw new Error('useBoard must be used within a BoardProvider');
  }
  return context;
} 