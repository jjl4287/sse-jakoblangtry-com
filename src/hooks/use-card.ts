'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { Card } from '~/types';

// HTTP client functions for API calls
async function fetchCard(cardId: string): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch card: ${response.statusText}`);
  }

  return response.json();
}

async function fetchCardsByColumn(columnId: string): Promise<Card[]> {
  const response = await fetch(`/api/cards?columnId=${columnId}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch cards: ${response.statusText}`);
  }

  return response.json();
}

async function createCardAPI(data: {
  title: string;
  description?: string;
  columnId: string;
  boardId: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
  labelIds?: string[];
  assigneeIds?: string[];
}): Promise<Card> {
  const response = await fetch('/api/cards', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create card: ${response.statusText}`);
  }

  return response.json();
}

async function updateCardAPI(cardId: string, updates: {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
}): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update card: ${response.statusText}`);
  }

  return response.json();
}

async function updateCardLabelsAPI(cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[]): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ labelIdsToAdd, labelIdsToRemove }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update card labels: ${response.statusText}`);
  }

  return response.json();
}

async function updateCardAssigneesAPI(cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[]): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ assigneeIdsToAdd, assigneeIdsToRemove }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update card assignees: ${response.statusText}`);
  }

  return response.json();
}

async function moveCardAPI(cardId: string, targetColumnId: string, newOrder: number): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ targetColumnId, order: newOrder }),
  });

  if (!response.ok) {
    throw new Error(`Failed to move card: ${response.statusText}`);
  }

  // The move endpoint returns success message, fetch the updated card
  return await fetchCard(cardId);
}

async function deleteCardAPI(cardId: string): Promise<void> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete card: ${response.statusText}`);
  }
}

export interface UseCardResult {
  card: Card | null;
  loading: boolean;
  error: Error | null;
  refreshCard: () => Promise<void>;
}

export function useCard(cardId?: string): UseCardResult {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshCard = useCallback(async () => {
    if (!cardId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardData = await fetchCard(cardId);
      setCard(cardData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load card'));
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    refreshCard();
  }, [refreshCard]);

  return {
    card,
    loading,
    error,
    refreshCard,
  };
}

export interface UseCardsByColumnResult {
  cards: Card[];
  loading: boolean;
  error: Error | null;
  refreshCards: () => Promise<void>;
}

export function useCardsByColumn(columnId?: string): UseCardsByColumnResult {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refreshCards = useCallback(async () => {
    if (!columnId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cardsData = await fetchCardsByColumn(columnId);
      setCards(cardsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load cards'));
    } finally {
      setLoading(false);
    }
  }, [columnId]);

  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

  return {
    cards,
    loading,
    error,
    refreshCards,
  };
}

export interface UseCardMutationsResult {
  createCard: (data: {
    title: string;
    description?: string;
    columnId: string;
    boardId: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
    labelIds?: string[];
    assigneeIds?: string[];
  }) => Promise<Card | null>;
  updateCard: (cardId: string, updates: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
  }) => Promise<Card | null>;
  updateCardLabels: (cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[]) => Promise<Card | null>;
  updateCardAssignees: (cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[]) => Promise<Card | null>;
  moveCard: (cardId: string, targetColumnId: string, newOrder: number) => Promise<Card | null>;
  duplicateCard: (cardId: string, targetColumnId?: string) => Promise<Card | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function useCardMutations(): UseCardMutationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();

  const createCard = useCallback(async (data: {
    title: string;
    description?: string;
    columnId: string;
    boardId: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
    labelIds?: string[];
    assigneeIds?: string[];
  }): Promise<Card | null> => {
    setIsLoading(true);
    try {
      const card = await createCardAPI(data);
      toast.success('Card created successfully');
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create card';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCard = useCallback(async (cardId: string, updates: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
  }): Promise<Card | null> => {
    setIsLoading(true);
    try {
      const card = await updateCardAPI(cardId, updates);
      toast.success('Card updated successfully');
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update card';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCardLabels = useCallback(async (
    cardId: string, 
    labelIdsToAdd: string[], 
    labelIdsToRemove: string[]
  ): Promise<Card | null> => {
    setIsLoading(true);
    try {
      const card = await updateCardLabelsAPI(cardId, labelIdsToAdd, labelIdsToRemove);
      toast.success('Card labels updated successfully');
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update card labels';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCardAssignees = useCallback(async (
    cardId: string, 
    assigneeIdsToAdd: string[], 
    assigneeIdsToRemove: string[]
  ): Promise<Card | null> => {
    setIsLoading(true);
    try {
      const card = await updateCardAssigneesAPI(cardId, assigneeIdsToAdd, assigneeIdsToRemove);
      toast.success('Card assignees updated successfully');
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update card assignees';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const moveCard = useCallback(async (
    cardId: string, 
    targetColumnId: string, 
    newOrder: number
  ): Promise<Card | null> => {
    // Don't show loading state or toasts for move operations to support optimistic updates
    try {
      const card = await moveCardAPI(cardId, targetColumnId, newOrder);
      // No success toast for move operations - they should be optimistic
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move card';
      toast.error(message);
      return null;
    }
  }, []);

  const duplicateCard = useCallback(async (
    cardId: string, 
    targetColumnId?: string
  ): Promise<Card | null> => {
    setIsLoading(true);
    try {
      // First fetch the original card data
      const originalCard = await fetchCard(cardId);
      
      // Create a new card with the same data
      const newCardData = {
        title: `${originalCard.title} (Copy)`,
        description: originalCard.description,
        columnId: targetColumnId || originalCard.columnId,
        boardId: originalCard.boardId,
        priority: originalCard.priority,
        weight: originalCard.weight,
        dueDate: originalCard.dueDate,
        labelIds: originalCard.labels?.map(label => label.id) || [],
        assigneeIds: originalCard.assignees?.map(assignee => assignee.id) || [],
      };
      
      const card = await createCardAPI(newCardData);
      toast.success('Card duplicated successfully');
      return card;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to duplicate card';
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await deleteCardAPI(cardId);
      toast.success('Card deleted successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete card';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createCard,
    updateCard,
    updateCardLabels,
    updateCardAssignees,
    moveCard,
    duplicateCard,
    deleteCard,
    isLoading,
  };
} 