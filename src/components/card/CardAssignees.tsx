'use client';

import React, { useState } from 'react';
import { PlusCircleIcon, CheckIcon } from 'lucide-react';
import { Button } from '~/components/ui/button';
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
} from '~/components/ui/command';
import type { Card, User } from '~/types';

interface CardAssigneesProps {
  card: Card;
  availableUsers: User[];
  onToggleAssignee: (assigneeId: string) => void;
}

export const CardAssignees: React.FC<CardAssigneesProps> = ({
  card,
  availableUsers,
  onToggleAssignee
}) => {
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearchText, setAssigneeSearchText] = useState('');
  
  const currentCardAssigneeIds = new Set(card.assignees?.map(a => a.id) || []);

  const filteredUsers = (availableUsers || []).filter(user =>
    (user.name?.toLowerCase().includes(assigneeSearchText.toLowerCase()) ||
     user.email?.toLowerCase().includes(assigneeSearchText.toLowerCase()))
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-sm">Assignees</h4>
        <div className="w-[28px] h-[28px] relative flex-shrink-0 flex items-center justify-center">
          <Popover open={isAssigneePickerOpen} onOpenChange={setIsAssigneePickerOpen} modal={true}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                <PlusCircleIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              portalled={false}
              className="w-[250px] p-0" 
              align="end"
              sideOffset={5}
            >
              <Command>
                <CommandInput
                  placeholder="Search users..."
                  value={assigneeSearchText}
                  onValueChange={setAssigneeSearchText}
                />
                <CommandList>
                  <CommandGroup>
                    {filteredUsers.map(user => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => onToggleAssignee(user.id)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            {user.image ? (
                              <img 
                                src={user.image} 
                                alt={user.name || 'User'} 
                                className="w-6 h-6 rounded-full mr-2" 
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mr-2 text-xs font-semibold">
                                {(user.name || user.email || 'U').substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-sm">{user.name || user.email}</span>
                              {user.name && user.email && (
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              )}
                            </div>
                          </div>
                          {currentCardAssigneeIds.has(user.id) && (
                            <CheckIcon className="h-4 w-4" />
                          )}
                        </div>
                      </CommandItem>
                    ))}
                    {filteredUsers.length === 0 && (
                      <CommandEmpty>No users found.</CommandEmpty>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Display current assignees */}
      <div className="flex flex-wrap gap-2 mt-1">
        {card.assignees && card.assignees.length > 0 ? (
          card.assignees.map(assignee => (
            <div 
              key={assignee.id} 
              className="flex items-center space-x-2 bg-muted/50 rounded-md px-2 py-1 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => onToggleAssignee(assignee.id)}
            >
              {assignee.image ? (
                <img 
                  src={assignee.image} 
                  alt={assignee.name || 'Assignee'} 
                  className="w-5 h-5 rounded-full" 
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">
                  {(assignee.name || assignee.email || 'U').substring(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium">{assignee.name || assignee.email}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">No assignees.</p>
        )}
      </div>
    </div>
  );
}; 