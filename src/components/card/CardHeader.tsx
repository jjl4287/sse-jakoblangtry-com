'use client';

import React, { useState, useRef } from 'react';
import { InlineEdit } from '~/components/ui/InlineEdit';
import { Badge } from '~/components/ui/badge';
import { CheckSquare, CircleSlash } from 'lucide-react';
import type { Card } from '~/types';

interface CardHeaderProps {
  card: Card;
  onUpdateTitle: (cardId: string, title: string) => Promise<void>;
  isCardClosed?: boolean;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  card,
  onUpdateTitle,
  isCardClosed = false
}) => {
  const [title, setTitle] = useState(card.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const cardTitleInputRef = useRef<HTMLInputElement>(null);

  const handleSaveTitle = async () => {
    if (title !== card.title) {
      await onUpdateTitle(card.id, title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Card Status Badge */}
      {isCardClosed ? (
        <Badge variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700 flex-shrink-0">
          <CircleSlash className="h-3 w-3 mr-1" />
          Closed
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700 flex-shrink-0">
          <CheckSquare className="h-3 w-3 mr-1" />
          Open
        </Badge>
      )}

      {/* Card Title */}
      <div className="flex-1 min-w-0">
        <InlineEdit
          ref={cardTitleInputRef}
          isEditing={isEditingTitle}
          value={title}
          onChange={setTitle}
          onEditStart={() => setIsEditingTitle(true)}
          onSave={handleSaveTitle}
          onCancel={() => {
            setTitle(card.title);
            setIsEditingTitle(false);
          }}
          className="text-lg font-semibold text-foreground cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors break-words w-full"
          placeholder="Card title"
        />
      </div>
    </div>
  );
}; 