'use client';

import React from 'react';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import type { Comment, ActivityLog } from '~/types';
import Markdown from '~/components/ui/Markdown';

interface CardActivityFeedProps {
  cardId: string;
  isLoadingComments: boolean;
  isLoadingActivityLogs: boolean;
  combinedFeedItems: FeedItem[];
}

type FeedItem = (Comment & { itemType: 'comment' }) | (ActivityLog & { itemType: 'activity' });

function formatActivity(activity: ActivityLog): string {
  const details = activity.details;
  
  switch (activity.actionType) {
    case 'CREATE_CARD':
      return 'created this card';
      
    case 'UPDATE_CARD_TITLE':
      return `changed the title from "${details?.old || 'untitled'}" to "${details?.new || 'untitled'}"`;
      
    case 'UPDATE_CARD_DESCRIPTION':
      if (details?.old && details?.new) {
        return `updated the description`;
      } else if (details?.new) {
        return `added a description`;
      } else {
        return `removed the description`;
      }
      
    case 'UPDATE_CARD_PRIORITY':
      return `changed priority from ${details?.old || 'none'} to ${details?.new || 'none'}`;
      
    case 'UPDATE_CARD_DUEDATE':
      if (details?.old && details?.new) {
        const oldDate = new Date(details.old).toLocaleDateString();
        const newDate = new Date(details.new).toLocaleDateString();
        return `changed due date from ${oldDate} to ${newDate}`;
      } else if (details?.new) {
        const newDate = new Date(details.new).toLocaleDateString();
        return `set due date to ${newDate}`;
      } else {
        return `removed the due date`;
      }
      
    case 'UPDATE_CARD_WEIGHT':
      if (details?.old !== undefined && details?.new !== undefined) {
        return `changed weight from ${details.old} to ${details.new}`;
      } else if (details?.new !== undefined) {
        return `set weight to ${details.new}`;
      } else {
        return `removed the weight`;
      }
      
    case 'ADD_LABEL_TO_CARD':
      return `added label "${details?.labelName || 'Unknown Label'}"`;
      
    case 'REMOVE_LABEL_FROM_CARD':
      return `removed label "${details?.labelName || 'Unknown Label'}"`;
      
    case 'ADD_ASSIGNEE_TO_CARD':
      return `assigned ${details?.assigneeName || 'Unknown User'}`;
      
    case 'REMOVE_ASSIGNEE_FROM_CARD':
      return `unassigned ${details?.assigneeName || 'Unknown User'}`;
      
    case 'MOVE_CARD':
      if (details?.oldColumnName && details?.newColumnName) {
        if (details.oldColumnName === details.newColumnName) {
          return `moved this card within "${details.newColumnName}"`;
        } else {
          return `moved this card from "${details.oldColumnName}" to "${details.newColumnName}"`;
        }
      } else {
        return `moved this card`;
      }
      
    case 'DELETE_CARD':
      return `deleted this card`;
      
    case 'ADD_COMMENT':
      return 'added a comment';
      
    case 'ADD_FILE_ATTACHMENT_TO_CARD':
      return `attached file "${details?.attachmentName || 'Unknown File'}"`;
      
    case 'ADD_LINK_ATTACHMENT_TO_CARD':
      return `added link "${details?.attachmentName || 'Unknown Link'}"`;
      
    case 'DELETE_ATTACHMENT_FROM_CARD':
      return `removed attachment "${details?.attachmentName || 'Unknown File'}"`;
      
    case 'ATTACH_FILE':
      return `attached file "${details?.fileName || details?.attachmentName || 'Unknown File'}"`;
      
    case 'REMOVE_ATTACHMENT':
      return `removed attachment "${details?.fileName || details?.attachmentName || 'Unknown File'}"`;
      
    default:
      return `performed action: ${activity.actionType}`;
  }
}

export const CardActivityFeed: React.FC<CardActivityFeedProps> = ({
  isLoadingComments,
  isLoadingActivityLogs,
  combinedFeedItems
}) => {
  const isLoading = isLoadingComments || isLoadingActivityLogs;

  return (
    <div className="text-sm">
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Loading activity...</p>
        </div>
      )}
      
      {!isLoading && combinedFeedItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No activity or comments yet</p>
          <p className="text-xs mt-1.5 opacity-80">Be the first to start the conversation!</p>
        </div>
      )}
      
      {!isLoading && combinedFeedItems.length > 0 && (
        <div className="relative">
          {/* Timeline line - connects from description box to bottom */}
          <div className="absolute left-4 -top-4 bottom-0 w-0.5 bg-border/60" />
          
          <div className="space-y-0">
            {combinedFeedItems.map((item, index) => {
              const isLast = index === combinedFeedItems.length - 1;
              
              if (item.itemType === 'comment') {
                return (
                  <CommentItem 
                    key={`comment-${item.id}`} 
                    comment={item} 
                    isLast={isLast}
                  />
                );
              }
              
              return (
                <ActivityItem 
                  key={`activity-${item.id}`} 
                  activity={item} 
                  isLast={isLast}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  isLast: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, isLast }) => {
  return (
    <div className={`relative pl-10 ${!isLast ? 'pb-5' : 'pb-0'}`}>
      {/* Avatar container with background circle */}
      <div className="absolute left-0 flex items-center justify-center">
        <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center border-[0.5px] border-border/40 shadow-sm">
          <UserAvatar 
            user={comment.user} 
            size="small"
            className="w-7 h-7"
          />
        </div>
      </div>
      
      {/* Comment content */}
      <div className="bg-muted/20 border border-border rounded-lg shadow-sm transition-shadow hover:shadow-md">
        {/* Comment header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-b border-border rounded-t-lg">
          <div className="flex items-center space-x-2.5">
            <span className="font-semibold text-sm text-foreground">
              {comment.user?.name || comment.user?.email}
            </span>
            <span className="text-xs text-muted-foreground/80">
              commented {format(new Date(comment.createdAt), 'MMM d, yyyy \'at\' h:mm a')}
            </span>
          </div>
        </div>
        
        {/* Comment body */}
        <div className="px-4 py-3.5">
          <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none leading-relaxed">
            <Markdown 
              content={comment.content} 
              className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0" 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface ActivityItemProps {
  activity: ActivityLog;
  isLast: boolean;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity, isLast }) => {
  return (
    <div className={`relative pl-10 ${!isLast ? 'pb-4' : 'pb-0'}`}>
      {/* Avatar container - replacing icon with user avatar */}
      <div className="absolute left-0 flex items-center justify-center">
        <div className="w-8 h-8 bg-background rounded-full flex items-center justify-center border-[0.5px] border-border/40 shadow-sm">
          <UserAvatar 
            user={activity.user} 
            size="small"
            className="w-7 h-7"
          />
        </div>
      </div>
      
      {/* Activity content - perfectly aligned with avatar center */}
      <div className="flex items-center min-h-[32px] pl-4">
        <div className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">
            {activity.user?.name || activity.user?.email || 'System'}
          </span>
          <span className="mx-1.5">{formatActivity(activity)}</span>
          <span className="text-xs opacity-75 ml-1">
            {format(new Date(activity.createdAt), 'MMM d \'at\' h:mm a')}
          </span>
        </div>
      </div>
    </div>
  );
};

interface UserAvatarProps {
  user?: { 
    id: string; 
    name?: string | null; 
    email?: string | null; 
    image?: string | null; 
  } | null;
  size?: 'small' | 'medium';
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8'
  };
  
  const textSizes = {
    small: 'text-[10px]',
    medium: 'text-xs'
  };

  const initials = (user?.name || user?.email || 'U').substring(0, size === 'small' ? 1 : 2).toUpperCase();

  if (user?.image) {
    return (
      <img 
        src={user.image} 
        alt={user.name || 'User avatar'} 
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`} 
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-muted border flex items-center justify-center ${textSizes[size]} font-medium text-muted-foreground ${className}`}>
      {initials}
    </div>
  );
}; 