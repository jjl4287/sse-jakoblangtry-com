'use client';

import React from 'react';
import { format } from 'date-fns';
import { MessageSquareText } from 'lucide-react';
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
      
    case 'ATTACH_FILE':
      return `attached file "${details?.fileName || 'Unknown File'}"`;
      
    case 'REMOVE_ATTACHMENT':
      return `removed attachment "${details?.fileName || 'Unknown File'}"`;
      
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
    <div className="mt-6 text-sm">
      <h3 className="text-base font-semibold mb-3 flex items-center text-foreground">
        <MessageSquareText className="h-5 w-5 mr-2" />
        Activity & Comments
      </h3>
      
      <div className="space-y-4 mb-6">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Loading feed...</p>
        )}
        
        {!isLoading && combinedFeedItems.length === 0 && (
          <p className="text-xs text-muted-foreground">No activity or comments yet.</p>
        )}
        
        {combinedFeedItems.map((item) => {
          if (item.itemType === 'comment') {
            return <CommentItem key={`comment-${item.id}`} comment={item} />;
          }
          
          return <ActivityItem key={`activity-${item.id}`} activity={item} />;
        })}
      </div>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment }) => {
  return (
    <div className="flex items-start space-x-3">
      <UserAvatar 
        user={comment.user} 
        size="small"
        className="mt-1"
      />
      <div className="flex-1 bg-muted/30 p-3 rounded-lg border border-muted/50">
        <div className="flex items-center space-x-2 mb-1">
          <span className="font-semibold text-sm text-foreground">
            {comment.user?.name ?? comment.user?.email}
          </span>
          <span className="text-xs text-muted-foreground">
            commented {format(new Date(comment.createdAt), 'MMM d, yyyy h:mm a')}
          </span>
        </div>
        <div className="text-sm text-foreground whitespace-pre-wrap">
          <Markdown content={comment.content} className="prose-sm" />
        </div>
      </div>
    </div>
  );
};

interface ActivityItemProps {
  activity: ActivityLog;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ activity }) => {
  return (
    <div className="flex items-start space-x-3 text-xs py-1">
      <UserAvatar 
        user={activity.user} 
        size="small"
      />
      <div className="flex-1 pt-1 text-muted-foreground">
        <span className="font-semibold">
          {activity.user?.name ?? activity.user?.email ?? 'System'}
        </span>
        <span> {formatActivity(activity)} </span>
        <span className="opacity-80 ml-1">
          ({format(new Date(activity.createdAt), 'MMM d, h:mm a')})
        </span>
      </div>
    </div>
  );
};

interface UserAvatarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  size?: 'small' | 'medium';
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'w-7 h-7',
    medium: 'w-10 h-10'
  };
  
  const textSizes = {
    small: 'text-[10px]',
    medium: 'text-sm'
  };

  const initials = (user?.name ?? user?.email ?? 'U').substring(0, size === 'small' ? 1 : 2).toUpperCase();

  if (user?.image) {
    return (
      <img 
        src={user.image} 
        alt={user.name ?? 'User avatar'} 
        className={`${sizeClasses[size]} rounded-full ${className}`} 
      />
    );
  }

  return (
    <span className={`${sizeClasses[size]} rounded-full bg-muted flex items-center justify-center ${textSizes[size]} font-semibold ${className}`}>
      {initials}
    </span>
  );
}; 