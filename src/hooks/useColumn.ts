import { useCallback, useState } from 'react';
import type { Column } from '~/types';
import { toast } from 'sonner';

// HTTP client functions for API calls
async function updateColumnAPI(columnId: string, updates: {
  title?: string;
  width?: number;
}): Promise<Column> {
  const response = await fetch(`/api/columns/${columnId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update column: ${response.statusText}`);
  }

  return response.json();
}

async function deleteColumnAPI(columnId: string): Promise<void> {
  const response = await fetch(`/api/columns/${columnId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete column: ${response.statusText}`);
  }
}

async function createColumnAPI(data: {
  title: string;
  width: number;
  boardId: string;
}): Promise<Column> {
  const response = await fetch('/api/columns', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create column: ${response.statusText}`);
  }

  return response.json();
}

export interface UseColumnMutationsResult {
  createColumn: (boardId: string, data: { title: string; width: number }) => Promise<Column | null>;
  updateColumn: (columnId: string, updates: { title?: string; width?: number }) => Promise<Column | null>;
  reorderColumns: (boardId: string, columnOrders: { id: string; order: number }[]) => Promise<Column[] | null>;
  deleteColumn: (columnId: string) => Promise<boolean>;
  isLoading: boolean;
}

export function useColumnMutations() {
  const [isLoading, setIsLoading] = useState(false);

  const updateColumn = useCallback(async (columnId: string, updates: Partial<Column>) => {
    // Extract only the fields that the API supports
    const apiUpdates: { title?: string; width?: number } = {};
    if (updates.title !== undefined) {
      apiUpdates.title = updates.title;
    }
    if (updates.width !== undefined) {
      apiUpdates.width = updates.width;
    }
    
    return await updateColumnAPI(columnId, apiUpdates);
  }, []);

  const deleteColumn = useCallback(async (columnId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await deleteColumnAPI(columnId);
      toast.success('Column deleted successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete column';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createColumn = useCallback(async (boardId: string, data: { title: string; width?: number }) => {
    const columnData = {
      title: data.title,
      width: data.width || 300,
      boardId
    };
    return await createColumnAPI(columnData);
  }, []);

  const reorderColumns = useCallback(async (
    boardId: string, 
    columnOrders: { id: string; order: number }[]
  ): Promise<Column[] | null> => {
    // Don't show loading state for reordering to support optimistic updates
    try {
      const response = await fetch('/api/columns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ boardId, columnOrders }),
      });

      if (!response.ok) {
        throw new Error(`Failed to reorder columns: ${response.statusText}`);
      }

      const result = await response.json();
      // No success toast for reordering - should be optimistic
      return result.columns;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder columns';
      toast.error(message);
      return null;
    }
  }, []);

  return {
    createColumn,
    updateColumn,
    reorderColumns,
    deleteColumn,
    isLoading,
  };
} 