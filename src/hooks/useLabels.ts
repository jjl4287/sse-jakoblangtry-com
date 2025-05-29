import { useState, useEffect, useCallback } from 'react';
import type { Label } from '~/types';
import { localStorageService } from '~/lib/services/local-storage-service';

// HTTP client functions for API calls
async function fetchBoardLabels(boardId: string): Promise<Label[]> {
  const response = await fetch(`/api/boards/${boardId}/labels`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch board labels: ${response.statusText}`);
  }

  return response.json();
}

async function createLabelAPI(boardId: string, data: {
  name: string;
  color: string;
}): Promise<Label> {
  const response = await fetch(`/api/boards/${boardId}/labels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create label: ${response.statusText}`);
  }

  return response.json();
}

async function updateLabelAPI(labelId: string, data: {
  name?: string;
  color?: string;
}): Promise<Label> {
  const response = await fetch(`/api/boards/[boardId]/labels/${labelId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update label: ${response.statusText}`);
  }

  return response.json();
}

async function deleteLabelAPI(labelId: string): Promise<void> {
  const response = await fetch(`/api/boards/[boardId]/labels/${labelId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete label: ${response.statusText}`);
  }
}

// Generate a default set of labels for local boards
function getDefaultLabels(boardId: string): Label[] {
  return [
    { id: `${boardId}_label_bug`, name: 'Bug', color: '#ef4444', boardId },
    { id: `${boardId}_label_feature`, name: 'Feature', color: '#3b82f6', boardId },
    { id: `${boardId}_label_enhancement`, name: 'Enhancement', color: '#8b5cf6', boardId },
    { id: `${boardId}_label_urgent`, name: 'Urgent', color: '#f59e0b', boardId },
    { id: `${boardId}_label_low_priority`, name: 'Low Priority', color: '#6b7280', boardId }
  ];
}

export function useBoardLabels(boardId: string | null) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLabels = useCallback(async () => {
    if (!boardId) {
      setLabels([]);
      setLoading(false);
      return;
    }

    // Check if this is a local board
    if (localStorageService.isLocalBoard(boardId)) {
      console.log('Loading labels for local board:', boardId);
      setLoading(true);
      
      try {
        const localBoard = localStorageService.getLocalBoard(boardId);
        if (localBoard) {
          // Convert local labels to Label format, or use defaults if none exist
          const localLabels = localBoard.labels?.map(label => ({
            id: label.id,
            name: label.name,
            color: label.color,
            boardId: boardId
          })) || getDefaultLabels(boardId);
          
          setLabels(localLabels);
        } else {
          setLabels(getDefaultLabels(boardId));
        }
        setError(null);
      } catch (err) {
        console.error('Error loading local board labels:', err);
        setLabels(getDefaultLabels(boardId));
        setError(null); // Don't show error for local boards, just use defaults
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const labels = await fetchBoardLabels(boardId);
      setLabels(labels);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch labels'));
      setLabels([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const refetch = useCallback(() => {
    return fetchLabels();
  }, [fetchLabels]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return {
    labels,
    loading,
    error,
    refetch
  };
}

export function useLabelMutations() {
  const createLabel = useCallback(async (boardId: string, data: { name: string; color: string }) => {
    return await createLabelAPI(boardId, data);
  }, []);

  const updateLabel = useCallback(async (labelId: string, data: { name?: string; color?: string }) => {
    return await updateLabelAPI(labelId, data);
  }, []);

  const deleteLabel = useCallback(async (labelId: string) => {
    await deleteLabelAPI(labelId);
  }, []);

  return {
    createLabel,
    updateLabel,
    deleteLabel
  };
} 