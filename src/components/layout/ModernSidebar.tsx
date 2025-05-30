'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Plus, 
  Pin, 
  Trash2, 
  Settings, 
  PanelLeft,
  User,
  LogOut,
  MessageSquare,
  Layout,
  MoreHorizontal,
  Edit3,
  Check,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '~/components/ui/dropdown-menu';
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

interface ModernSidebarProps {
  boards: { id: string; title: string; pinned: boolean }[];
  onSelect: (id: string) => void;
  onCreate: (title: string) => Promise<string>;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBoardId?: string | null;
}

export const ModernSidebar: React.FC<ModernSidebarProps> = ({
  boards,
  onSelect,
  onCreate,
  onPin,
  onDelete,
  onRename,
  open,
  onOpenChange,
  selectedBoardId,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [boardToDelete, setBoardToDelete] = useState<null | { id: string; title: string }>(null);
  const sidebarInputRef = React.useRef<HTMLInputElement>(null);

  const handleCreateBoard = async () => {
    try {
      const id = await onCreate('New Board');
      setEditingId(id);
      setEditTitle('New Board');
      // Select text after state update and render
      requestAnimationFrame(() => {
        sidebarInputRef.current?.select();
      });
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleRenameStart = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
    // Select text after state update and render
    requestAnimationFrame(() => {
      sidebarInputRef.current?.select();
    });
  };

  const handleRenameSave = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleSettingsClick = () => {
    router.push('/settings');
  };

  // Separate pinned and regular boards
  const pinnedBoards = boards.filter(board => board.pinned);
  const regularBoards = boards.filter(board => !board.pinned);

  return (
    <>
      {/* Sidebar panel - part of normal document flow */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-background/95 backdrop-blur-sm shadow-lg flex flex-col border-r overflow-hidden sidebar-rounded"
            style={{ flexShrink: 0 }}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between border-b border-border p-4"
              style={{ 
                height: 'calc(var(--header-height) + 0.4rem)',
                marginBottom: 'var(--board-gutter)',
              }}
            >
              <div className="flex items-center space-x-3">
                <motion.button
                  layoutId="sidebar-toggle"
                  onClick={() => onOpenChange(false)}
                  className="p-1 h-8 w-8 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
                  aria-label="Close sidebar"
                >
                  <Layout className="h-6 w-6 text-primary" />
                </motion.button>
                <span className="font-semibold text-xl">Boards</span>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* New Board Button */}
              <Button
                onClick={handleCreateBoard}
                className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90 mb-4"
                size="default"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Board
              </Button>

              {/* Pinned Boards Section */}
              {pinnedBoards.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 px-2 py-1">
                    <Pin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Pinned</span>
                  </div>
                  {pinnedBoards.map((board) => (
                    <div
                      key={board.id}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedBoardId === board.id 
                          ? 'bg-accent text-accent-foreground' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onSelect(board.id); }}
                    >
                      {editingId === board.id ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            autoFocus
                            ref={sidebarInputRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => {
                              if (editTitle.trim()) handleRenameSave();
                              else handleRenameCancel();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSave();
                              if (e.key === 'Escape') handleRenameCancel();
                            }}
                            className="flex-1 bg-transparent border-b border-foreground/20 focus:border-foreground outline-none text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameSave();
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameCancel();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate flex-1 text-sm font-medium">{board.title}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameStart(board.id, board.title);
                                }}
                              >
                                <Edit3 className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPin(board.id);
                                }}
                              >
                                <Pin className="h-4 w-4 mr-2" />
                                Unpin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBoardToDelete({ id: board.id, title: board.title });
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Boards Section */}
              {regularBoards.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 px-2 py-1 mt-4">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Recent</span>
                  </div>
                  {regularBoards.map((board) => (
                    <div
                      key={board.id}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedBoardId === board.id 
                          ? 'bg-accent text-accent-foreground' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onSelect(board.id); }}
                    >
                      {editingId === board.id ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            autoFocus
                            ref={sidebarInputRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => {
                              if (editTitle.trim()) handleRenameSave();
                              else handleRenameCancel();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSave();
                              if (e.key === 'Escape') handleRenameCancel();
                            }}
                            className="flex-1 bg-transparent border-b border-foreground/20 focus:border-foreground outline-none text-sm"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameSave();
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameCancel();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate flex-1 text-sm font-medium">{board.title}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameStart(board.id, board.title);
                                }}
                              >
                                <Edit3 className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPin(board.id);
                                }}
                              >
                                <Pin className="h-4 w-4 mr-2" />
                                Pin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBoardToDelete({ id: board.id, title: board.title });
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />
            
            {/* Footer with User Profile */}
            <div className="p-4">
              {session?.user ? (
                <div className="space-y-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={session.user.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.user.name ?? session.user.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            View profile & settings
                          </p>
                        </div>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem onClick={handleSettingsClick}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signIn()}
                  className="w-full justify-start"
                >
                  <User className="h-4 w-4 mr-2" />
                  Sign in
                </Button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!boardToDelete} onOpenChange={(isOpen) => !isOpen && setBoardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This action cannot be undone. This will permanently delete the board "${boardToDelete?.title ?? ''}". All columns and cards within this board will also be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBoardToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (boardToDelete) {
                  onDelete(boardToDelete.id);
                  setBoardToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}; 