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

interface CreateCardData {
  title: string;
  description?: string;
  columnId: string;
  boardId: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
  labelIds?: string[];
  assigneeIds?: string[];
}

async function createCardAPI(data: CreateCardData): Promise<Card> {
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

interface UpdateCardData {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
  labelIdsToAdd?: string[];
  labelIdsToRemove?: string[];
  assigneeIdsToAdd?: string[];
  assigneeIdsToRemove?: string[];
}

async function updateCardAPI(cardId: string, updates: UpdateCardData): Promise<Card> {
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

// Hook interfaces
export interface UseCardResult {
  card: Card | null;
  loading: boolean;
  error: Error | null;
  refreshCard: () => Promise<void>;
}

export interface UseCardsByColumnResult {
  cards: Card[];
  loading: boolean;
  error: Error | null;
  refreshCards: () => Promise<void>;
}

export interface CardUpdateInput {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
  labelIds?: string[];
  assigneeIds?: string[];
  labelIdsToAdd?: string[];
  labelIdsToRemove?: string[];
  assigneeIdsToAdd?: string[];
  assigneeIdsToRemove?: string[];
}

export interface UseCardMutationsResult {
  createCard: (data: CreateCardData) => Promise<Card | null>;
  updateCard: (cardId: string, updates: CardUpdateInput) => Promise<Card | null>;
  updateCardLabels: (cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[]) => Promise<Card | null>;
  updateCardAssignees: (cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[]) => Promise<Card | null>;
  moveCard: (cardId: string, targetColumnId: string, newOrder: number) => Promise<Card | null>;
  duplicateCard: (cardId: string, targetColumnId?: string) => Promise<Card | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  addAttachment: (cardId: string, data: FormData | { url: string; name: string; type?: string }) => Promise<unknown>;
  deleteAttachment: (cardId: string, attachmentId: string) => Promise<unknown>;
  isLoading: boolean;
}

// Hooks
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

export function useCardMutations(): UseCardMutationsResult {
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();

  const createCard = useCallback(async (data: CreateCardData): Promise<Card | null> => {
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

  const updateCard = useCallback(async (cardId: string, updates: CardUpdateInput): Promise<Card | null> => {
    setIsLoading(true);
    try {
      // Convert the update format to API format
      const apiUpdates: UpdateCardData = {};
      
      if (updates.title !== undefined) {
        apiUpdates.title = updates.title;
      }
      if (updates.description !== undefined) {
        apiUpdates.description = updates.description;
      }
      if (updates.priority !== undefined) {
        apiUpdates.priority = updates.priority;
      }
      if (updates.weight !== undefined) {
        apiUpdates.weight = updates.weight;
      }
      if (updates.dueDate !== undefined) {
        apiUpdates.dueDate = updates.dueDate;
      }
      
      // Handle label and assignee updates
      if (updates.labelIds !== undefined) {
        // If labelIds is provided, replace all labels
        apiUpdates.labelIdsToAdd = updates.labelIds;
        apiUpdates.labelIdsToRemove = []; // This will be handled by the API
      } else {
        if (updates.labelIdsToAdd !== undefined) {
          apiUpdates.labelIdsToAdd = updates.labelIdsToAdd;
        }
        if (updates.labelIdsToRemove !== undefined) {
          apiUpdates.labelIdsToRemove = updates.labelIdsToRemove;
        }
      }
      
      if (updates.assigneeIds !== undefined) {
        // If assigneeIds is provided, replace all assignees
        apiUpdates.assigneeIdsToAdd = updates.assigneeIds;
        apiUpdates.assigneeIdsToRemove = []; // This will be handled by the API
      } else {
        if (updates.assigneeIdsToAdd !== undefined) {
          apiUpdates.assigneeIdsToAdd = updates.assigneeIdsToAdd;
        }
        if (updates.assigneeIdsToRemove !== undefined) {
          apiUpdates.assigneeIdsToRemove = updates.assigneeIdsToRemove;
        }
      }

      const card = await updateCardAPI(cardId, apiUpdates);
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
      const newCardData: CreateCardData = {
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

  const addAttachment = useCallback(async (cardId: string, data: FormData | { url: string; name: string; type?: string }) => {
    let body: FormData | string;
    let headers: Record<string, string> = {};

    if (data instanceof FormData) {
      body = data;
    } else {
      // Handle URL attachments
      body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/api/cards/${cardId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Failed to add attachment: ${response.statusText}`);
    }

    return response.json();
  }, []);

  const deleteAttachment = useCallback(async (cardId: string, attachmentId: string) => {
    const response = await fetch(`/api/cards/${cardId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete attachment: ${response.statusText}`);
    }

    return response.json();
  }, []);

  return {
    createCard,
    updateCard,
    updateCardLabels,
    updateCardAssignees,
    moveCard,
    duplicateCard,
    deleteCard,
    addAttachment,
    deleteAttachment,
    isLoading,
  };
} 