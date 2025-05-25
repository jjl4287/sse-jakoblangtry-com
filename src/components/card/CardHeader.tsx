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
        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700/50 flex-shrink-0 px-2.5 py-1">
          <CircleSlash className="h-3 w-3 mr-1.5" />
          Closed
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700/50 flex-shrink-0 px-2.5 py-1">
          <CheckSquare className="h-3 w-3 mr-1.5" />
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
          className="text-xl font-bold text-foreground cursor-pointer hover:bg-muted/40 px-2 py-1.5 rounded-md transition-all duration-200 break-words w-full leading-tight"
          placeholder="Card title"
        />
      </div>
    </div>
  );
}; 