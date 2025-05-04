'use client';

import React, { useState } from 'react';
import { useBoard } from '~/services/board-context';

interface CardAddFormProps {
  columnId: string;
  onCancel: () => void;
}

export const CardAddForm: React.FC<CardAddFormProps> = ({ columnId, onCancel }) => {
  const { createCard } = useBoard();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await createCard(columnId, {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        labels: [],
        assignees: [],
        attachments: [],
        comments: [],
      });
      setPriority('medium');
      setDueDate('');
      setTitle('');
      setDescription('');
      onCancel();
    } catch (error) {
      console.error('Error creating card:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card glass-depth-2 glass-border-animated rounded-md p-3 mb-3">
      <div className="mb-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Card title"
          className="w-full glass-depth-1 px-3 py-2 rounded-md placeholder-opacity-50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
          autoFocus
        />
      </div>
      
      <div className="mb-3">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={3}
          className="w-full glass-depth-1 px-3 py-2 rounded-md placeholder-opacity-50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
        />
      </div>
      
      <div className="mb-3 flex gap-2">
        <div className="flex flex-col w-1/2">
          <label className="text-sm font-medium mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            className="w-full glass-depth-1 px-3 py-2 rounded-md border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="flex flex-col w-1/2">
          <label className="text-sm font-medium mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full glass-depth-1 px-3 py-2 rounded-md border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="glass-button px-3 py-1 text-sm hover:text-white transition-all rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="glass-button elevated px-3 py-1 rounded-md text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-primary/30 hover:bg-primary/40"
        >
          {isSubmitting ? 'Adding...' : 'Add Card'}
        </button>
      </div>
    </form>
  );
}; 