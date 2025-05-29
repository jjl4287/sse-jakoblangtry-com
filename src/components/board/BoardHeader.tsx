import React from 'react';
import { InlineEdit } from '~/components/ui/InlineEdit';
import { Search, UserPlus, PanelLeft } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export interface BoardHeaderProps {
  title: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  onEditStart: () => void;
  onSave: () => void;
  onCancel: () => void;
  sidebarOpen: boolean;
  columnCount: number;
  cardCount: number;
  onAddColumnClick: () => void;
  searchQuery: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.Ref<HTMLInputElement>;
  onOpenShareSheet: () => void;
  onToggleSidebar: () => void;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({
  title,
  onChange,
  isEditing,
  onEditStart,
  onSave,
  onCancel,
  sidebarOpen,
  columnCount,
  cardCount,
  onAddColumnClick,
  searchQuery,
  onSearchChange,
  inputRef,
  onOpenShareSheet,
  onToggleSidebar,
}) => {
  return (
    <header className="glass-column border rounded-lg shadow-md py-1.5 flex items-center justify-between" style={{ height: 'var(--header-height, auto)', paddingLeft: 'var(--board-padding)', paddingRight: 'var(--board-padding) - 1rem' }}>
      <motion.div 
        className="flex items-center"
        layout
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {!sidebarOpen && (
          <motion.button
            layoutId="sidebar-toggle"
            aria-label="Open sidebar"
            className="mr-2 p-1 h-8 w-8 flex items-center justify-center rounded hover:bg-muted/10"
            onClick={onToggleSidebar}
          >
            <PanelLeft size={16} />
          </motion.button>
        )}
        <InlineEdit
          value={title}
          onChange={onChange}
          isEditing={isEditing}
          onEditStart={onEditStart}
          onSave={onSave}
          onCancel={onCancel}
          className="text-2xl font-bold inline-block w-max"
          placeholder="Board Title"
          ref={inputRef}
        />
      </motion.div>

      <div className="flex items-center gap-3">
        <div className="text-sm font-medium">{columnCount} Columns</div>
        <div className="text-sm font-medium">{cardCount} Cards</div>
        <Button onClick={onOpenShareSheet} variant="outline" size="sm" className="flex items-center gap-1 rounded-full">
          <UserPlus className="h-4 w-4" /> Share
        </Button>
        <Button onClick={onAddColumnClick} variant="outline" size="sm" className="border rounded-full">
          + Add Column
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={onSearchChange}
            className="pl-9 pr-3 py-1 h-8 w-48 bg-input border rounded-full"
          />
        </div>
      </div>
    </header>
  );
}; 