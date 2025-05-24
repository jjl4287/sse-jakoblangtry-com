import { useState, useEffect, useCallback } from 'react';
import type { ActivityLog } from '~/types';

// HTTP client functions for API calls
async function fetchCardActivity(cardId: string): Promise<ActivityLog[]> {
  const response = await fetch(`/api/cards/${cardId}/activity`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity: ${response.statusText}`);
  }

  return response.json();
}

export function useCardActivity(cardId: string | null) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!cardId) {
      setActivityLogs([]);
      setLoading(false);
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