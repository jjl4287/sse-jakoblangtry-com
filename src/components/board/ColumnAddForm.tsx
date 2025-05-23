'use client';

import React, { useState } from 'react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useColumnMutations } from '~/hooks/useColumn';

export const ColumnAddForm: React.FC<{ 
  onCancel: () => void; 
  boardId: string;
  onColumnCreated?: () => void;
}> = ({ onCancel, boardId, onColumnCreated }) => {
  const { createColumn } = useColumnMutations();
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      // Use default width for new columns
      await createColumn(boardId, { title: title.trim(), width: 300 });
      setTitle('');
      onColumnCreated?.();
      onCancel();
    } catch (error) {
      console.error('Error creating column:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-column glass-depth-2 p-3 mb-2 rounded-lg">
      <Input
        placeholder="New column title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        className="mb-2 w-full"
      />
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim() || isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Column'}
        </Button>
      </div>
    </form>
  );
}; 