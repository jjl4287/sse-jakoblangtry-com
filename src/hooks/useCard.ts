import { useCallback } from 'react';
import type { Card } from '~/types';

// HTTP client functions for API calls
async function updateCardAPI(cardId: string, updates: {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  dueDate?: Date;
  labelIdsToAdd?: string[];
  labelIdsToRemove?: string[];
  assigneeIdsToAdd?: string[];
  assigneeIdsToRemove?: string[];
  labelIds?: string[];
  assigneeIds?: string[];
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

async function deleteCardAPI(cardId: string): Promise<void> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete card: ${response.statusText}`);
  }
}

export function useCardMutations() {
  const updateCard = useCallback(async (cardId: string, updates: Partial<Card> & {
    labelIds?: string[];
    assigneeIds?: string[];
    labelIdsToAdd?: string[];
    labelIdsToRemove?: string[];
    assigneeIdsToAdd?: string[];
    assigneeIdsToRemove?: string[];
  }) => {
    // Extract only the fields that the API supports
    const apiUpdates: {
      title?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      weight?: number;
      dueDate?: Date;
      labelIdsToAdd?: string[];
      labelIdsToRemove?: string[];
      assigneeIdsToAdd?: string[];
      assigneeIdsToRemove?: string[];
    } = {};
    
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
      // If labelIds is provided, we need to calculate what to add/remove
      // This is a simple approach - could be optimized
      apiUpdates.labelIdsToAdd = updates.labelIds;
      apiUpdates.labelIdsToRemove = []; // Remove all first, then add the new ones
    } else {
      if (updates.labelIdsToAdd !== undefined) {
        apiUpdates.labelIdsToAdd = updates.labelIdsToAdd;
      }
      if (updates.labelIdsToRemove !== undefined) {
        apiUpdates.labelIdsToRemove = updates.labelIdsToRemove;
      }
    }
    
    if (updates.assigneeIds !== undefined) {
      // If assigneeIds is provided, we need to calculate what to add/remove
      apiUpdates.assigneeIdsToAdd = updates.assigneeIds;
      apiUpdates.assigneeIdsToRemove = []; // Remove all first, then add the new ones
    } else {
      if (updates.assigneeIdsToAdd !== undefined) {
        apiUpdates.assigneeIdsToAdd = updates.assigneeIdsToAdd;
      }
      if (updates.assigneeIdsToRemove !== undefined) {
        apiUpdates.assigneeIdsToRemove = updates.assigneeIdsToRemove;
      }
    }
    
    return await updateCardAPI(cardId, apiUpdates);
  }, []);

  const createCard = useCallback(async (columnId: string, data: Partial<Card> & { boardId?: string }) => {
    const cardData = {
      title: data.title || 'New Card',
      description: data.description,
      columnId,
      boardId: data.boardId || '', // This should be passed by the caller
      priority: data.priority || 'medium',
      weight: data.weight,
      dueDate: data.dueDate,
      labelIds: (data as any).labelIds || [],
      assigneeIds: (data as any).assigneeIds || []
    };
    return await createCardAPI(cardData);
  }, []);

  const deleteCard = useCallback(async (cardId: string) => {
    await deleteCardAPI(cardId);
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
    updateCard,
    createCard,
    deleteCard,
    addAttachment,
    deleteAttachment
  };
}

export const useCard = useCardMutations; // Alias for consistency 