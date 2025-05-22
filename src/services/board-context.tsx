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
import type { Board, Column, Card, Label, Attachment, Comment, ActivityLog as ActivityLogType, Priority } from '~/types';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { BoardService } from './board-service';
import debounce from 'lodash/debounce';
import { toast } from 'sonner';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface BoardContextType {
  board: Board | null;
  loading: boolean;
  error: Error | null;
  saveStatus: SaveStatus;
  saveError: Error | null;
  boardLabels: Label[];
  refreshBoard: () => Promise<void>;
  updateTheme: (theme: 'light' | 'dark') => Promise<void> | void;
  updateTitle: (title: string) => void;
  createColumn: (title: string, width: number) => Promise<void> | void;
  updateColumn: (columnId: string, updates: Partial<Column>) => Promise<void> | void;
  deleteColumn: (columnId: string) => Promise<void> | void;
  moveColumn: (columnId: string, newIndex: number) => void;
  createCard: (
    columnId: string, 
    data: Partial<Omit<Card, 'id' | 'columnId' | 'order' | 'comments' | 'attachments'> & { 
      title: string;
      labelIds?: string[];
      assigneeIds?: string[];
    }>
  ) => Promise<void> | void;
  updateCard: (cardId: string, updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'> & {
    labelIdsToAdd?: string[];
    labelIdsToRemove?: string[];
    assigneeIdsToAdd?: string[];
    assigneeIdsToRemove?: string[];
    title?: string;
    description?: string;
    priority?: Priority;
    dueDate?: Date;
    weight?: number;
  }>) => Promise<void> | void;
  deleteCard: (cardId: string) => Promise<void> | void;
  moveCard: (cardId: string, targetColumnId: string, newOrder: number) => void;
  duplicateCard: (cardId: string, targetColumnId?: string) => Promise<void> | void;
  addComment: (cardId: string, author: string, content: string) => Promise<void> | void;
  deleteComment: (cardId: string, commentId: string) => Promise<void> | void;
  addAttachment: (cardId: string, attachmentData: File | { url: string; name: string; type: 'link' }) => Promise<Attachment | void>;
  deleteAttachment: (cardId: string, attachmentId: string) => Promise<void>;
  createBoardLabel: (name: string, color: string) => Promise<Label | void>;
  updateBoardLabel: (labelId: string, name: string, color: string) => Promise<Label | void>;
  deleteBoardLabel: (labelId: string) => Promise<void>;
  fetchCommentsForCard: (cardId: string) => Promise<Comment[] | void>;
  createCommentInCard: (cardId: string, content: string) => Promise<Comment | void>;
  activityLogs: ActivityLogType[];
  isLoadingActivityLogs: boolean;
  fetchActivityLogsForCard: (cardId: string) => Promise<void>;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export const BoardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogType[]>([]);
  const [isLoadingActivityLogs, setIsLoadingActivityLogs] = useState<boolean>(false);

  const { data: session, status: sessionStatus } = useSession();

  // Add caches for comments and activity logs to speed up repeated loads
  const commentsCache = useRef<Record<string, Comment[]>>({});
  const activityLogsCache = useRef<Record<string, ActivityLogType[]>>({});

  // Fetch or initialize board
  const refreshBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (session) {
        const b = await BoardService.getBoard();
        setBoard(b);
        setBoardLabels(b?.labels || []);
      } else {
        const stored = localStorage.getItem('board-local');
        if (stored) {
          const localBoard = JSON.parse(stored) as Board;
          setBoard(localBoard);
          setBoardLabels(localBoard.labels || []);
        } else {
          setBoard({ id: 'demo', title: 'Demo Board', theme: 'light', columns: [], labels: [], members: [] });
          setBoardLabels([]);
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
    updateBoardState(prev => ({ ...prev, title }));
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
    updateBoardState(prev => ({ ...prev, theme }));
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
      ...prev,
      columns: [
        ...prev.columns,
        { id: uuidv4(), title, width, order: prev.columns.length, cards: [] }
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
      ...prev,
      columns: prev.columns.map(c => c.id === columnId ? { ...c, ...updates } : c)
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
      ...prev,
      columns: prev.columns.filter(c => c.id !== columnId)
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
      const cols = [...prev.columns];
      const i = cols.findIndex(c => c.id === columnId);
      if (i < 0) return prev;
      const [m] = cols.splice(i, 1);
      if (m) {
        cols.splice(newIndex, 0, m);
      }
      return { ...prev, columns: cols };
    });
    if (session) {
      setSaveStatus('saving');
      enqueueMoveColumn(columnId, newIndex);
    }
  }, [session, enqueueMoveColumn, updateBoardState]);

  const createCard = useCallback(async (
    columnId: string, 
    data: Partial<Omit<Card, 'id' | 'columnId' | 'order' | 'comments' | 'attachments'> & { 
      title: string;
      labelIds?: string[];
      assigneeIds?: string[];
    }>
  ) => {
    const newCardId = uuidv4();
    // Optimistic update
    updateBoardState(prev => {
      if (!prev) return prev;
      const newColumns = prev.columns.map(c => {
        if (c.id === columnId) {
          // Resolve labels and assignees for optimistic update
          const labelsForOptimisticUpdate = (data.labelIds || [])
            .map(id => boardLabels.find(l => l.id === id))
            .filter(Boolean) as Label[];
          
          const assigneesForOptimisticUpdate = (data.assigneeIds || [])
            .map(id => board?.members?.find(m => m.user.id === id)?.user)
            .filter(Boolean) as UserType[];

          return {
            ...c,
            cards: [
              ...c.cards,
              {
                id: newCardId,
                columnId,
                order: c.cards.length,
                title: data.title, // title is now guaranteed by type
                description: data.description || '',
                priority: data.priority || 'medium',
                dueDate: data.dueDate,
                labels: labelsForOptimisticUpdate, // Use resolved labels
                assignees: assigneesForOptimisticUpdate, // Use resolved assignees
                attachments: [], // Default to empty for new card
                comments: [],    // Default to empty for new card
              } as Card, // Cast to Card type
            ],
          };
        }
        return c;
      });
      return { ...prev, columns: newColumns };
    });

    if (!session || !board || board.id === 'demo') { // If no session or demo board, optimistic update is enough
        if (board && board.id === 'demo') {
            // For demo board, ensure local storage is updated (already handled by updateBoardState)
        }
        return; 
    }
    
    setSaveStatus('saving');
    try {
      // Pass labelIds and assigneeIds to the service
      const updatedBoard = await BoardService.createCard(columnId, data); 
      setBoard(updatedBoard);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      // TODO: Consider reverting optimistic update if API call fails
      console.error("Failed to create card via API:", e);
    }
  }, [session, updateBoardState, boardLabels, board]); // Added boardLabels and board to dependencies

  const updateCard = useCallback(async (cardId: string, updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'> & {
    labelIdsToAdd?: string[];
    labelIdsToRemove?: string[];
    assigneeIdsToAdd?: string[];
    assigneeIdsToRemove?: string[];
    title?: string;
    description?: string;
    priority?: Priority;
    dueDate?: Date;
    weight?: number;
  }>) => {
    updateBoardState(prev => ({
      ...prev,
      columns: prev.columns.map(column => ({
        ...column,
        cards: column.cards.map(card => {
          if (card.id !== cardId) return card;
          const updatedCard = { ...card };
          // Scalar field updates
          if (updates.title !== undefined) updatedCard.title = updates.title;
          if (updates.description !== undefined) updatedCard.description = updates.description;
          if (updates.priority !== undefined) updatedCard.priority = updates.priority;
          if (updates.dueDate !== undefined) updatedCard.dueDate = updates.dueDate;
          if (updates.weight !== undefined) {
            updatedCard.weight = updates.weight;
          }
          // Labels
          if (updates.labelIdsToAdd?.length) {
            const labelsToAdd = prev.labels?.filter(l => updates.labelIdsToAdd!.includes(l.id)) || [];
            updatedCard.labels = [...updatedCard.labels, ...labelsToAdd];
          }
          if (updates.labelIdsToRemove?.length) {
            updatedCard.labels = updatedCard.labels.filter(l => !updates.labelIdsToRemove!.includes(l.id));
          }
          // Assignees
          if (updates.assigneeIdsToAdd?.length) {
            const usersToAdd = prev.members?.filter(m => updates.assigneeIdsToAdd!.includes(m.userId)).map(m => m.user) || [];
            updatedCard.assignees = [...updatedCard.assignees, ...usersToAdd];
          }
          if (updates.assigneeIdsToRemove?.length) {
            updatedCard.assignees = updatedCard.assignees.filter(u => !updates.assigneeIdsToRemove!.includes(u.id));
          }
          return updatedCard;
        })
      }))
    }));
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updatedCardFromApi = await BoardService.updateCard(cardId, updates as any);
      // Instead of setBoard(updated), merge the single updated card back into the state
      updateBoardState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map(column => ({
            ...column,
            cards: column.cards.map(card => 
              card.id === cardId 
                ? { ...card, ...updatedCardFromApi } // Merge the API response into the specific card
                : card
            )
          }))
        };
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
    }
  }, [session, updateBoardState]);

  const deleteCard = useCallback(async (cardId: string) => {
    updateBoardState(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
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
      const cols = prev.columns.map(c => ({ ...c, cards: [...c.cards] }));
      let moved: Card | undefined;
      let fromId: string | undefined;
      for (const c of cols) {
        const idx = c.cards.findIndex(card => card.id === cardId);
        if (idx >= 0) { [moved] = c.cards.splice(idx, 1); fromId = c.id; break; }
      }
      if (!moved) return prev;
      const dest = cols.find(c => c.id === targetColumnId);
      if (!dest) return prev;
      moved.columnId = targetColumnId;
      dest.cards.splice(newOrder, 0, moved);
      const recalc = (arr: Card[]) => arr.map((card, i) => ({ ...card, order: i }));
      return { ...prev, columns: cols.map(c => c.id === fromId || c.id === targetColumnId ? { ...c, cards: recalc(c.cards) } : c) };
    });
    if (session) {
      setSaveStatus('saving');
      enqueueMoveCard(cardId, targetColumnId, newOrder);
    }
  }, [session, enqueueMoveCard, updateBoardState]);

  const duplicateCard = useCallback((cardId: string, targetColumnId?: string) => {
    updateBoardState(prev => {
      const cols = prev.columns.map(c => ({ ...c, cards: [...c.cards] }));
      const src = cols.find(c => c.cards.some(card => card.id === cardId));
      const orig = src?.cards.find(card => card.id === cardId);
      if (!orig) return prev;
      const dest = cols.find(c => c.id === (targetColumnId ?? orig.columnId));
      if (dest) dest.cards.push({ ...orig, id: uuidv4() });
      return { ...prev, columns: cols };
    });
  }, [updateBoardState]);

  const addComment = useCallback((cardId: string, author: string, content: string) => {
    updateBoardState(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, comments: [...card.comments, { id: uuidv4(), author, content, createdAt: new Date() }] } : card)
      }))
    }));
  }, [updateBoardState]);

  const deleteComment = useCallback((cardId: string, commentId: string) => {
    updateBoardState(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => card.id === cardId ? { ...card, comments: card.comments.filter(cm => cm.id !== commentId) } : card)
      }))
    }));
  }, [updateBoardState]);

  const addAttachment = useCallback(
    async (cardId: string, attachmentData: File | { url: string; name: string; type: 'link' }) => {
      if (!board) return;
      setSaveStatus('saving');
      try {
        let newAttachment: Attachment | undefined;
        if (attachmentData instanceof File) {
          newAttachment = await BoardService.addAttachment(cardId, attachmentData);
        } else {
          // Assuming BoardService.addAttachment can handle this structure for links, or we need another service method
          // For now, let's assume BoardService.addAttachment is updated or overloaded to handle this.
          // If not, we'd call a different BoardService method e.g., BoardService.addLinkAttachment
          newAttachment = await BoardService.addAttachment(cardId, attachmentData as any); // Cast to any if service not updated yet
        }

        if (newAttachment) {
          updateBoardState(prev => ({
            ...prev,
            columns: prev.columns.map(col => ({
              ...col,
              cards: col.cards.map(c => 
                c.id === cardId 
                  ? { ...c, attachments: [...(c.attachments || []), newAttachment!] } 
                  : c
              ),
            })),
          }));
          setSaveStatus('saved');
          toast.success(attachmentData instanceof File ? 'File attached successfully' : 'Link added successfully');
          return newAttachment;
        }
      } catch (e) {
        setSaveStatus('error');
        setSaveError(e as Error);
        toast.error(attachmentData instanceof File ? 'Failed to attach file' : 'Failed to add link');
      }
    },
    [board, session, updateBoardState]
  );

  const deleteAttachment = useCallback(async (cardId: string, attachmentId: string): Promise<void> => {
    // Optimistic update
    updateBoardState(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        cards: c.cards.map(card => 
          card.id === cardId ? 
          { ...card, attachments: card.attachments.filter(a => a.id !== attachmentId) } : 
          card
        )
      }))
    }));
    
    if (!session || !board || board.id === 'demo') {
      return; // Skip API call for demo mode
    }
    
    setSaveStatus('saving');
    try {
      await BoardService.deleteAttachment(cardId, attachmentId);
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error(`Failed to delete attachment ${attachmentId} from card ${cardId}:`, e);
      
      // We should ideally restore the attachment on error, but we'd need to have cached it
      // For simplicity, we'll just log the error and let the next board refresh restore it
    }
  }, [session, board, updateBoardState, setSaveStatus, setSaveError]);

  const createBoardLabel = useCallback(async (name: string, color: string): Promise<Label | void> => {
    if (!board?.id || board.id === 'demo') { // Don't save for demo board
      const newLabel = { id: uuidv4(), name, color, boardId: board?.id ?? 'demo' };
      updateBoardState(prev => {
        const updatedLabels = [...(prev?.labels ?? []), newLabel];
        setBoardLabels(updatedLabels);
        return { ...prev, labels: updatedLabels };
      });
      return newLabel;
    }
    if (!session) return;
    setSaveStatus('saving');
    try {
      const newLabel = await BoardService.createBoardLabel(board.id, name, color);
      if (newLabel) {
        updateBoardState(prev => {
          const updatedLabels = [...(prev?.labels || []), newLabel];
          setBoardLabels(updatedLabels);
          return { ...prev, labels: updatedLabels };
        });
        setSaveStatus('saved');
        return newLabel;
      }
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error("Failed to create label:", e);
    }
  }, [session, board?.id, updateBoardState]);

  const updateBoardLabel = useCallback(async (labelId: string, name: string, color: string): Promise<Label | void> => {
    if (!board?.id || board.id === 'demo') {
      // Optimistic update for demo board
      let updatedLabelInstance: Label | undefined;
      updateBoardState(prev => {
        const updatedLabels = prev.labels.map(l => l.id === labelId ? (updatedLabelInstance = { ...l, name, color }) : l);
        setBoardLabels(updatedLabels);
        return { ...prev, labels: updatedLabels };
      });
      return updatedLabelInstance;
    }
    if (!session) return;
    setSaveStatus('saving');
    try {
      const updatedLabel = await BoardService.updateBoardLabel(board.id, labelId, name, color);
      if (updatedLabel) {
        updateBoardState(prev => {
          const updatedLabels = prev.labels.map(l => l.id === labelId ? updatedLabel : l);
          setBoardLabels(updatedLabels);
          return { ...prev, labels: updatedLabels };
        });
        setSaveStatus('saved');
        return updatedLabel;
      }
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error("Failed to update label:", e);
      const errMsg = (e as Error).message;
      if (errMsg.toLowerCase().includes('forbidden')) {
        toast.error('You do not have permission to modify this board');
      } else {
        toast.error(errMsg || 'Failed to update label');
      }
    }
  }, [session, board?.id, updateBoardState]);

  const deleteBoardLabel = useCallback(async (labelId: string): Promise<void> => {
    if (!board?.id || board.id === 'demo') {
      // Optimistic update for demo board
      updateBoardState(prev => {
        const updatedLabels = prev.labels.filter(l => l.id !== labelId);
        const updatedColumns = prev.columns.map(col => ({
          ...col,
          cards: col.cards.map(card => ({
            ...card,
            labels: card.labels.filter(l => l.id !== labelId)
          }))
        }));
        setBoardLabels(updatedLabels);
        return { ...prev, labels: updatedLabels, columns: updatedColumns };
      });
      return;
    }
    if (!session) return;
    setSaveStatus('saving');
    try {
      await BoardService.deleteBoardLabel(board.id, labelId);
      // Optimistic update (remove label from board.labels and from all cards)
      updateBoardState(prev => {
        const updatedLabels = prev.labels.filter(l => l.id !== labelId);
        const updatedColumns = prev.columns.map(col => ({
          ...col,
          cards: col.cards.map(card => ({
            ...card,
            labels: card.labels.filter(l => l.id !== labelId)
          }))
        }));
        setBoardLabels(updatedLabels);
        return { ...prev, labels: updatedLabels, columns: updatedColumns };
      });
      setSaveStatus('saved');
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error("Failed to delete label:", e);
      const errMsg = (e as Error).message;
      if (errMsg.toLowerCase().includes('forbidden')) {
        toast.error('You do not have permission to modify this board');
      } else {
        toast.error(errMsg || 'Failed to delete label');
      }
    }
  }, [session, board?.id, updateBoardState]);

  // --- Comment Functions ---
  const fetchCommentsForCard = useCallback(async (cardId: string): Promise<Comment[] | void> => {
    // Return cached comments immediately if available
    if (commentsCache.current[cardId]) {
      return commentsCache.current[cardId];
    }
    if (!session || !board || board.id === 'demo') {
      const card = board?.columns.flatMap(c => c.cards).find(c => c.id === cardId);
      const localComments = card?.comments || [];
      commentsCache.current[cardId] = localComments;
      return localComments;
    }
    setSaveStatus('saving');
    try {
      const comments = await BoardService.fetchComments(cardId);
      const list = comments || [];
      commentsCache.current[cardId] = list;
      setSaveStatus('idle');
      return list;
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error(`Failed to fetch comments for card ${cardId}:`, e);
    }
  }, [session, board]);

  const createCommentInCard = useCallback(async (cardId: string, content: string): Promise<Comment | void> => {
    if (!session || !board || board.id === 'demo') {
      // Optimistic update for demo board or no session
      const newComment = {
        id: uuidv4(),
        content,
        cardId,
        userId: session?.user?.id || 'demo-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: { 
            id: session?.user?.id || 'demo-user', 
            name: session?.user?.name || 'Demo User', 
            email: session?.user?.email, 
            image: session?.user?.image 
        }
      } as Comment; // Cast to Comment type (ensure User is part of Comment type)
      
      updateBoardState(prev => {
        if (!prev) return prev;
        const newColumns = prev.columns.map(col => ({
          ...col,
          cards: col.cards.map(c => {
            if (c.id === cardId) {
              return { ...c, comments: [...(c.comments || []), newComment] };
            }
            return c;
          })
        }));
        return { ...prev, columns: newColumns };
      });
      // Update cache
      const prev = commentsCache.current[cardId] || [];
      commentsCache.current[cardId] = [...prev, newComment];
      return newComment;
    }

    setSaveStatus('saving');
    try {
      const newComment = await BoardService.createCommentViaApi(cardId, content);
      if (newComment) {
        // Optimistic update: add the new comment to the local board state
        updateBoardState(prev => {
          if (!prev) return prev;
          const newColumns = prev.columns.map(col => ({
            ...col,
            cards: col.cards.map(c => {
              if (c.id === cardId) {
                // Ensure no duplicate comments if API returns the comment already added optimistically
                const existingComment = c.comments?.find(com => com.id === newComment.id);
                if (existingComment) return c; // Already there
                return { ...c, comments: [...(c.comments || []), newComment] };
              }
              return c;
            })
          }));
          return { ...prev, columns: newColumns };
        });
        setSaveStatus('saved');
        return newComment;
      }
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e as Error);
      console.error(`Failed to create comment for card ${cardId}:`, e);
    }
  }, [session, board, updateBoardState]);

  const fetchActivityLogsForCard = useCallback(async (cardId: string) => {
    // Return cached logs if available
    if (activityLogsCache.current[cardId]) {
      setActivityLogs(activityLogsCache.current[cardId]);
      setIsLoadingActivityLogs(false);
      return;
    }
    if (!session) {
      setActivityLogs([]);
      return;
    }
    setIsLoadingActivityLogs(true);
    try {
      const logs = await BoardService.fetchActivityLogs(cardId);
      const list = logs || [];
      activityLogsCache.current[cardId] = list;
      setActivityLogs(list);
    } catch (e) {
      console.error(`Failed to fetch activity logs for card ${cardId}:`, e);
      setActivityLogs([]);
    } finally {
      setIsLoadingActivityLogs(false);
    }
  }, [session]);

  const contextValue = useMemo(() => ({
    board,
    loading,
    error,
    saveStatus,
    saveError,
    boardLabels,
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
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    createBoardLabel,
    updateBoardLabel,
    deleteBoardLabel,
    fetchCommentsForCard,
    createCommentInCard,
    activityLogs,
    isLoadingActivityLogs,
    fetchActivityLogsForCard,
  }), [
    board,
    loading,
    error,
    saveStatus,
    saveError,
    boardLabels,
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
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment,
    createBoardLabel,
    updateBoardLabel,
    deleteBoardLabel,
    fetchCommentsForCard,
    createCommentInCard,
    activityLogs,
    isLoadingActivityLogs,
    fetchActivityLogsForCard,
  ]);

  return <BoardContext.Provider value={contextValue}>{children}</BoardContext.Provider>;
};

export function useBoard(): BoardContextType {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used within BoardProvider');
  return ctx;
} 