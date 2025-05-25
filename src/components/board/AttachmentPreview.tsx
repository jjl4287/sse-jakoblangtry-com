'use client';

import React, { useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '~/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog';

interface AttachmentPreviewProps {
  url: string;
  filename?: string;
  type?: string;
  onDelete: () => void;
  isOptimistic?: boolean;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ url, filename, type, onDelete, isOptimistic }) => {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  
  // Function to check if a string is a valid URL
  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleConfirmDelete = () => {
    onDelete();
    setIsConfirmDialogOpen(false);
  };

  // Use filename if provided, otherwise fallback to URL
  const displayName = filename || url;
  const containerClasses = `bg-muted/20 border border-border rounded-md p-3 flex justify-between items-start gap-3 transition-colors hover:bg-muted/30 ${isOptimistic ? 'opacity-70' : ''}`;
  
  // Render delete button with confirmation dialog
  const renderDeleteButton = () => (
    <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 p-1.5 h-8 w-8 flex-shrink-0 transition-all hover:scale-110"
          aria-label="Delete attachment"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{displayName}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  
  // For links or files that are not images/YouTube
  const renderGenericPreview = () => (
    <div className={containerClasses}>
      <div className="flex-1 min-w-0">
        <a 
          href={url}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
          onClick={(e) => e.stopPropagation()}
        >
          <Paperclip className="w-3 h-3 mr-1.5 flex-shrink-0" />
          <span className="truncate">{displayName}</span>
        </a>
        {filename && url !== displayName && <p className="text-xs text-muted-foreground truncate">{url}</p>}
      </div>
      {renderDeleteButton()}
    </div>
  );

  if (isValidUrl(url)) {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();
      const pathname = parsedUrl.pathname.toLowerCase();

      // YouTube embed
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        const videoId = hostname.includes('youtube.com') 
          ? parsedUrl.searchParams.get('v')
          : parsedUrl.pathname.substring(1);
          
        if (videoId) {
          return (
            <div className={containerClasses}>
              <div className="flex-1 min-w-0">
                <div className="relative pt-[56.25%] w-full overflow-hidden rounded mb-1">
                  <iframe 
                    className="absolute top-0 left-0 w-full h-full border-0"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <p className="text-xs text-muted-foreground truncate">{displayName}</p>
              </div>
              {renderDeleteButton()}
            </div>
          );
        }
      }

      // Image embed (common extensions)
      // Use type if available, otherwise fallback to extension check
      const isImageType = type?.startsWith('image/') || /\.(jpeg|jpg|gif|png|webp|svg)$/.test(pathname);
      if (isImageType) {
        return (
          <div className={containerClasses}>
            <div className="flex-1 min-w-0">
              <div className="relative w-full h-32 mb-1 overflow-hidden rounded">
                <Image 
                  src={url} 
                  alt={displayName || 'Attachment preview'} 
                  fill
                  sizes="(max-width: 640px) 100vw, 200px"
                  className="object-cover"
                />
                <a 
                  href={url}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-10"
                  aria-label={`View ${displayName}`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <p className="text-xs text-muted-foreground truncate">{displayName}</p>
            </div>
            {renderDeleteButton()}
          </div>
        );
      }
    } catch (error) {
      console.error("Error parsing attachment URL or rendering preview:", error);
      // Fall through to generic link if URL parsing fails or it's not a special type
    }
  }
  // Fallback for non-URL strings or other types
  return renderGenericPreview();
}; 