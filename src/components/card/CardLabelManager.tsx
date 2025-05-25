'use client';

import React, { useState } from 'react';
import { PlusCircleIcon, XIcon, CheckIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '~/components/ui/command';
import { getContrastingTextColor } from '~/lib/utils';
import { StyledLabelBadge } from '~/components/ui/StyledLabelBadge';
import type { Label } from '~/types';

interface CardLabelManagerProps {
  cardId: string;
  currentLabels: Label[];
  availableLabels: Label[];
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (name: string, color: string) => Promise<Label | null>;
  pendingLabelChanges?: Set<string>;
}

export const CardLabelManager: React.FC<CardLabelManagerProps> = ({
  currentLabels,
  availableLabels,
  onToggleLabel,
  onCreateLabel,
  pendingLabelChanges = new Set()
}) => {
  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchText, setLabelSearchText] = useState('');
  const [labelPickerView, setLabelPickerView] = useState<'list' | 'create'>('list');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#4287f5');
  
  const currentLabelIds = new Set(currentLabels.map(l => l.id));

  const handleCreateNewLabel = async () => {
    if (!newLabelName.trim()) return;
    
    const createdLabel = await onCreateLabel(newLabelName.trim(), newLabelColor);
    if (createdLabel) {
      onToggleLabel(createdLabel.id); // Automatically add to current card
      setNewLabelName('');
      setNewLabelColor('#4287f5');
      setLabelPickerView('list');
      setLabelSearchText('');
    }
  };

  const filteredLabels = availableLabels.filter(label =>
    label.name.toLowerCase().includes(labelSearchText.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-base text-foreground">Labels</h4>
        <div className="w-[28px] h-[28px] relative flex-shrink-0 flex items-center justify-center">
          <Popover open={isLabelPickerOpen} onOpenChange={setIsLabelPickerOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-6 w-6 transition-transform hover:scale-110">
                <PlusCircleIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              portalled={false}
              className="w-[250px] p-0" 
              align="end"
              sideOffset={5}
            >
              {labelPickerView === 'list' ? (
                <LabelPickerList
                  searchText={labelSearchText}
                  onSearchChange={setLabelSearchText}
                  filteredLabels={filteredLabels}
                  currentLabelIds={currentLabelIds}
                  onToggleLabel={onToggleLabel}
                  onShowCreateForm={() => setLabelPickerView('create')}
                  pendingLabelChanges={pendingLabelChanges}
                />
              ) : (
                <LabelCreateForm
                  labelName={newLabelName}
                  labelColor={newLabelColor}
                  onNameChange={setNewLabelName}
                  onColorChange={setNewLabelColor}
                  onCancel={() => setLabelPickerView('list')}
                  onCreate={handleCreateNewLabel}
                />
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Display current labels */}
      <div className="flex flex-wrap gap-1">
        {currentLabels.length > 0 ? (
          currentLabels.map(label => (
            <StyledLabelBadge
              key={label.id}
              label={label}
              onClick={() => onToggleLabel(label.id)}
              className={`cursor-pointer hover:opacity-80 transition-opacity ${
                pendingLabelChanges.has(label.id) ? 'opacity-60' : ''
              }`}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No labels assigned.</p>
        )}
      </div>
    </div>
  );
};

interface LabelPickerListProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  filteredLabels: Label[];
  currentLabelIds: Set<string>;
  onToggleLabel: (labelId: string) => void;
  onShowCreateForm: () => void;
  pendingLabelChanges?: Set<string>;
}

const LabelPickerList: React.FC<LabelPickerListProps> = ({
  searchText,
  onSearchChange,
  filteredLabels,
  currentLabelIds,
  onToggleLabel,
  onShowCreateForm,
  pendingLabelChanges = new Set()
}) => {
  return (
    <Command>
      <CommandInput
        placeholder="Search labels..."
        value={searchText}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandGroup>
          {filteredLabels.map(label => (
            <CommandItem
              key={label.id}
              onSelect={() => onToggleLabel(label.id)}
              className={pendingLabelChanges.has(label.id) ? 'opacity-60' : ''}
              disabled={pendingLabelChanges.has(label.id)}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded mr-2 border"
                    style={{ backgroundColor: label.color }}
                  />
                  <span>{label.name}</span>
                </div>
                {currentLabelIds.has(label.id) && (
                  <CheckIcon className="h-4 w-4" />
                )}
              </div>
            </CommandItem>
          ))}
          {filteredLabels.length === 0 && (
            <CommandEmpty>No labels found.</CommandEmpty>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup>
          <CommandItem onSelect={onShowCreateForm}>
            <PlusCircleIcon className="h-4 w-4 mr-2" />
            Create new label
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

interface LabelCreateFormProps {
  labelName: string;
  labelColor: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}

const LabelCreateForm: React.FC<LabelCreateFormProps> = ({
  labelName,
  labelColor,
  onNameChange,
  onColorChange,
  onCancel,
  onCreate
}) => {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Create new label</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0" 
          onClick={onCancel}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <Input
          placeholder="Label name"
          value={labelName}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={labelColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer"
          />
          <Button
            className="flex-1"
            onClick={onCreate}
            disabled={!labelName.trim()}
          >
            Create and Add
          </Button>
        </div>
      </div>
    </div>
  );
}; 