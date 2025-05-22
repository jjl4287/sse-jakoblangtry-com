import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CalendarIcon, PlusCircleIcon, CheckIcon, UsersIcon, TagIcon, Weight, Paperclip, ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
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
import { format } from 'date-fns';
import { cn, getContrastingTextColor } from '~/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/components/ui/command';
import { Badge } from '~/components/ui/badge';
import type { Label as LabelType, User as UserType, Priority } from '~/types';
import MarkdownEditor from '~/components/ui/MarkdownEditor';

interface NewCardSheetProps {
  columnId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewCardSheet: React.FC<NewCardSheetProps> = ({ columnId, isOpen, onOpenChange }) => {
  const { createCard, boardLabels, board, addAttachment } = useBoard();
  const boardMembers = board?.members ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weight, setWeight] = useState<number | undefined>(undefined);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchText, setLabelSearchText] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearchText, setAssigneeSearchText] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate(undefined);
    setWeight(undefined);
    setSelectedFiles([]);
    setSelectedLabelIds(new Set());
    setSelectedAssigneeIds(new Set());
    setLabelSearchText('');
    setAssigneeSearchText('');
    setIsLabelPickerOpen(false);
    setIsAssigneePickerOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
    } else {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    // Create the card
    const newCardData = { 
      title, 
      description, 
      priority, 
      dueDate,
      weight: weight !== undefined ? Number(weight) : undefined,
      labelIds: Array.from(selectedLabelIds),
      assigneeIds: Array.from(selectedAssigneeIds),
    };
    
    await createCard(columnId, newCardData);
    
    // After card is created, upload any attachments
    // We'd need the new card ID to attach files, but we don't have it
    // A better approach would be to return the new card ID from createCard
    // For now, we'll just close the form and not handle file uploads in new card
    
    onOpenChange(false);
    resetForm();
  };

  const handleToggleLabel = (labelId: string) => {
    const newSelectedIds = new Set(selectedLabelIds);
    if (newSelectedIds.has(labelId)) {
      newSelectedIds.delete(labelId);
    } else {
      newSelectedIds.add(labelId);
    }
    setSelectedLabelIds(newSelectedIds);
  };

  const handleToggleAssignee = (assigneeId: string) => {
    const newSelectedIds = new Set(selectedAssigneeIds);
    if (newSelectedIds.has(assigneeId)) {
      newSelectedIds.delete(assigneeId);
    } else {
      newSelectedIds.add(assigneeId);
    }
    setSelectedAssigneeIds(newSelectedIds);
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prevFiles => [...prevFiles, ...filesArray]);
    }
  };
  
  const handleClickAttachButton = () => {
    fileInputRef.current?.click();
  };
  
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };
  
  const availableBoardLabels = boardLabels ?? [];

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
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg w-full max-w-[700px] p-6 z-[70] flex flex-col"
              >
                <Dialog.Close asChild>
                  <button className="absolute top-4 right-4 p-2 rounded hover:bg-muted/10">
                    <XIcon className="size-4" />
                  </button>
                </Dialog.Close>
                <div className="space-y-4 flex-grow overflow-y-auto pr-2">
                  <Dialog.Title className="text-2xl font-bold">New Card</Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground">
                    Fill in the details below to create a new card.
                  </Dialog.Description>
                  <Input
                    placeholder="Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="text-lg"
                  />
                  <MarkdownEditor
                    value={description}
                    onChange={(value) => setDescription(value ?? '')}
                    placeholder="Description (optional)"
                    height={180}
                    theme="dark"
                  />
                  <div className="space-y-2">
                    {selectedLabelIds.size > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-muted-foreground mr-1">Labels:</span>
                            {Array.from(selectedLabelIds).map(id => {
                                const label = availableBoardLabels.find(l => l.id === id);
                                return label ? <Badge key={id} style={{ backgroundColor: label.color, color: getContrastingTextColor(label.color) }} variant="outline" className="font-normal">{label.name}</Badge> : null;
                            })}
                        </div>
                    )}
                    {selectedAssigneeIds.size > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-muted-foreground mr-1">Assignees:</span>
                            {Array.from(selectedAssigneeIds).map(id => {
                                const member = boardMembers.find(m => m.user.id === id);
                                return member ? (
                                    <Badge key={id} variant="secondary" className="flex items-center gap-1">
                                        {member.user.image ? <img src={member.user.image} alt={member.user.name ?? ''} className="w-3 h-3 rounded-full" /> : <UsersIcon className="w-3 h-3" />}
                                        {member.user.name ?? member.user.email}
                                    </Badge>
                                ) : null;
                            })}
                        </div>
                    )}
                    
                    {/* File attachments section */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium mb-2">Attachments</h3>
                        <div className="space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex items-center space-x-2">
                                <Paperclip className="h-4 w-4" />
                                <span className="text-sm truncate max-w-[300px]">{file.name}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRemoveFile(index)}
                                className="h-6 w-6 p-0"
                              >
                                <XIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t mt-auto">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                    <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                      <SelectTrigger className="w-auto min-w-[100px] h-8">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">
                          <div className="flex items-center">
                            <ArrowDown className="h-3 w-3 mr-1 text-green-500" />
                            <span>Low</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="medium">
                          <div className="flex items-center">
                            <ArrowRight className="h-3 w-3 mr-1 text-yellow-500" />
                            <span>Medium</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="high">
                          <div className="flex items-center">
                            <ArrowUp className="h-3 w-3 mr-1 text-red-500" />
                            <span>High</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-auto min-w-[140px] justify-start text-left font-normal h-8",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3 w-3" />
                          {dueDate ? format(dueDate, "MMM d") : <span>Due date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent portalled={false} className="w-auto p-0" align="start" side="bottom">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={(date) => {
                            setDueDate(date ?? undefined);
                            setCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <div className="flex items-center space-x-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Weight"
                        value={weight ?? ''}
                        onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                    
                    <Popover open={isLabelPickerOpen} onOpenChange={setIsLabelPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Add labels">
                                <TagIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent portalled={false} className="w-[250px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search labels..." value={labelSearchText} onValueChange={setLabelSearchText} />
                                <CommandList>
                                    <CommandEmpty>No labels found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableBoardLabels
                                            .filter(label => label.name.toLowerCase().includes(labelSearchText.toLowerCase()))
                                            .map((label) => (
                                            <CommandItem
                                                key={label.id}
                                                value={label.name}
                                                onSelect={() => handleToggleLabel(label.id)}
                                                className="flex justify-between items-center"
                                            >
                                                <div className="flex items-center">
                                                    <span style={{ backgroundColor: label.color }} className="inline-block w-3 h-3 rounded-sm mr-2"></span>
                                                    {label.name}
                                                </div>
                                                {selectedLabelIds.has(label.id) && <CheckIcon className="h-4 w-4 ml-auto" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Add assignees">
                                <UsersIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent portalled={false} className="w-[250px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search assignees..." value={assigneeSearchText} onValueChange={setAssigneeSearchText} />
                                <CommandList>
                                    <CommandEmpty>No users found.</CommandEmpty>
                                    <CommandGroup>
                                        {boardMembers
                                            /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
                                            .filter(member => 
                                                member.user && (
                                                    !assigneeSearchText ||
                                                    member.user.name?.toLowerCase().includes(assigneeSearchText.toLowerCase()) ||
                                                    member.user.email?.toLowerCase().includes(assigneeSearchText.toLowerCase())
                                                )
                                            )
                                            /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
                                            .map((member) => (
                                            <CommandItem
                                                key={member.user.id}
                                                value={member.user.name ?? member.user.email ?? member.user.id}
                                                onSelect={() => handleToggleAssignee(member.user.id)}
                                                className="flex justify-between items-center"
                                            >
                                                <div className="flex items-center">
                                                    {member.user.image ? (
                                                        <img src={member.user.image} alt={member.user.name ?? ''} className="w-5 h-5 rounded-full mr-2" />
                                                    ) : (
                                                        <span className="w-5 h-5 rounded-full mr-2 bg-muted flex items-center justify-center text-xs">
                                                            {(member.user.name ?? member.user.email ?? 'U').substring(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                    {member.user.name ?? member.user.email}
                                                </div>
                                                {selectedAssigneeIds.has(member.user.id) && <CheckIcon className="h-4 w-4 ml-auto" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      title="Attach files"
                      onClick={handleClickAttachButton}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      className="hidden"
                      multiple
                    />
                  </div>
                  <Button onClick={handleSubmit} disabled={!title.trim()} className="h-8">
                    Create Card
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}; 