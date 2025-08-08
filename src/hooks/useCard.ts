'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import type { Card } from '~/types';
import { localStorageService } from '~/lib/services/local-storage-service';

// Import the board cache invalidation function
let invalidateBoardCache: ((boardId: string) => void) | null = null;

// Dynamic import to avoid circular dependencies
const getBoardCacheInvalidator = async () => {
  if (!invalidateBoardCache) {
    try {
      const { useBoardOptimized } = await import('~/hooks/useBoardOptimized');
      // We'll need to create a global cache invalidation function
      // For now, we'll trigger a page refresh or use other methods
    } catch (error) {
      console.error('Could not import board cache functions:', error);
    }
  }
  return invalidateBoardCache;
};

// Helper to trigger board data refresh for local boards
const triggerBoardRefresh = (boardId: string) => {
  // Since we can't easily access the board cache directly due to React hooks rules,
  // we'll dispatch a custom event that the board component can listen to
  window.dispatchEvent(new CustomEvent('localBoardDataChanged', { 
    detail: { boardId } 
  }));
};

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
      // Check if this is for a local board by checking the column
      // We need to determine the board ID from the columnId
      let isLocalBoard = false;
      
      // For local boards, check if the columnId starts with local_ or if it's in local storage
      if (data.columnId.startsWith('local_')) {
        isLocalBoard = true;
      } else {
        // Check if this column belongs to a local board
        const localBoards = localStorageService.getLocalBoards();
        isLocalBoard = localBoards.some(board => 
          board.columns.some(col => col.id === data.columnId)
        );
      }
      
      if (isLocalBoard) {
        // Handle local board card creation
        console.log('Creating card for local board via local storage');
        
        // Find the board that contains this column
        const localBoards = localStorageService.getLocalBoards();
        let targetBoard = null;
        
        for (const board of localBoards) {
          if (board.columns.some(col => col.id === data.columnId)) {
            targetBoard = board;
            break;
          }
        }
        
        if (!targetBoard) {
          throw new Error('Local board not found for this column');
        }
        
        // Create the card in local storage
        const newCard = localStorageService.createLocalCard(
          targetBoard.id,
          data.columnId,
          {
            title: data.title,
            description: data.description,
            priority: data.priority,
            dueDate: data.dueDate,
            weight: data.weight
          }
        );
        
        if (!newCard) {
          throw new Error('Failed to create card in local storage');
        }
        
        // Convert to API format for consistent return type
        const apiCard: Card = {
          id: newCard.id,
          title: newCard.title,
          description: newCard.description,
          columnId: newCard.columnId,
          order: newCard.order,
          priority: newCard.priority,
          dueDate: newCard.dueDate,
          weight: newCard.weight,
          labels: newCard.labels || [],
          assignees: [], // Local boards don't support assignees
          attachments: newCard.attachments || [],
          comments: [] // Local boards don't support comments yet
        };
        
        toast.success('Card created successfully');
        triggerBoardRefresh(targetBoard.id);
        return apiCard;
      } else {
        // Handle remote board card creation via API
        const card = await createCardAPI(data);
        toast.success('Card created successfully');
        return card;
      }
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
      // Check if this is a local board card
      const isLocalCard = cardId.startsWith('local_') || localStorageService.getLocalBoards().some(board =>
        board.columns.some(col => col.cards.some(card => card.id === cardId))
      );
      
      if (isLocalCard) {
        // Handle local board card update
        console.log('Updating card for local board via local storage');
        
        // Find the board that contains this card
        const localBoards = localStorageService.getLocalBoards();
        let targetBoard = null;
        
        for (const board of localBoards) {
          if (board.columns.some(col => col.cards.some(card => card.id === cardId))) {
            targetBoard = board;
            break;
          }
        }
        
        if (!targetBoard) {
          throw new Error('Local board not found for this card');
        }
        
        // Convert updates to local storage format
        const localUpdates: Partial<{
          title: string;
          description: string;
          priority: 'low' | 'medium' | 'high' | 'urgent';
          weight: number;
          dueDate: Date;
        }> = {};
        if (updates.title !== undefined) localUpdates.title = updates.title;
        if (updates.description !== undefined) localUpdates.description = updates.description;
        if (updates.priority !== undefined) localUpdates.priority = updates.priority;
        if (updates.weight !== undefined) localUpdates.weight = updates.weight;
        if (updates.dueDate !== undefined) localUpdates.dueDate = updates.dueDate;
        
        // Update the card in local storage
        const updatedCard = localStorageService.updateLocalCard(targetBoard.id, cardId, localUpdates);
        
        if (!updatedCard) {
          throw new Error('Failed to update card in local storage');
        }
        
        // Convert to API format for consistent return type
        const apiCard: Card = {
          id: updatedCard.id,
          title: updatedCard.title,
          description: updatedCard.description,
          columnId: updatedCard.columnId,
          order: updatedCard.order,
          priority: updatedCard.priority,
          dueDate: updatedCard.dueDate,
          weight: updatedCard.weight,
          labels: updatedCard.labels || [],
          assignees: [], // Local boards don't support assignees
          attachments: updatedCard.attachments || [],
          comments: [] // Local boards don't support comments yet
        };
        
        toast.success('Card updated successfully');
        triggerBoardRefresh(targetBoard.id);
        return apiCard;
      } else {
        // Handle remote board card update via API
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
        triggerBoardRefresh(card.boardId);
        return card;
      }
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
      triggerBoardRefresh(card.boardId);
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
      triggerBoardRefresh(card.boardId);
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
      triggerBoardRefresh(card.boardId);
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
      triggerBoardRefresh(card.boardId);
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
      // Check if this is a local board card
      const isLocalCard = cardId.startsWith('local_') || localStorageService.getLocalBoards().some(board =>
        board.columns.some(col => col.cards.some(card => card.id === cardId))
      );
      
      if (isLocalCard) {
        // Handle local board card deletion
        console.log('Deleting card for local board via local storage');
        
        // Find the board that contains this card
        const localBoards = localStorageService.getLocalBoards();
        let targetBoard = null;
        
        for (const board of localBoards) {
          if (board.columns.some(col => col.cards.some(card => card.id === cardId))) {
            targetBoard = board;
            break;
          }
        }
        
        if (!targetBoard) {
          throw new Error('Local board not found for this card');
        }
        
        // Delete the card from local storage
        const success = localStorageService.deleteLocalCard(targetBoard.id, cardId);
        
        if (!success) {
          throw new Error('Failed to delete card from local storage');
        }
        
        toast.success('Card deleted successfully');
        triggerBoardRefresh(targetBoard.id);
        return true;
      } else {
        // Handle remote board card deletion via API
        // We need to get the boardId before deletion for the refresh
        let remoteBoardId = null;
        try {
          const cardData = await fetchCard(cardId);
          remoteBoardId = cardData.boardId;
        } catch (error) {
          console.warn('Could not fetch card data for board refresh');
        }
        
        await deleteCardAPI(cardId);
        toast.success('Card deleted successfully');
        
        if (remoteBoardId) {
          triggerBoardRefresh(remoteBoardId);
        }
        return true;
      }
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