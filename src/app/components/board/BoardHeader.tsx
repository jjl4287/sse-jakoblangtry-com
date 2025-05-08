import React from 'react';
import { motion } from 'framer-motion';
import { InlineEdit } from '~/components/ui/InlineEdit';
import { Search, UserPlus } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Sun, Moon } from 'lucide-react';
import { Button } from '~/components/ui/button';

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
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  inputRef: React.Ref<HTMLInputElement>;
  onOpenShareSheet: () => void;
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
  theme,
  toggleTheme,
  inputRef,
  onOpenShareSheet,
}) => {
  return (
    <header className="glass-column border rounded-lg shadow-md px-4 py-1.5 flex items-center justify-between">
      <motion.div
        initial={{ x: sidebarOpen ? 0 : 40 }}
        animate={{ x: sidebarOpen ? 0 : 40 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="flex items-center"
      >
        <InlineEdit
          value={title}
          onChange={onChange}
          isEditing={isEditing}
          onEditStart={onEditStart}
          onSave={onSave}
          onCancel={onCancel}
          className="text-2xl font-bold inline-block w-max mr-2"
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
        <Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-blue-200" />}
        </Button>
      </div>
    </header>
  );
}; 