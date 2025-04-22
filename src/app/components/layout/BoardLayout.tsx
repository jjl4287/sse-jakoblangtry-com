'use client';

import React, { useState, useEffect } from 'react';
import { Board } from '../board/Board';
import { BoardProvider, useBoard } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { Plus, Pin, Trash2 } from 'lucide-react';

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
  const [projects, setProjects] = useState<{ id: string; title: string; pinned: boolean }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Select a board by ID: update URL, refresh board, close sidebar
  const handleSelectBoard = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('boardId', id);
    window.history.pushState({}, '', `?${params.toString()}`);
    // Trigger board refresh (ignore promise)
    void refreshBoard();
    setSidebarOpen(false);
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
    <div className="flex h-screen">
      {/* Sidebar column pushes content */}
      {sidebarOpen && (
        <aside className="w-64 bg-white dark:bg-gray-900 shadow-lg p-4 flex flex-col justify-between">
          <div>
            {/* New Board button */}
            <button onClick={createNewBoard} className="flex items-center mb-4 px-2 py-1 bg-blue-500 text-white rounded">
              <Plus className="w-4 h-4 mr-2" /> New Board
            </button>
            {/* List of projects */}
            <div className="space-y-2">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => handleSelectBoard(proj.id)}
                  className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded group cursor-pointer"
                >
                  <span className="text-gray-800 dark:text-gray-200">{proj.title}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                    <Pin size={16} className="cursor-pointer text-gray-600 dark:text-gray-400" />
                    <Trash2 size={16} className="cursor-pointer text-red-600 dark:text-red-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Current user info */}
          <div className="mt-4 flex items-center">
            <div className="w-8 h-8 bg-gray-300 rounded-full mr-2"></div>
            <span className="text-gray-800 dark:text-gray-200">Admin User</span>
          </div>
        </aside>
      )}

      {/* Main board content */}
      <div className="flex-1 flex flex-col">
        {/* Pass setSidebarOpen down so header can toggle */}
        <Board setSidebarOpen={setSidebarOpen} />
      </div>
    </div>
  );
};