'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ArrowUp, ArrowDown, ArrowRight, Weight } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from '~/lib/utils';
import type { Card, Priority } from '~/types';

interface CardActionsProps {
  card: Card;
  onUpdateCard: (cardId: string, updates: {
    priority?: Priority;
    dueDate?: Date;
    weight?: number;
  }) => Promise<void>;
}

export const CardActions: React.FC<CardActionsProps> = ({
  card,
  onUpdateCard
}) => {
  const [priority, setPriority] = useState<Priority>(card.priority || 'medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(card.dueDate ? new Date(card.dueDate) : undefined);
  const [weight, setWeight] = useState<number | undefined>(card.weight);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePriorityChange = async (newPriority: Priority) => {
    setPriority(newPriority);
    await onUpdateCard(card.id, { priority: newPriority });
  };

  const handleDueDateChange = async (date: Date | undefined) => {
    setDueDate(date);
    if (date) {
      await onUpdateCard(card.id, { dueDate: date });
    }
    setCalendarOpen(false);
  };

  const handleWeightChange = async () => {
    if (weight !== card.weight) {
      await onUpdateCard(card.id, { weight });
    }
  };

  return (
    <div>
      <h3 className="text-base font-semibold mb-2 text-foreground">Actions</h3>
      <div className="space-y-3">
        {/* Weight Input */}
        <div className="flex items-center w-full justify-start text-left font-normal gap-2 rounded-md border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-10 px-3 transition-colors">
          <Weight className="h-4 w-4 mr-2 text-muted-foreground" />
          <Input
            type="number"
            min="0"
            placeholder="Weight"
            value={weight ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setWeight(val ? Number(val) : undefined);
            }}
            onBlur={handleWeightChange}
            className="border-0 focus-visible:ring-0 bg-transparent w-full p-0 shadow-none dark:bg-transparent dark:text-foreground placeholder:text-muted-foreground"
            style={{ backgroundColor: 'transparent' }}
          />
        </div>

        {/* Due Date Popover */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-10 transition-colors hover:scale-105",
                !dueDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dueDate ? format(dueDate, "PPP") : <span>Add due date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent portalled={false} className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={handleDueDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Priority Select */}
        <Select value={priority} onValueChange={(value) => handlePriorityChange(value as Priority)}>
          <SelectTrigger className="w-full justify-start text-left font-normal h-10 transition-colors hover:scale-105 [&>*:last-child]:hidden">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">
              <div className="flex items-center">
                <ArrowDown className="h-4 w-4 mr-2 text-green-500" />
                <span>Low</span>
              </div>
            </SelectItem>
            <SelectItem value="medium">
              <div className="flex items-center">
                <ArrowRight className="h-4 w-4 mr-2 text-yellow-500" />
                <span>Medium</span>
              </div>
            </SelectItem>
            <SelectItem value="high">
              <div className="flex items-center">
                <ArrowUp className="h-4 w-4 mr-2 text-red-500" />
                <span>High</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}; 