'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { clsx } from 'clsx';
import { Board } from '../board/Board';
import { BoardProvider, useBoard } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { SidebarOpen, SidebarClose, Plus, Pin, Trash2 } from 'lucide-react';

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

  // Select a board by ID: update URL, refresh board, close sidebar
  const handleSelectBoard = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    // Trigger board refresh (ignore promise)
    void refreshBoard();
    setSidebarOpen(false);
  };

  const handlePinBoard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    console.log("Pin board:", id); // Placeholder action
    // Add pin logic here
  };

  const handleDeleteBoard = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    console.log("Delete board:", id); // Placeholder action
    // Add delete logic here
    // Might need confirmation dialog
    // Refresh project list after deletion
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  useEffect(() => {
    fetch('/api/boards')
      .then(async (res): Promise<{ id: string; title: string; pinned: boolean }[]> => {
        if (!res.ok) {
          console.error('[projects fetch error] status', res.status);
          return [];
        }
        // Safely parse JSON
        let parsed: unknown;
        try {
          parsed = await res.json();
        } catch (err) {
          console.error('[projects fetch error] parse error', err);
          return [];
        }
        if (!Array.isArray(parsed)) {
          return [];
        }
        // Cast to correct shape
        return parsed as { id: string; title: string; pinned: boolean }[];
      })
      .then((data) => {
        if (data.length === 0) return;
        setProjects(data);
        // If no boardId param, select first board by default
        const params = new URLSearchParams(window.location.search);
        if (!params.get('boardId')) {
          void handleSelectBoard(data[0]!.id);
        }
      })
      .catch((err) => console.error('[projects fetch error]', err));
  }, []);

  const createNewBoard = async () => {
    const title = window.prompt('Enter board name');
    if (!title) return;
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        console.error('Failed to create board:', await res.text());
        return;
      }
      const newBoard = await res.json() as { id: string; title: string; pinned: boolean };
      // Prepend to list and select it
      setProjects(prev => [newBoard, ...prev]);
      handleSelectBoard(newBoard.id);
    } catch (error) {
      console.error('[create new board error]', error);
    }
  };

  return (
    <div className="flex h-screen relative">
      <aside
        className={clsx(
          'fixed left-0 z-50 w-64 flex flex-col justify-between',
          'top-2 bottom-2 h-[calc(100vh-1rem)]',
          'bg-background/80 dark:bg-gray-900/90 backdrop-blur-md border border-border/20 rounded-xl',
          'transition-transform duration-300 ease-in-out',
          {
            '-translate-x-full': !sidebarOpen,
            'translate-x-0': sidebarOpen,
          }
        )}
      >
        <div className="p-4 pt-12 overflow-y-auto">
          <button onClick={createNewBoard} className="mb-4 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors duration-200 font-medium flex items-center justify-center">
            <Plus className="w-4 h-4 mr-2" /> New Board
          </button>
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
        <div className="p-4 pt-0">
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