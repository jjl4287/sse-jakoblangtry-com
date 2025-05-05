'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { CardLabels } from './CardLabels';
import { CardComments } from './CardComments';
import { CardAttachments } from './CardAttachments';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import { Trash2, X } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '~/components/ui/select';
import type { CardWithIncludes } from '~/types';
import { useBoard } from '~/services/board-context';

interface CardDetailsSheetProps {
  card: CardWithIncludes | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CardDetailsSheet: React.FC<CardDetailsSheetProps> = ({ card, isOpen, onOpenChange }) => {
  const { updateCard, deleteCard, boardMembers, milestones, assignUserToCard, setCardMilestone } = useBoard();

  // Local editable state
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(card?.title ?? '');
  const [isDescEditing, setIsDescEditing] = useState(false);
  const [descValue, setDescValue] = useState(card?.description ?? '');

  // Update local state if card changes
  useEffect(() => {
    if (card) {
      setTitleValue(card.title ?? '');
      setDescValue(card.description ?? '');
    }
  }, [card]);

  if (!card) {
    return null;
  }

  const handleSaveChanges = () => {
    void updateCard(card.id, { title: titleValue.trim(), description: descValue.trim() });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (confirm('Delete this card?')) {
      void deleteCard(card.id);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full p-0 overflow-y-auto flex flex-col bg-background sm:max-w-[60%] !max-w-7xl" 
        side="right"
      >
        {/* Close button in top right */}
        <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </SheetClose>

        {/* Header with title */}
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-2xl font-bold cursor-text flex items-center gap-2">
            {isTitleEditing ? (
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={() => {
                  setIsTitleEditing(false);
                  void updateCard(card.id, { title: titleValue.trim() });
                }}
                onKeyDown={(e) => e.key === 'Enter' && setIsTitleEditing(false)}
                autoFocus
                className="flex-1"
              />
            ) : (
              <div onDoubleClick={() => setIsTitleEditing(true)} className="flex-1">
                {titleValue}
              </div>
            )}
          </SheetTitle>
          <SheetDescription>
            Edit card details here. Double-click title or description to edit.
          </SheetDescription>
        </SheetHeader>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Left column: Description & Comments */}
            <div className="flex-grow p-6 space-y-6">
              {/* Description Section */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                {isDescEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      onBlur={() => {
                        setIsDescEditing(false);
                        void updateCard(card.id, { description: descValue.trim() });
                      }}
                      autoFocus
                      className="min-h-[120px] w-full"
                      placeholder="Add a description..."
                    />
                    <div className="text-xs text-muted-foreground">
                      Supports markdown formatting
                    </div>
                  </div>
                ) : (
                  <div
                    className="prose dark:prose-invert max-w-full bg-background/60 p-3 rounded-md border border-border cursor-text"
                    onDoubleClick={() => setIsDescEditing(true)}
                  >
                    {descValue ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{descValue}</ReactMarkdown>
                    ) : (
                      <p className="italic text-muted-foreground">
                        No description. Double-click to add.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Comments</h3>
                <CardComments cardId={card.id} comments={card.comments ?? []} />
              </div>
            </div>

            {/* Right column: Metadata & Actions */}
            <div className="w-full md:w-80 p-6 space-y-6 border-t md:border-t-0 md:border-l">
              {/* Assignees */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Assignees</h4>
                <Select
                  value={card.assignees[0]?.id ?? ''}
                  onValueChange={(value) => assignUserToCard(card.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {boardMembers.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          <Avatar className="h-5 w-5 mr-2"><AvatarFallback>{member.name.charAt(0)}</AvatarFallback></Avatar>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <div className="p-2 border rounded-md text-sm">
                  {card.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {card.assignees.map(user => (
                        <Avatar key={user.id} className="h-6 w-6">
                          <AvatarFallback>{user.name?.charAt(0) ?? '?'}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-1 text-sm">None</div>
                  )}
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Labels</h4>
                <div className="p-2 border rounded-md">
                  <CardLabels cardId={card.id} labels={card.labels ?? []} />
                </div>
              </div>

              {/* Milestone */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Milestone</h4>
                <Select
                  value={card.milestone?.id ?? ''}
                  onValueChange={(value) => setCardMilestone(card.id, value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {milestones.map(ms => (
                        <SelectItem key={ms.id} value={ms.id}>{ms.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Attachments</h4>
                <div className="border rounded-md p-2">
                  <CardAttachments cardId={card.id} attachments={card.attachments ?? []} />
                </div>
              </div>

              {/* Delete Card Button */}
              <Button variant="destructive" onClick={handleDelete} className="w-full mt-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Card
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}; 