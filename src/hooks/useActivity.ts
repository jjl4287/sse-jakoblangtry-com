import { useState, useEffect, useCallback } from 'react';
import { localStorageService } from '~/lib/services/local-storage-service';
import type { ActivityLog } from '~/types';

// HTTP client functions for API calls
async function fetchCardActivity(cardId: string): Promise<ActivityLog[]> {
  const response = await fetch(`/api/cards/${cardId}/activity`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch card activity: ${response.statusText}`);
  }

  return response.json();
}

// Check if a card belongs to a local board
function isLocalCard(cardId: string): boolean {
  // Try to find the card in any local board
  const localBoards = localStorageService.getLocalBoards();
  return localBoards.some(board =>
    board.columns.some(column =>
      column.cards.some(card => card.id === cardId)
    )
  );
}

export function useCardActivity(cardId: string | undefined | null) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!cardId) {
      setActivityLogs([]);
      setLoading(false);
      return;
    }

    // Check if this is a local card
    if (isLocalCard(cardId)) {
      console.log('Skipping activity fetch for local card:', cardId);
      setActivityLogs([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const activity = await fetchCardActivity(cardId);
      setActivityLogs(activity);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
      setActivityLogs([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  const refetch = useCallback(() => {
    return fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    activityLogs,
    loading,
    error,
    refetch
  };
} 