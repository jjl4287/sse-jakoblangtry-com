/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { clsx } from 'clsx';
import { Board } from '../board/Board';
import { BoardProvider, useBoard } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { Plus, Pin, Trash2 } from 'lucide-react';
import { BoardService } from '~/services/board-service';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from '~/app/components/layout/Sidebar';

export default function BoardLayout() {
  return (
    <BoardProvider>
      <ThemeProvider>
        <InnerBoardLayout />
      </ThemeProvider>
    </BoardProvider>
  );
}

const InnerBoardLayout: React.FC = () => {
  const { refreshBoard, updateTitle } = useBoard();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<{ id: string; title: string; pinned: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [showSignInBanner, setShowSignInBanner] = useState(false);
  const [focusRenameId, setFocusRenameId] = useState<string | null>(null);

  // Select a board by ID: update URL, optionally skip API refresh (for local-only boards)
  const handleSelectBoard = (id: string, skipRefresh = false) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    // Trigger board refresh if not skipped
    if (!skipRefresh) {
      void refreshBoard();
    }
  };

  // Pin or unpin a board by ID
  const handlePinBoard = (id: string) => {
    // TODO: Implement pin/unpin via BoardService.updateTheme or a dedicated endpoint
  };

  // Delete a board by ID, server first then update local state
  const handleDeleteBoard = async (id: string) => {
    if (session) {
      try {
        await BoardService.deleteBoard(id);
      } catch (error: unknown) {
        console.error('Error deleting board:', String(error));
      }
    }
    // Always remove from local state
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  // Rename a board title (updates local state and server)
  const handleRenameBoard = async (id: string, title: string) => {
    // Update local list
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title } : p));
    // Update board context title immediately (minimal update)
    updateTitle(title);
    if (!session) return;
    // Persist title change asynchronously
    fetch(`/api/boards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).catch((error) => {
      console.error('Error renaming board:', String(error));
    });
  };

  useEffect(() => {
    // Kick off board list fetch
    const fetchBoards = async () => {
      try {
        const boards = await BoardService.listBoards();
        if (boards.length === 0) return;
        setProjects(boards);
        const params = new URLSearchParams(window.location.search);
        if (!params.get('boardId')) {
          handleSelectBoard(boards[0]!.id);
        }
      } catch (error: unknown) {
        console.error('Error listing boards:', String(error));
      }
    };
    void fetchBoards();
  }, []);

  // Create a new board using BoardService, return its ID
  const createBoard = async (title: string): Promise<string> => {
    // Fallback for unauthenticated users: create local board only
    if (!session) {
      const localBoard = { id: uuidv4(), title, pinned: false };
      setProjects(prev => [localBoard, ...prev]);
      handleSelectBoard(localBoard.id, true);
      setShowSignInBanner(true);
      setFocusRenameId(localBoard.id);
      return localBoard.id;
    }
    try {
      const newBoard = await BoardService.createBoard(title);
      setProjects(prev => [newBoard, ...prev]);
      handleSelectBoard(newBoard.id);
      setFocusRenameId(newBoard.id);
      return newBoard.id;
    } catch (error: unknown) {
      console.error('Error creating board:', String(error));
      throw error;
    }
  };

  return (
    <div className="flex h-screen relative">
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
      <div className={clsx(
        "flex-1 flex flex-col relative transition-all duration-500 ease-out",
        sidebarOpen ? 'pl-64' : 'pl-0'
      )}>
        <Board
          focusEditTitleBoardId={focusRenameId}
          clearFocusEdit={() => setFocusRenameId(null)}
          onRenameBoard={handleRenameBoard}
          sidebarOpen={sidebarOpen}
        />
      </div>
    </div>
  );
};