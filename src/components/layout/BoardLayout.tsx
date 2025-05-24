'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { BoardOptimized } from '../board/BoardOptimized';
import { ThemeProvider } from '~/contexts/ThemeContext';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from '~/components/layout/Sidebar';
import { motion } from 'framer-motion';

export default function BoardLayout() {
  return (
    <ThemeProvider>
      <InnerBoardLayout />
    </ThemeProvider>
  );
}

const InnerBoardLayout: React.FC = () => {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<{ id: string; title: string; pinned: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignInBanner, setShowSignInBanner] = useState(false);
  const [focusRenameId, setFocusRenameId] = useState<string | null>(null);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  // Select a board by ID: update URL without triggering unnecessary API calls
  const handleSelectBoard = useCallback((id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    setCurrentBoardId(id);
  }, []);

  // Pin or unpin a board by ID
  const handlePinBoard = () => {
    // TODO: Implement pin/unpin functionality
  };

  // Delete a board by ID
  const handleDeleteBoard = async (id: string) => {
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
    
    // Background API call for persistence
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
        // Revert on error
        const response = await fetch('/api/boards');
        if (response.ok) {
          const boards = await response.json();
          setProjects(boards);
        }
      }
    }
  };

  useEffect(() => {
    // Optimized board list fetch with caching
    const fetchBoards = async () => {
      try {
        const response = await fetch('/api/boards');
        if (!response.ok) throw new Error('Failed to fetch boards');
        const boards = await response.json() as { id: string; title: string; pinned: boolean }[];
        if (boards.length === 0) return;
        setProjects(boards);
        
        const params = new URLSearchParams(window.location.search);
        const boardId = params.get('boardId');
        if (boardId) {
          setCurrentBoardId(boardId);
        } else if (!params.get('boardId')) {
          handleSelectBoard(boards[0]!.id);
        }
      } catch (error: unknown) {
        console.error('Error listing boards:', String(error));
      }
    };
    void fetchBoards();
  }, [handleSelectBoard]);

  // Create a new board with optimistic updates
  const createBoard = async (title: string): Promise<string> => {
    // Fallback for unauthenticated users: create local board only
    if (!session) {
      const localBoard = { id: uuidv4(), title, pinned: false };
      setProjects(prev => [localBoard, ...prev]);
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
    <div className="flex h-screen relative justify-end">
      <Sidebar
        boards={projects}
        onSelect={handleSelectBoard}
        onCreate={createBoard}
        onPin={handlePinBoard}
        onDelete={handleDeleteBoard}
        onRename={handleRenameBoard}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
      {/* Banner reminding unauthenticated users to sign in for persistence */}
      {showSignInBanner && !session && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-900 p-2 text-center z-50">
          You&apos;re creating boards locally.{' '}
          <button onClick={() => signIn()} className="underline font-bold">
            Sign in
          </button>{' '}to save your boards.
          <button onClick={() => setShowSignInBanner(false)} className="absolute top-1 right-2">
            ✕
          </button>
        </div>
      )}
      <motion.div
        className="flex flex-col relative"
        initial={{ width: '100%' }}
        animate={{ width: sidebarOpen ? 'calc(100% - 16rem)' : '100%' }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        style={{ willChange: 'width' }}
      >
        <BoardOptimized
          focusEditTitleBoardId={focusRenameId}
          clearFocusEdit={() => setFocusRenameId(null)}
          sidebarOpen={sidebarOpen}
          boardId={currentBoardId}
        />
      </motion.div>
    </div>
  );
};