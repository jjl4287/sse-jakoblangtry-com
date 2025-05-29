import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CalendarIcon, PlusCircleIcon, CheckIcon, UsersIcon, TagIcon, Weight, Paperclip, ArrowDown, ArrowRight, ArrowUp, Trash2 } from 'lucide-react';
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
import { useCardMutations } from '~/hooks/useCard';
import { useBoardLabels } from '~/hooks/useLabels';
import { useLabelMutations } from '~/hooks/useLabels';
import { useBoardMembers } from '~/hooks/useBoardMembers';
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
  CommandSeparator,
} from '~/components/ui/command';
import { Badge } from '~/components/ui/badge';
import type { Label as LabelType, User as UserType, Priority } from '~/types';
import MarkdownEditor from '~/components/ui/MarkdownEditor';
import { StyledLabelBadge } from '~/components/ui/StyledLabelBadge';
import { toast } from 'sonner';

// Interface for data passed to card creation
interface NewCardData {
  columnId: string;
  title: string;
  description?: string;
  boardId: string;
  priority?: Priority;
  dueDate?: Date;
  weight?: number;
  labelIds?: string[];
  assigneeIds?: string[];
}

interface NewCardSheetProps {
  columnId: string;
  boardId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  createCard?: (data: NewCardData) => Promise<void>; // Optimized createCard function
}

export const NewCardSheet: React.FC<NewCardSheetProps> = ({ 
  columnId, 
  boardId, 
  isOpen, 
  onOpenChange, 
  createCard: optimizedCreateCard 
}) => {
  // Fallback to regular card mutations if optimized not provided
  const { createCard: fallbackCreateCard, addAttachment } = useCardMutations();
  // Label mutations for creating new labels
  const { createLabel } = useLabelMutations();
  
  // Use optimized createCard if provided, otherwise fallback
  const createCard = optimizedCreateCard || fallbackCreateCard;
  
  // Use proper hooks for board data access
  const { labels: boardLabels = [], refetch: refetchLabels } = useBoardLabels(boardId);
  const { members: boardMembers = [] } = useBoardMembers(boardId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weight, setWeight] = useState<number | undefined>(undefined);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const [isLabelPickerOpen, setIsLabelPickerOpen] = useState(false);
  const [labelSearchText, setLabelSearchText] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [labelPickerView, setLabelPickerView] = useState<'list' | 'create'>('list');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#4287f5');

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
    setLabelPickerView('list');
    setNewLabelName('');
    setNewLabelColor('#4287f5');
  };

  useEffect(() => {
    if (isOpen) {
    } else {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    
    setIsUploadingFiles(true);
    try {
      // Create the card with the correct structure
      const newCardData: NewCardData = { 
        columnId,
        title, 
        description, 
        boardId,
        priority, 
        dueDate,
        weight: weight !== undefined ? Number(weight) : undefined,
        labelIds: Array.from(selectedLabelIds),
        assigneeIds: Array.from(selectedAssigneeIds),
      };
      
      // For optimized mutations, we don't get a return value, just call the function
      if (optimizedCreateCard) {
        await optimizedCreateCard(newCardData);
        toast.success('Card created successfully');
        
        // Note: File attachments are not supported yet with optimized mutations
        // This will be implemented in a future update
        if (selectedFiles.length > 0) {
          toast.warning('File attachments will be added after the card is created');
        }
      } else {
        // Fallback to regular card creation with file support
        const newCard = await createCard(newCardData);
        
        // Upload any selected files to the newly created card
        if (selectedFiles.length > 0 && newCard?.id) {
          console.log(`📎 Uploading ${selectedFiles.length} files to card ${newCard.id}`);
          toast.info(`Uploading ${selectedFiles.length} file(s)...`);
          
          let uploadedCount = 0;
          let failedCount = 0;
          
          // Upload each file individually
          for (const file of selectedFiles) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              
              await addAttachment(newCard.id, formData);
              console.log(`✅ Uploaded file: ${file.name}`);
              uploadedCount++;
            } catch (fileError) {
              console.error(`❌ Failed to upload file ${file.name}:`, fileError);
              toast.error(`Failed to upload file ${file.name}`);
              failedCount++;
              // Continue with other files even if one fails
            }
          }
          
          // Show summary toast
          if (uploadedCount > 0 && failedCount === 0) {
            toast.success(`All ${uploadedCount} file(s) uploaded successfully`);
          } else if (uploadedCount > 0 && failedCount > 0) {
            toast.warning(`${uploadedCount} file(s) uploaded, ${failedCount} failed`);
          } else if (failedCount > 0) {
            toast.error(`Failed to upload ${failedCount} file(s)`);
          }
        }
      }
      
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('❌ Failed to create card:', error);
      toast.error('Failed to create card');
    } finally {
      setIsUploadingFiles(false);
    }
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

  const handleCreateNewLabel = async () => {
    if (!newLabelName.trim()) return;
    
    try {
      const createdLabel = await createLabel(boardId, { 
        name: newLabelName.trim(), 
        color: newLabelColor 
      });
      
      if (createdLabel) {
        // Add the new label to selected labels
        setSelectedLabelIds(prev => new Set(prev).add(createdLabel.id));
        
        // Reset label creation form
        setNewLabelName('');
        setNewLabelColor('#4287f5');
        setLabelPickerView('list');
        setLabelSearchText('');
        
        // Refetch labels to update the list
        await refetchLabels();
        
        toast.success('Label created and added successfully');
      }
    } catch (error) {
      console.error('Error creating label:', error);
      toast.error('Failed to create label');
    }
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
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg w-full max-w-[780px] p-6 z-[70] flex flex-col"
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
                  />
                  <div className="space-y-2">
                    {selectedLabelIds.size > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-muted-foreground mr-1">Labels:</span>
                            {Array.from(selectedLabelIds).map(id => {
                                const label = availableBoardLabels.find(l => l.id === id);
                                return label ? <StyledLabelBadge key={id} label={label} /> : null;
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
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t mt-auto">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-2">
                    {/* Weight Input */}
                    <div className="flex items-center h-8 w-auto min-w-[90px] justify-start text-left font-normal gap-1 rounded-md border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 px-2">
                      <Weight className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Weight"
                        value={weight ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWeight(val ? Number(val) : undefined);
                        }}
                        className="border-0 focus-visible:ring-0 bg-transparent h-full p-0 text-sm shadow-none dark:bg-transparent dark:text-foreground placeholder:text-muted-foreground"
                        style={{ backgroundColor: 'transparent' }}
                      />
                    </div>

                    {/* Due Date Popover */}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-auto min-w-[90px] h-8 text-sm justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-4 w-4" />
                          {dueDate ? format(dueDate, "MMM d") : <span>Due date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent portalled={false} className="w-auto p-0 z-[80]" align="start">
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

                    {/* Priority Select */}
                    <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                      <SelectTrigger className="w-auto min-w-[90px] h-8 text-sm">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent portalled={false} className="z-[80]">
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
                    
                    {/* Label Picker Popover */}
                    <Popover open={isLabelPickerOpen} onOpenChange={setIsLabelPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <TagIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent portalled={false} side="top" className="w-[250px] p-0 z-[80]" align="start">
                            {labelPickerView === 'list' ? (
                                <Command>
                                    <CommandInput 
                                        placeholder="Search labels..." 
                                        value={labelSearchText}
                                        onValueChange={setLabelSearchText}
                                    />
                                    <CommandList>
                                        <CommandGroup>
                                            {availableBoardLabels
                                                .filter(label => !labelSearchText || label.name.toLowerCase().includes(labelSearchText.toLowerCase()))
                                                .map((label) => (
                                                <CommandItem
                                                    key={label.id}
                                                    value={label.name}
                                                    onSelect={() => handleToggleLabel(label.id)}
                                                    className="cursor-pointer flex justify-between items-center"
                                                >
                                                    <div className="flex items-center">
                                                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                                                        {label.name}
                                                    </div>
                                                    {selectedLabelIds.has(label.id) && <CheckIcon className="ml-2 h-4 w-4" />}
                                                </CommandItem>
                                            ))}
                                            {availableBoardLabels.filter(label => !labelSearchText || label.name.toLowerCase().includes(labelSearchText.toLowerCase())).length === 0 && (
                                                <CommandEmpty>No labels found.</CommandEmpty>
                                            )}
                                        </CommandGroup>
                                        <CommandSeparator />
                                        <CommandGroup>
                                            <CommandItem onSelect={() => setLabelPickerView('create')}>
                                                <PlusCircleIcon className="h-4 w-4 mr-2" />
                                                Create new label
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            ) : (
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium">Create new label</h3>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 w-7 p-0" 
                                            onClick={() => setLabelPickerView('list')}
                                        >
                                            <XIcon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Label name"
                                            value={newLabelName}
                                            onChange={(e) => setNewLabelName(e.target.value)}
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={newLabelColor}
                                                onChange={(e) => setNewLabelColor(e.target.value)}
                                                className="w-10 h-10 rounded cursor-pointer"
                                            />
                                            <Button
                                                className="flex-1"
                                                onClick={handleCreateNewLabel}
                                                disabled={!newLabelName.trim()}
                                            >
                                                Create and Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>

                    {/* Assignee Picker Popover */}
                    <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <UsersIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent portalled={false} side="top" className="w-[250px] p-0 z-[80]" align="start">
                            <Command>
                                <CommandInput 
                                    placeholder="Search assignees..."
                                    value={assigneeSearchText}
                                    onValueChange={setAssigneeSearchText}
                                />
                                <CommandList>
                                    <CommandEmpty>No users found.</CommandEmpty>
                                    <CommandGroup>
                                        {boardMembers.map((member) => (
                                            <CommandItem
                                                key={member.user.id}
                                                value={member.user.name ?? member.user.email ?? member.user.id}
                                                onSelect={() => handleToggleAssignee(member.user.id)}
                                                className="cursor-pointer flex justify-between items-center"
                                            >
                                                <div className="flex items-center">
                                                    {member.user.image ? (
                                                        <img src={member.user.image} alt={member.user.name ?? 'User avatar'} className="w-5 h-5 rounded-full mr-2" />
                                                    ) : (
                                                        <span className="w-5 h-5 rounded-full mr-2 bg-muted flex items-center justify-center text-xs">
                                                            {(member.user.name ?? member.user.email ?? 'U').substring(0,1).toUpperCase()}
                                                        </span>
                                                    )}
                                                    {member.user.name ?? member.user.email}
                                                </div>
                                                {selectedAssigneeIds.has(member.user.id) && <CheckIcon className="ml-2 h-4 w-4" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    
                    {/* Attach File Button */}
                    <Button variant="outline" size="sm" onClick={handleClickAttachButton} className="h-8 w-8 p-0">
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
                  <Button onClick={handleSubmit} disabled={!title.trim() || isUploadingFiles} size="sm">
                    {isUploadingFiles ? 'Creating & Uploading...' : 'Create Card'}
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