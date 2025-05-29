import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BoardMembership, User } from '~/types';
import { localStorageService } from '~/lib/services/local-storage-service';

// HTTP client functions for API calls
async function fetchBoardMembers(boardId: string): Promise<BoardMembership[]> {
  const response = await fetch(`/api/boards/${boardId}/members`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch board members: ${response.statusText}`);
  }

  return response.json();
}

export function useBoardMembers(boardId: string | null) {
  const [members, setMembers] = useState<BoardMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!boardId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    // Check if this is a local board - if so, skip API calls
    if (localStorageService.isLocalBoard(boardId)) {
      console.log('Skipping member fetch for local board:', boardId);
      setMembers([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const members = await fetchBoardMembers(boardId);
      setMembers(members);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch members'));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  const refetch = useCallback(() => {
    return fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Extract users from memberships for easier consumption
  const availableUsers = useMemo(() => {
    return members.map(membership => membership.user);
  }, [members]);

  return {
    members,
    availableUsers,
    loading,
    error,
    refetch
  };
} 