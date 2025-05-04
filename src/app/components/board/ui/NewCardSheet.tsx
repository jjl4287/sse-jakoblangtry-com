import React, { useState, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '~/components/ui/sheet';
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from '~/lib/utils';
import { format } from 'date-fns';
import { Priority } from '@prisma/client';
import { User as UserIcon, Tag, Milestone as MilestoneIcon, Flag, CalendarIcon as CalendarIconLucide } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";

// Import necessary types
import type { User, Label as LabelType, Milestone, BoardMemberWithUser } from '~/types';

interface NewCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  boardMembers: BoardMemberWithUser[];
  milestones: Milestone[];
  labels: LabelType[];
  onCreateCard: (cardData: CreateCardData) => Promise<void>;
}

// Define the type for the card data created by this sheet
// This should match the `CreateCardData` type in board-context.tsx and SortableColumn.tsx
type CreateCardData = Partial<Omit<import('~/types').Card, 'id' | 'order' | 'columnId'>> & {
  title: string;
  columnId: string;
  order?: number; 
  assignees?: { connect: { id: string }[] };
  labels?: { connect: { id: string }[] };
  milestoneId?: string;
  priority?: Priority;
  dueDate?: Date;
};

// Helper to get initials for Avatar Fallback
const getInitials = (name?: string | null) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
};

export function NewCardSheet({ 
  open, 
  onOpenChange, 
  columnId, 
  boardMembers, 
  milestones, 
  labels: availableLabels,
  onCreateCard 
}: NewCardSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<Priority | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const users: User[] = useMemo(() => boardMembers.map((member: BoardMemberWithUser) => member.user), [boardMembers]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSelectedAssigneeIds([]);
    setSelectedLabelIds([]);
    setSelectedMilestoneId(undefined);
    setSelectedPriority(undefined);
    setDueDate(undefined);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return; // Basic validation
    setIsLoading(true);

    const cardData = {
      title,
      description,
      columnId,
      order: Date.now(), // Placeholder for proper order calculation
      assignees: selectedAssigneeIds.length > 0 ? { connect: selectedAssigneeIds.map(id => ({ id })) } : undefined,
      labels: selectedLabelIds.length > 0 ? { connect: selectedLabelIds.map(id => ({ id })) } : undefined,
      milestoneId: selectedMilestoneId,
      priority: selectedPriority,
      dueDate,
    };

    try {
      await onCreateCard(cardData as CreateCardData);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create card:", error);
      // TODO: Show error toast to user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full flex flex-col sm:max-w-4xl">
        <form onSubmit={handleSubmit} id="new-card-form" className="flex-1 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="text-2xl font-semibold">Create New Card</SheetTitle>
            <SheetDescription>
              Fill in the details to create a new card for this column.
            </SheetDescription>
          </SheetHeader>

          <div className="col-span-2 flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter a title for this card..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-2xl font-semibold"
            />
            <textarea
              placeholder="Enter a description for this card..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="col-span-1 flex flex-col gap-4 border-l pl-6 pr-2 overflow-y-auto">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><UserIcon size={16} /> Assignees</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-start text-muted-foreground">
                    {selectedAssigneeIds.length > 0 
                      ? <div className="flex items-center gap-1">{users.filter(u => selectedAssigneeIds.includes(u.id)).slice(0, 3).map(user => (
                          <Avatar key={user.id} className="h-5 w-5 text-xs">
                            <AvatarImage src={user.image ?? undefined} />
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                        ))}{selectedAssigneeIds.length > 3 ? ` +${selectedAssigneeIds.length - 3}` : ''}</div>
                      : "Select assignees..."
                    }
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Assign users</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {users.map((user) => (
                    <DropdownMenuCheckboxItem
                      key={user.id}
                      checked={selectedAssigneeIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAssigneeIds(prev => 
                          checked ? [...prev, user.id] : prev.filter(id => id !== user.id)
                        );
                      }}
                    >
                      <Avatar className="h-5 w-5 mr-2">
                        <AvatarImage src={user.image ?? undefined} />
                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      {user.name ?? user.email}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Tag size={16} /> Labels</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-start h-auto min-h-[2.5rem] flex-wrap">
                    {selectedLabelIds.length > 0
                      ? <div className="flex flex-wrap gap-1">{availableLabels.filter(l => selectedLabelIds.includes(l.id)).map(label => (
                          <Badge key={label.id} variant="outline" style={{ borderColor: label.color, color: label.color }}>{label.name}</Badge>
                        ))}</div>
                      : <span className="text-muted-foreground">Select labels...</span>
                    }
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Apply labels</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableLabels.map((label) => (
                    <DropdownMenuCheckboxItem
                      key={label.id}
                      checked={selectedLabelIds.includes(label.id)}
                      onCheckedChange={(checked) => {
                        setSelectedLabelIds(prev =>
                          checked ? [...prev, label.id] : prev.filter(id => id !== label.id)
                        );
                      }}
                    >
                      <span className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: label.color }}></span>
                      {label.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><MilestoneIcon size={16} /> Milestone</Label>
              <Select value={selectedMilestoneId} onValueChange={setSelectedMilestoneId}>
                <SelectTrigger className="text-muted-foreground">
                  <SelectValue placeholder="Select milestone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No milestone</SelectItem>
                  {milestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><Flag size={16} /> Priority</Label>
              <Select value={selectedPriority} onValueChange={(value) => setSelectedPriority(value as Priority | undefined)}>
                <SelectTrigger className="text-muted-foreground">
                  <SelectValue placeholder="Select priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  {Object.values(Priority).map((priority) => (
                    <SelectItem key={priority} value={priority} className="capitalize">{priority.toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />

            <div className="grid gap-2">
              <Label className="flex items-center gap-2"><CalendarIconLucide size={16} /> Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => setDueDate(date ?? undefined)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <SheetFooter className="mt-auto px-6 py-4 border-t bg-background">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" form="new-card-form">
              Create Card
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
