import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '~/components/ui/select';
import { Calendar } from '~/components/ui/calendar';
import { Button } from '~/components/ui/button';
import { useBoard } from '~/services/board-context';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '~/lib/utils';

interface NewCardSheetProps {
  columnId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewCardSheet: React.FC<NewCardSheetProps> = ({ columnId, isOpen, onOpenChange }) => {
  const { createCard } = useBoard();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSubmit = () => {
    createCard(columnId, { title, description, priority, dueDate });
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate(undefined);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[60]" />
            <Dialog.Content
              asChild
              forceMount
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg w-full max-w-[700px] p-6 z-[70]"
              >
                <Dialog.Close asChild>
                  <button className="absolute top-4 right-4 p-2 rounded hover:bg-muted/10">
                    <XIcon className="size-4" />
                  </button>
                </Dialog.Close>
                <div className="space-y-4">
                  <Dialog.Title className="text-2xl font-bold">New Card</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    Fill in the details below to create a new card.
                  </Dialog.Description>
                  <Input
                    placeholder="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description (optional)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={8}
                  />
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent portalled={false}>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[200px] justify-start text-left font-normal",
                              !dueDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom" avoidCollisions={false} portalled={false}>
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={(date) => {
                              setDueDate(date || undefined);
                              setCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button onClick={handleSubmit} disabled={!title.trim()}>
                      Create Card
                    </Button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}; 