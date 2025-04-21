'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Board, Card } from '~/types';
import { BoardService } from './board-service';

type BoardContextType = {
  board: Board | null;
  loading: boolean;
  error: Error | null;
  refreshBoard: () => Promise<void>;
  updateTheme: (theme: 'light' | 'dark') => Promise<void>;
  createColumn: (title: string, width: number) => Promise<void>;
  updateColumn: (
    columnId: string,
    updates: { title?: string; width?: number }
  ) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;
  moveColumn: (columnId: string, newIndex: number) => Promise<void>;
  createCard: (
    columnId: string,
    cardData: Omit<Card, 'id' | 'columnId' | 'order'>
  ) => Promise<void>;
  updateCard: (
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>
  ) => Promise<void>;
  moveCard: (
    cardId: string,
    targetColumnId: string,
    newOrder: number,
    destinationIndex: number
  ) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  duplicateCard: (cardId: string, targetColumnId?: string) => Promise<void>;
  addLabel: (cardId: string, name: string, color: string) => Promise<void>;
  removeLabel: (cardId: string, labelId: string) => Promise<void>;
  addComment: (cardId: string, author: string, content: string) => Promise<void>;
  addAttachment: (
    cardId: string,
    name: string,
    url: string,
    type: string
  ) => Promise<void>;
  deleteComment: (cardId: string, commentId: string) => Promise<void>;
  deleteAttachment: (cardId: string, attachmentId: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
};

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export const BoardProvider = ({ children }: { children: ReactNode }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Generic error handler for service calls
  const handleServiceCall = async <T extends Board>(
    serviceCall: () => Promise<T>,
    showLoading: boolean = true,
    errorMessage: string = 'Error processing request'
  ): Promise<T | null> => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const updatedBoard = await serviceCall();
      setBoard(updatedBoard);
      return updatedBoard;
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error(`${errorMessage}:`, error);
      return null;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Load the board data on initial render
  useEffect(() => {
    refreshBoard();
  }, []);

  // Refresh the board data
  const refreshBoard = useCallback(async () => {
    await handleServiceCall(
      BoardService.getBoard,
      true,
      'Error loading board data'
    );
  }, []);

  // Update the board theme
  const updateTheme = useCallback(async (theme: 'light' | 'dark') => {
    await handleServiceCall(
      () => BoardService.updateTheme(theme),
      false,
      'Error updating theme'
    );
  }, []);

  // Create a new column
  const createColumn = useCallback(async (title: string, width: number) => {
    await handleServiceCall(
      () => BoardService.createColumn(title, width),
      true,
      'Error creating column'
    );
  }, []);

  // Update a column
  const updateColumn = useCallback(async (
    columnId: string,
    updates: { title?: string; width?: number }
  ) => {
    await handleServiceCall(
      () => BoardService.updateColumn(columnId, updates),
      true,
      'Error updating column'
    );
  }, []);

  // Delete a column
  const deleteColumn = useCallback(async (columnId: string) => {
    await handleServiceCall(
      () => BoardService.deleteColumn(columnId),
      true,
      'Error deleting column'
    );
  }, []);

  // Move a column to a different position (optimistic reorder)
  const moveColumn = useCallback(async (columnId: string, newIndex: number) => {
    // Optimistically reorder columns locally
    setBoard(prev => {
      if (!prev) return prev;
      const cols = [...prev.columns];
      const oldIndex = cols.findIndex(c => c.id === columnId);
      if (oldIndex === -1) return prev;
      const [moved] = cols.splice(oldIndex, 1);
      cols.splice(newIndex, 0, moved);
      return { ...prev, columns: cols };
    });
    // Persist and sync with server
    const result = await handleServiceCall(
      () => BoardService.moveColumn(columnId, newIndex),
      false,
      'Error moving column'
    );
    if (!result) {
      await refreshBoard();
    }
  }, [handleServiceCall, refreshBoard]);

  // Create a new card
  const createCard = useCallback(async (
    columnId: string,
    cardData: Omit<Card, 'id' | 'columnId' | 'order'>
  ) => {
    await handleServiceCall(
      () => BoardService.createCard(columnId, cardData),
      true,
      'Error creating card'
    );
  }, []);

  // Update a card
  const updateCard = useCallback(async (
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>
  ) => {
    await handleServiceCall(
      () => BoardService.updateCard(cardId, updates),
      true,
      'Error updating card'
    );
  }, []);

  // Move a card to a different column or position (optimistic index-based update)
  const moveCard = useCallback(
    async (
      cardId: string,
      targetColumnId: string,
      newOrder: number,
      destinationIndex: number
    ) => {
      // Optimistically reorder locally using array indices
      setBoard(prev => {
        if (!prev) return prev;
        // clone columns and cards
        const columns = prev.columns.map(col => ({ ...col, cards: [...col.cards] }));
        let movedCard: Card | undefined;
        let sourceColIdx: number | undefined;
        let sourceCardIdx: number | undefined;
        // locate card and its index
        columns.forEach((col, cIdx) => {
          const idx = col.cards.findIndex(c => c.id === cardId);
          if (idx !== -1) {
            movedCard = col.cards[idx];
            sourceColIdx = cIdx;
            sourceCardIdx = idx;
          }
        });
        if (movedCard !== undefined && sourceColIdx !== undefined && sourceCardIdx !== undefined) {
          // remove from source
          columns[sourceColIdx].cards.splice(sourceCardIdx, 1);
          // insert into target at given index
          const destColIdx = columns.findIndex(c => c.id === targetColumnId);
          if (destColIdx !== -1) {
            columns[destColIdx].cards.splice(destinationIndex, 0, movedCard);
          }
          // reassign order values for both source and destination columns
          [sourceColIdx, destColIdx].forEach(colIdx => {
            columns[colIdx].cards.forEach((card, idx) => {
              card.order = idx;
            });
          });
        }
        return { ...prev, columns };
      });

      // Persist & sync with server state
      const result = await handleServiceCall(
        () => BoardService.moveCard(cardId, targetColumnId, newOrder),
        false,
        'Error moving card'
      );
      if (!result) {
        await refreshBoard();
      }
    },
    [handleServiceCall, refreshBoard]
  );

  // Delete a card
  const deleteCard = useCallback(async (cardId: string) => {
    await handleServiceCall(
      () => BoardService.deleteCard(cardId),
      true,
      'Error deleting card'
    );
  }, []);

  // Duplicate a card
  const duplicateCard = useCallback(async (cardId: string, targetColumnId?: string) => {
    await handleServiceCall(
      () => BoardService.duplicateCard(cardId, targetColumnId),
      true,
      'Error duplicating card'
    );
  }, []);

  // Add a label to a card
  const addLabel = useCallback(async (cardId: string, name: string, color: string) => {
    await handleServiceCall(
      () => BoardService.addLabel(cardId, name, color),
      true,
      'Error adding label'
    );
  }, []);

  // Remove a label from a card
  const removeLabel = useCallback(async (cardId: string, labelId: string) => {
    await handleServiceCall(
      () => BoardService.removeLabel(cardId, labelId),
      true,
      'Error removing label'
    );
  }, []);

  // Add a comment to a card
  const addComment = useCallback(async (
    cardId: string,
    author: string,
    content: string
  ) => {
    await handleServiceCall(
      () => BoardService.addComment(cardId, author, content),
      true,
      'Error adding comment'
    );
  }, []);

  // Delete a comment from a card
  const deleteComment = useCallback(async (cardId: string, commentId: string) => {
    await handleServiceCall(
      () => BoardService.deleteComment(cardId, commentId),
      true,
      'Error deleting comment'
    );
  }, []);

  // Add an attachment to a card
  const addAttachment = useCallback(async (
    cardId: string,
    name: string,
    url: string,
    type: string
  ) => {
    await handleServiceCall(
      () => BoardService.addAttachment(cardId, name, url, type),
      true,
      'Error adding attachment'
    );
  }, []);

  // Delete an attachment from a card
  const deleteAttachment = useCallback(async (cardId: string, attachmentId: string) => {
    await handleServiceCall(
      () => BoardService.deleteAttachment(cardId, attachmentId),
      true,
      'Error deleting attachment'
    );
  }, []);

  return (
    <BoardContext.Provider
      value={useMemo(() => ({
        board,
        loading,
        error,
        refreshBoard,
        updateTheme,
        createColumn,
        updateColumn,
        deleteColumn,
        moveColumn,
        createCard,
        updateCard,
        moveCard,
        deleteCard,
        duplicateCard,
        addLabel,
        removeLabel,
        addComment,
        addAttachment,
        deleteComment,
        deleteAttachment,
        searchQuery,
        setSearchQuery,
      }), [
        board,
        loading,
        error,
        refreshBoard,
        updateTheme,
        createColumn,
        updateColumn,
        deleteColumn,
        moveColumn,
        createCard,
        updateCard,
        moveCard,
        deleteCard,
        duplicateCard,
        addLabel,
        removeLabel,
        addComment,
        addAttachment,
        deleteComment,
        deleteAttachment,
        searchQuery,
      ])}
    >
      {children}
    </BoardContext.Provider>
  );
};

// Custom hook to use the board context
export const useBoard = (): BoardContextType => {
  const context = useContext(BoardContext);
  
  if (context === undefined) {
    throw new Error('useBoard must be used within a BoardProvider');
  }
  
  return context;
}; 