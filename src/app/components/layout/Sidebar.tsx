import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { PanelLeft, Pin, Trash2, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
// Using pure CSS transitions instead of Framer Motion for sidebar
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import type { FC } from 'react';

interface SidebarProps {
  boards: { id: string; title: string; pinned: boolean }[];
  onSelect: (id: string) => void;
  /** Creates a board with given title and returns its ID */
  onCreate: (title: string) => Promise<string>;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  // Sidebar open state controlled by parent
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const Sidebar: FC<SidebarProps> = ({
  boards,
  onSelect,
  onCreate,
  onPin,
  onDelete,
  onRename,
  open,
  onOpenChange,
}) => {
  // Inline rename state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const { data: session } = useSession();

  return (
    <>
      {/* Persistent toggle button */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        className="fixed top-[0.82rem] left-4 z-[60] h-10 w-10 flex items-center justify-center transition-transform duration-300 ease-out"
        onClick={() => onOpenChange(!open)}
      >
        <PanelLeft className={open ? 'rotate-180' : ''} />
      </Button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            onClick={() => onOpenChange(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 w-64 bg-background/95 backdrop-blur-sm shadow-lg flex flex-col"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="mt-[.55rem] flex items-center justify-center p-2 border-b">
              <span className="text-2xl font-bold">Boards</span>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* New Board: one-click create, then inline edit */}
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  try {
                    const id = await onCreate('New Board');
                    setEditingId(id);
                    setEditTitle('New Board');
                  } catch (error) {
                    console.error('Failed to create board:', error);
                  }
                }}
              >
                <Plus className="mr-2" /> New Board
              </Button>
              {boards.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer transition-colors"
                  onClick={() => onSelect(b.id)}
                >
                  {editingId === b.id ? (
                    <input
                      autoFocus
                      className="flex-1 px-2 py-1 border rounded"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        if (editTitle.trim()) onRename(b.id, editTitle.trim());
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editTitle.trim()) onRename(b.id, editTitle.trim());
                          setEditingId(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="truncate flex-1"
                      onDoubleClick={() => {
                        setEditingId(b.id);
                        setEditTitle(b.title);
                      }}
                    >
                      {b.title}
                    </span>
                  )}
                  <div className="flex space-x-2">
                    <Button size="icon" variant="ghost" onClick={() => onPin(b.id)}>
                      <Pin size={16} />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(b.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="p-4">
              {session?.user ? (
                <div className="flex items-center space-x-2">
                  <Avatar>
                    <AvatarImage src={session.user.image ?? undefined} />
                    <AvatarFallback>{session.user.name?.[0] ?? 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{session.user.name}</span>
                  <Button variant="link" size="sm" onClick={() => signOut()}>
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button variant="link" size="sm" onClick={() => signIn()}>
                  Sign in
                </Button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}; 