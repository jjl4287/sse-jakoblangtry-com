import React, { useState } from 'react';
import { useBoard } from '~/services/board-context';
import type { Label } from '~/types';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Plus, X } from 'lucide-react';

export interface CardLabelsProps {
  cardId: string;
  labels: Label[];
}

export function CardLabels({ cardId, labels }: CardLabelsProps) {
  const { addLabel, removeLabel } = useBoard();
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#000000');

  const handleAdd = async () => {
    if (!newLabelName.trim()) return;
    try {
      await addLabel(cardId, newLabelName.trim(), newLabelColor);
      setNewLabelName('');
      setNewLabelColor('#000000');
    } catch (e) {
      console.error('Failed to add label:', e);
    }
  };

  const handleRemove = async (labelId: string) => {
    try {
      await removeLabel(cardId, labelId);
    } catch (e) {
      console.error('Failed to remove label:', e);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-auto space-y-2">
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              className="cursor-pointer"
              style={{ borderColor: `${label.color}80`, backgroundColor: `${label.color}30` }}
              onClick={() => handleRemove(label.id)}
            >
              <span className="text-xs">{label.name}</span>
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
        <div className="flex items-center space-x-1">
          <Input
            type="text"
            placeholder="Label name"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            className="rounded-md"
          />
          <Input
            type="color"
            value={newLabelColor}
            onChange={(e) => setNewLabelColor(e.target.value)}
            className="p-0 h-9 w-9 rounded-md"
          />
          <Button onClick={handleAdd} disabled={!newLabelName.trim()} size="sm">
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
} 