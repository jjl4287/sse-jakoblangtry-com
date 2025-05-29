'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { BoardOptimized } from '../board/BoardOptimized';
import { ModernSidebar } from '~/components/layout/ModernSidebar';
import { LayoutGroup } from 'framer-motion';
import { localStorageService } from '~/lib/services/local-storage-service';
import { boardMigrationService, type MigrationResult } from '~/lib/services/board-migration-service';
import { LocalBoardBanner } from './LocalBoardBanner';
import { toast } from 'react-hot-toast';

export default function BoardLayout() {
  return <InnerBoardLayout />;
}

const InnerBoardLayout: React.FC = () => {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<{ id: string; title: string; pinned: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignInBanner, setShowSignInBanner] = useState(false);
  const [focusRenameId, setFocusRenameId] = useState<string | null>(null);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [migrationChecked, setMigrationChecked] = useState(false);

  // Select a board by ID: update URL without triggering unnecessary API calls
  const handleSelectBoard = useCallback((id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    setCurrentBoardId(id);
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  // Pin or unpin a board by ID
  const handlePinBoard = () => {
    // TODO: Implement pin/unpin functionality
  };

  // Delete a board by ID
  const handleDeleteBoard = async (id: string) => {
    // Check if it's a local board
    if (localStorageService.isLocalBoard(id)) {
      localStorageService.deleteLocalBoard(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      return;
    }

    // Handle remote board deletion
    if (session) {
      try {
        const response = await fetch(`/api/boards/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete board');
      } catch (error: unknown) {
        console.error('Error deleting board:', String(error));
      }
    }
    // Always remove from local state
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // Rename a board title (updates local state optimistically)
  const handleRenameBoard = async (id: string, title: string) => {
    // Update local list immediately
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title } : p));
    
    // Check if it's a local board
    if (localStorageService.isLocalBoard(id)) {
      localStorageService.updateLocalBoard(id, { title });
      return;
    }

    // Background API call for persistence for remote boards
    if (session) {
      try {
        const response = await fetch(`/api/boards/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update board title');
        }
      } catch (error) {
        console.error('Error renaming board:', error);
        // Revert on error for remote boards
        const response = await fetch('/api/boards');
        if (response.ok) {
          const remoteBoards = await response.json() as { id: string; title: string; pinned: boolean }[];
          const localBoards = localStorageService.getLocalBoards();
          const combinedBoards = [
            ...localBoards.map(b => ({ id: b.id, title: b.title, pinned: b.pinned })),
            ...remoteBoards
          ];
          setProjects(combinedBoards);
        }
      }
    }
  };

  // Load both local and remote boards
  const loadAllBoards = useCallback(async () => {
    try {
      // Always load local boards first
      const localBoards = localStorageService.getLocalBoards();
      const localBoardItems = localBoards.map(b => ({
        id: b.id,
        title: b.title,
        pinned: b.pinned
      }));

      // If user is authenticated, fetch remote boards too
      let remoteBoards: { id: string; title: string; pinned: boolean }[] = [];
      if (session) {
        try {
          const response = await fetch('/api/boards');
          if (response.ok) {
            const data = await response.json() as { id: string; title: string; pinned: boolean }[];
            remoteBoards = data;
          }
        } catch (error) {
          console.error('Error fetching remote boards:', error);
        }
      }

      // Combine local and remote boards (local first to maintain order)
      const allBoards = [...localBoardItems, ...remoteBoards];
      setProjects(allBoards);

      // Handle board selection from URL
      const params = new URLSearchParams(window.location.search);
      const boardId = params.get('boardId');
      if (boardId) {
        setCurrentBoardId(boardId);
      } else if (allBoards.length > 0) {
        handleSelectBoard(allBoards[0]!.id);
      }
    } catch (error: unknown) {
      console.error('Error loading boards:', String(error));
    }
  }, [session, handleSelectBoard]);

  // Handle user authentication status changes
  useEffect(() => {
    if (status === 'loading') return; // Don't do anything while loading

    if (session) {
      // Only check for migration if we haven't already checked and user has local boards
      if (!migrationChecked && boardMigrationService.hasBoardsToMigrate()) {
        setMigrationChecked(true);
        void handleMigration();
      } else {
        void loadAllBoards();
      }
    } else {
      // User is not signed in - reset migration check and load local boards only
      setMigrationChecked(false);
      void loadAllBoards();
    }
  }, [session, status, loadAllBoards, migrationChecked]);

  // Listen for board title updates from optimized mutations
  useEffect(() => {
    const handleBoardTitleUpdated = (event: CustomEvent<{ boardId: string; updates: { title?: string } }>) => {
      const { boardId, updates } = event.detail;
      if (updates.title) {
        // Update the board title in the sidebar list
        setProjects(prev => prev.map(p => 
          p.id === boardId ? { ...p, title: updates.title! } : p
        ));
      }
    };

    window.addEventListener('boardTitleUpdated', handleBoardTitleUpdated as EventListener);
    
    return () => {
      window.removeEventListener('boardTitleUpdated', handleBoardTitleUpdated as EventListener);
    };
  }, []);

  // Handle migration when user signs in
  const handleMigration = async () => {
    try {
      const result = await boardMigrationService.migrateLocalBoards();
      setMigrationResult(result);
      
      if (result.success) {
        if (result.migratedCount > 0) {
          setShowMigrationBanner(true);
          toast.success(`Successfully migrated ${result.migratedCount} local board${result.migratedCount !== 1 ? 's' : ''} to your account!`);
        }
        // Reload boards after successful migration
        void loadAllBoards();
      } else {
        toast.error('Some boards could not be migrated. Check the migration details.');
        setShowMigrationBanner(true);
        // Still reload to show what was migrated
        void loadAllBoards();
      }
    } catch (error) {
      console.error('Migration failed:', error);
      toast.error('Failed to migrate local boards. Please try signing in again.');
      // Load boards anyway to show current state
      void loadAllBoards();
    }
  };

  // Create a new board with optimistic updates
  const createBoard = async (title: string): Promise<string> => {
    // For unauthenticated users: create local board only
    if (!session) {
      const localBoard = localStorageService.createLocalBoard(title);
      
      setProjects(prev => [
        { id: localBoard.id, title: localBoard.title, pinned: localBoard.pinned },
        ...prev
      ]);
      handleSelectBoard(localBoard.id);
      setShowSignInBanner(true);
      setFocusRenameId(localBoard.id);
      return localBoard.id;
    }
    
    // Optimistic update for authenticated users
    const tempId = `temp_${Date.now()}`;
    const tempBoard = { id: tempId, title, pinned: false };
    setProjects(prev => [tempBoard, ...prev]);
    setFocusRenameId(tempId);
    
    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('Failed to create board');
      const newBoard = await response.json() as { id: string; title: string; pinned: boolean };
      
      // Replace temp board with real board
      setProjects(prev => prev.map(p => p.id === tempId ? newBoard : p));
      setFocusRenameId(newBoard.id);
      handleSelectBoard(newBoard.id);
      return newBoard.id;
    } catch (error: unknown) {
      console.error('Error creating board:', String(error));
      // Remove temp board on error
      setProjects(prev => prev.filter(p => p.id !== tempId));
      throw error;
    }
  };

  return (
    <div className="flex h-screen transition-all duration-250 ease-out">
      <LayoutGroup>
        <ModernSidebar
          boards={projects}
          onSelect={handleSelectBoard}
          onCreate={createBoard}
          onPin={handlePinBoard}
          onDelete={handleDeleteBoard}
          onRename={handleRenameBoard}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          selectedBoardId={currentBoardId}
        />
        <div className="flex flex-col flex-1 transition-all duration-250 ease-out">
          <BoardOptimized
            focusEditTitleBoardId={focusRenameId}
            clearFocusEdit={() => setFocusRenameId(null)}
            sidebarOpen={sidebarOpen}
            boardId={currentBoardId}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>
      </LayoutGroup>
      
      {/* Enhanced banner for local boards */}
      {showSignInBanner && !session && (
        <LocalBoardBanner onClose={() => setShowSignInBanner(false)} />
      )}

      {/* Migration result banner */}
      {showMigrationBanner && migrationResult && (
        <div className="fixed top-0 left-0 right-0 bg-green-100 text-green-900 p-3 text-center z-50 shadow-lg border-b border-green-200">
          <div className="font-medium">
            {migrationResult.success 
              ? `Successfully migrated ${migrationResult.migratedCount} board${migrationResult.migratedCount !== 1 ? 's' : ''} to your account!`
              : 'Some boards could not be migrated. Please check the details.'
            }
          </div>
          <button 
            onClick={() => setShowMigrationBanner(false)} 
            className="absolute top-2 right-3 text-green-700 hover:text-green-900 transition-colors"
            aria-label="Close migration banner"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};