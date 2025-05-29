'use client';

import React, { useState } from 'react';
import { Edit3Icon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/ui/Markdown';
import MarkdownEditor from '~/components/ui/MarkdownEditor';
import type { Card } from '~/types';

interface CardDescriptionProps {
  card: Card;
  onUpdateDescription: (cardId: string, description: string) => Promise<void>;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  card,
  onUpdateDescription
}) => {
  const [description, setDescription] = useState(card.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDescription = async () => {
    if (description !== card.description) {
      setIsSaving(true);
      try {
        await onUpdateDescription(card.id, description);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditingDescription(false);
  };

  const handleCancelEdit = () => {
    setDescription(card.description || '');
    setIsEditingDescription(false);
  };

  return (
    <div className="relative">
      {isEditingDescription ? (
        <div className="space-y-3" data-no-dnd="true">
          <MarkdownEditor
            value={description}
            onChange={(value) => setDescription(value ?? '')}
            placeholder="Add a more detailed description... (Cmd/Ctrl+Enter to save)"
            height={200}
            onKeyDown={(e) => {
              // Handle Cmd/Ctrl+Enter to save description
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (!isSaving) {
                  handleSaveDescription();
                }
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveDescription}
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isSaving}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {description ? (
            <div className="relative p-3 border border-border rounded-md bg-muted/20">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 p-0 h-6 w-6 opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingDescription(true)}
              >
                <Edit3Icon className="h-4 w-4" />
              </Button>
              <Markdown content={description} className="prose-sm text-foreground pr-8" />
            </div>
          ) : (
            <div
              className="text-sm text-muted-foreground italic cursor-pointer hover:text-foreground/70 p-3 border border-dashed border-muted rounded-md"
              onClick={() => setIsEditingDescription(true)}
            >
              Add a more detailed description...
            </div>
          )}
          
          {/* Timeline connector line extending down */}
          <div className="absolute left-4 top-full w-0.5 h-4 bg-border/60" />
        </>
      )}
    </div>
  );
}; 