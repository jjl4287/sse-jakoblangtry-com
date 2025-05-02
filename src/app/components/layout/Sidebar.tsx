import React from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { PanelLeft, Pin, Trash2, Plus } from 'lucide-react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetPortal } from '~/components/ui/sheet';
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

export const Sidebar: FC<SidebarProps> = ({ boards, onSelect, onCreate, onPin, onDelete, onRename, open, onOpenChange }) => {
  // Inline rename state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const { data: session } = useSession();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? 'Close sidebar' : 'Open sidebar'}
        className="fixed top-4 left-4 z-[60] transition-transform duration-500 ease-out"
        onClick={() => onOpenChange(!open)}
      >
        <PanelLeft />
      </Button>
      <SheetContent side="left" className="w-64 flex flex-col h-full">
        <SheetHeader>
          <SheetTitle className="text-lg text-center">Boards</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* New Board: one-click create, then inline edit */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onCreate('New Board').then((id) => {
                setEditingId(id);
                setEditTitle('New Board');
                onOpenChange(false);
              });
            }}
          >
            <Plus className="mr-2" /> New Board
          </Button>
          {boards.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
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
                  onDoubleClick={() => { setEditingId(b.id); setEditTitle(b.title); }}
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
                <AvatarImage src={session.user.image || undefined} />
                <AvatarFallback>{session.user.name?.[0] ?? 'U'}</AvatarFallback>
              </Avatar>
              <span className="truncate flex-1">{session.user.name}</span>
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
      </SheetContent>
      {/* Toggle button inside portal to sit above overlay */}
      <SheetPortal>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? 'Close sidebar' : 'Open sidebar'}
            className="fixed top-4 left-4 z-[70] pointer-events-auto transition-transform duration-500 ease-out"
          >
            <PanelLeft />
          </Button>
        </SheetTrigger>
      </SheetPortal>
    </Sheet>
  );
}; 