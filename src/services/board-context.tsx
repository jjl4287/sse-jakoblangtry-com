'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
    newOrder: number
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

  // Load the board data on initial render
  useEffect(() => {
    refreshBoard();
  }, []);

  // Refresh the board data
  const refreshBoard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await BoardService.getBoard();
      setBoard(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error loading board data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update the board theme
  const updateTheme = async (theme: 'light' | 'dark') => {
    try {
      // Don't set loading to true for theme updates to avoid page refresh
      const updatedBoard = await BoardService.updateTheme(theme);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error updating theme:', err);
    }
  };

  // Create a new column
  const createColumn = async (title: string, width: number) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.createColumn(title, width);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error creating column:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update a column
  const updateColumn = async (
    columnId: string,
    updates: { title?: string; width?: number }
  ) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.updateColumn(columnId, updates);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error updating column:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete a column
  const deleteColumn = async (columnId: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.deleteColumn(columnId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error deleting column:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create a new card
  const createCard = async (
    columnId: string,
    cardData: Omit<Card, 'id' | 'columnId' | 'order'>
  ) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.createCard(columnId, cardData);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error creating card:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update a card
  const updateCard = async (
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>
  ) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.updateCard(cardId, updates);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error updating card:', err);
    } finally {
      setLoading(false);
    }
  };

  // Move a card to a different column or position
  const moveCard = async (
    cardId: string,
    targetColumnId: string,
    newOrder: number
  ) => {
    try {
      // Don't set loading to true for card moves to avoid UI flashing
      // This allows framer-motion to handle the animations smoothly
      const updatedBoard = await BoardService.moveCard(
        cardId,
        targetColumnId,
        newOrder
      );
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error moving card:', err);
    }
  };

  // Delete a card
  const deleteCard = async (cardId: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.deleteCard(cardId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error deleting card:', err);
    } finally {
      setLoading(false);
    }
  };

  // Duplicate a card
  const duplicateCard = async (cardId: string, targetColumnId?: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.duplicateCard(cardId, targetColumnId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error duplicating card:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a label to a card
  const addLabel = async (cardId: string, name: string, color: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.addLabel(cardId, name, color);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error adding label:', err);
    } finally {
      setLoading(false);
    }
  };

  // Remove a label from a card
  const removeLabel = async (cardId: string, labelId: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.removeLabel(cardId, labelId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error removing label:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add a comment to a card
  const addComment = async (
    cardId: string,
    author: string,
    content: string
  ) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.addComment(
        cardId,
        author,
        content
      );
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error adding comment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete a comment from a card
  const deleteComment = async (cardId: string, commentId: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.deleteComment(cardId, commentId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error deleting comment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add an attachment to a card
  const addAttachment = async (
    cardId: string,
    name: string,
    url: string,
    type: string
  ) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.addAttachment(
        cardId,
        name,
        url,
        type
      );
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error adding attachment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete an attachment from a card
  const deleteAttachment = async (cardId: string, attachmentId: string) => {
    try {
      setLoading(true);
      const updatedBoard = await BoardService.deleteAttachment(cardId, attachmentId);
      setBoard(updatedBoard);
    } catch (err) {
      setError(err as Error);
      console.error('Error deleting attachment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BoardContext.Provider
      value={{
        board,
        loading,
        error,
        refreshBoard,
        updateTheme,
        createColumn,
        updateColumn,
        deleteColumn,
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
      }}
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