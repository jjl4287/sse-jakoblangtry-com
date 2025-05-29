import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { PanelLeft, Pin, Trash2, Plus, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
// Using pure CSS transitions instead of Framer Motion for sidebar
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useRouter } from 'next/navigation';
import type { FC } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';

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
  const router = useRouter();
  // Ref for sidebar input selection
  const sidebarInputRef = React.useRef<HTMLInputElement>(null);
  const [boardToDelete, setBoardToDelete] = React.useState<null | { id: string; title: string }>(null);

  // Handle inline edit start
  const startSidebarEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
    // Select text after state update and render
    requestAnimationFrame(() => {
      sidebarInputRef.current?.select();
    });
  };

  const handleSettingsClick = () => {
    router.push('/settings');
  };

  return (
    <>
      {/* Sidebar panel - now part of normal document flow */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-background/95 backdrop-blur-sm shadow-lg flex flex-col border-r overflow-hidden sidebar-rounded"
            style={{ flexShrink: 0 }}
          >
            <div 
              className="flex items-center justify-start border-b"
              style={{ 
                height: 'calc(var(--header-height) + 0.4rem)',
                padding: 'calc(var(--board-padding) * 4) var(--board-padding)',
                marginBottom: 'var(--board-gutter)',
                paddingLeft: 'calc(var(--board-padding) * 2 + 0.4rem)'
              }}
            >
              <motion.button
                layoutId="sidebar-toggle"
                aria-label="Close sidebar"
                className="mr-2 p-1 h-8 w-8 flex items-center justify-center rounded hover:bg-muted/10"
                onClick={() => onOpenChange(false)}
              >
                <PanelLeft size={16} className="rotate-180" />
              </motion.button>
              <span className="text-2xl font-bold">Boards</span>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* New Board: one-click create, then inline edit */}
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={async () => {
                  try {
                    const id = await onCreate('New Board');
                    // Start inline edit and select text
                    startSidebarEdit(id, 'New Board');
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
                  onClick={(e) => { e.stopPropagation(); onSelect(b.id); }}
                >
                  {editingId === b.id ? (
                    <input
                      autoFocus
                      ref={sidebarInputRef}
                      className="flex-1 min-w-0 text-sm bg-transparent border-b-2 border-transparent focus:border-foreground focus:outline-none mr-2"
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
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditTitle(b.title);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="truncate flex-1 text-sm mr-2"
                      onDoubleClick={(e) => { e.stopPropagation(); startSidebarEdit(b.id, b.title); }}
                    >{b.title}</span>
                  )}
                  <div className="flex space-x-1 ml-auto">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onPin(b.id); }}>
                      <Pin size={14} />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setBoardToDelete({ id: b.id, title: b.title });
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="p-4">
              {session?.user ? (
                <div className="space-y-2">
                  {/* User Profile Section */}
                  <button
                    onClick={handleSettingsClick}
                    className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="cursor-pointer">
                      <AvatarImage src={session.user.image ?? undefined} />
                      <AvatarFallback>{session.user.name?.[0] ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.user.name ?? session.user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">View profile & settings</p>
                    </div>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </button>
                  
                  {/* Sign Out Button */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => signOut()}
                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                  >
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

      {/* Board Delete Confirmation Dialog */}
      <AlertDialog open={!!boardToDelete} onOpenChange={(isOpen) => !isOpen && setBoardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This action cannot be undone. This will permanently delete the board "${boardToDelete?.title ?? ''}". All columns and cards within this board will also be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBoardToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                if (boardToDelete) {
                  onDelete(boardToDelete.id);
                  setBoardToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}; 