/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { clsx } from 'clsx';
import { Board } from '../board/Board';
import { BoardProvider, useBoard } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { SidebarOpen, SidebarClose, Plus, Pin, Trash2 } from 'lucide-react';
import { BoardService } from '~/services/board-service';
import { v4 as uuidv4 } from 'uuid';

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
  const { refreshBoard } = useBoard();
  const { data: session } = useSession();
  const [projects, setProjects] = useState<{ id: string; title: string; pinned: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [showSignInBanner, setShowSignInBanner] = useState(false);

  // Select a board by ID: update URL, optionally skip API refresh (for local-only boards)
  const handleSelectBoard = (id: string, skipRefresh = false) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    // Trigger board refresh if not skipped
    if (!skipRefresh) {
      void refreshBoard();
    }
    setSidebarOpen(false);
  };

  const handlePinBoard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // TODO: Implement pin/unpin via BoardService.updateTheme or a dedicated endpoint
  };

  const handleDeleteBoard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await BoardService.deleteBoard(id);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error: unknown) {
      console.error('Error deleting board:', String(error));
    }
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

  // Create a new board using BoardService
  const createBoard = async (title: string) => {
    // Fallback for unauthenticated users: create local board only
    if (!session) {
      const localBoard = { id: uuidv4(), title, pinned: false };
      setProjects(prev => [localBoard, ...prev]);
      handleSelectBoard(localBoard.id, true);
      setShowSignInBanner(true);
      return;
    }
    try {
      const newBoard = await BoardService.createBoard(title);
      setProjects(prev => [newBoard, ...prev]);
      handleSelectBoard(newBoard.id);
    } catch (error: unknown) {
      console.error('Error creating board:', String(error));
    }
  };

  return (
    <div className="flex h-screen relative">
      <aside
        className={clsx(
          'fixed left-0 z-50 w-64 flex flex-col justify-between',
          'top-2 bottom-2 h-[calc(100vh-1rem)]',
          'glass-column glass-border-animated bg-[#A7F3D0]/15 dark:bg-[#A7F3D0]/25 backdrop-blur-md border border-[#A7F3D0]/30 rounded-xl shadow-md hover:shadow-lg',
          'transition-transform duration-300 ease-in-out',
          {
            '-translate-x-full': !sidebarOpen,
            'translate-x-0': sidebarOpen,
          }
        )}
      >
        <div className="p-4 px-6 pt-12 overflow-y-auto">
          {!isCreating ? (
            <button onClick={() => { setIsCreating(true); setNewBoardTitle(''); }} className="mb-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors duration-200 font-medium flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" /> New Board
            </button>
          ) : (
            <div className="mb-4 flex space-x-2">
              <input type="text" value={newBoardTitle} onChange={(e) => setNewBoardTitle(e.target.value)} placeholder="Board name" className="flex-1 px-2 py-1 border rounded" />
              <button disabled={!newBoardTitle.trim()} onClick={async () => { await createBoard(newBoardTitle.trim()); setIsCreating(false); }} className="px-2 py-1 bg-primary text-primary-foreground rounded">Save</button>
              <button onClick={() => setIsCreating(false)} className="px-2 py-1 border rounded">Cancel</button>
            </div>
          )}
          <div className="space-y-2">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => handleSelectBoard(proj.id)}
                className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg group cursor-pointer"
              >
                <span className="text-gray-800 dark:text-gray-200 truncate pr-2">{proj.title}</span>
                <div className="opacity-0 group-hover:opacity-100 flex space-x-2 flex-shrink-0">
                  <button onClick={(e) => handlePinBoard(e, proj.id)} className="p-1 hover:bg-muted rounded-md">
                    <Pin size={16} className="cursor-pointer text-gray-600 dark:text-gray-400" />
                  </button>
                  <button onClick={(e) => handleDeleteBoard(e, proj.id)} className="p-1 hover:bg-muted rounded-md">
                    <Trash2 size={16} className="cursor-pointer text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 px-6 pt-0">
          <div className="mt-4 flex items-center border-t border-border/20 pt-4 space-x-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            {session ? (
              <>
                <span className="text-gray-800 dark:text-gray-200 truncate">{session.user?.name}</span>
                <button className="ml-auto text-sm text-primary" onClick={() => signOut()}>Sign out</button>
              </>
            ) : (
              <button className="text-sm text-primary" onClick={() => signIn()}>Sign in</button>
            )}
          </div>
        </div>
      </aside>

      {/* Banner reminding unauthenticated users to sign in for persistence */}
      {showSignInBanner && !session && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-900 p-2 text-center z-50">
          You&apos;re creating boards locally.{' '}
          <button onClick={() => signIn()} className="underline font-bold">
            Sign in
          </button>{' '}
          to save your boards.
          <button onClick={() => setShowSignInBanner(false)} className="absolute top-1 right-2">
            ✕
          </button>
        </div>
      )}

      <div
        className={clsx(
          'flex-1 flex flex-col relative',
          'transition-all duration-300 ease-in-out',
          { 'pl-64': sidebarOpen }
        )}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={clsx(
            'p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-muted transition-all duration-300 ease-in-out',
            {
              'fixed top-[0.9rem] left-4 z-[60]': sidebarOpen,
              'absolute top-[0.9rem] left-4 z-[60]': !sidebarOpen
            }
          )}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <SidebarClose className="h-5 w-5" /> : <SidebarOpen className="h-5 w-5" />}
        </button>
        
        <Board sidebarOpen={sidebarOpen} />
      </div>
    </div>
  );
};