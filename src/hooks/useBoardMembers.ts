import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BoardMembership, User } from '~/types';

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