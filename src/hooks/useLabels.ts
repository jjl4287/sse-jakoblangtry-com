import { useState, useEffect, useCallback } from 'react';
import type { Label } from '~/types';

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