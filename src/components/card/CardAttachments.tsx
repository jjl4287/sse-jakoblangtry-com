'use client';

import React, { useState, useRef } from 'react';
import { Paperclip, Link2, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover';
import { AttachmentPreview } from '../board/AttachmentPreview';
import type { Card, Attachment } from '~/types';

interface CardAttachmentsProps {
  card: Card;
  onAddAttachment: (file: File) => Promise<void>;
  onAddAttachmentUrl: (url: string, name: string, type: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
  optimisticAttachments?: OptimisticUIAttachment[];
}

// Types for optimistic UI
interface OptimisticUIAttachment extends Attachment {
  cardId: string;
  isOptimistic: true;
}

export const CardAttachments: React.FC<CardAttachmentsProps> = ({
  card,
  onAddAttachment,
  onAddAttachmentUrl,
  onDeleteAttachment,
  optimisticAttachments = []
}) => {
  const [attachmentLinkUrl, setAttachmentLinkUrl] = useState('');
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isSavingAttachment, setIsSavingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSavingAttachment(true);
    try {
      await onAddAttachment(file);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsSavingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddLinkAttachment = async () => {
    if (!attachmentLinkUrl.trim()) return;

    setIsSavingAttachment(true);
    try {
      const name = attachmentLinkName.trim() || new URL(attachmentLinkUrl).hostname;
      await onAddAttachmentUrl(attachmentLinkUrl, name, 'link');
      setAttachmentLinkUrl('');
      setAttachmentLinkName('');
      setIsLinkPopoverOpen(false);
    } catch (error) {
      console.error('Error adding link:', error);
    } finally {
      setIsSavingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, isOptimistic?: boolean) => {
    if (isOptimistic) {
      // Handle optimistic attachment deletion differently if needed
      return;
    }
    await onDeleteAttachment(attachmentId);
  };

  // Combine confirmed and optimistic attachments
  const allAttachments = [
    ...card.attachments.map(att => ({ ...att, isOptimistic: false as const })),
    ...optimisticAttachments
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Attachments</h3>
      
      {/* Attachment Actions */}
      <div className="pt-2 mt-2 border-t">
        <div className="flex flex-col items-start gap-2 mt-2">
          {/* Attach File Button */}
          <div className="w-full">
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isSavingAttachment}
              className="w-full justify-start"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              {isSavingAttachment ? 'Uploading...' : 'Attach File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
          </div>

          {/* Add Link Button */}
          <div className="w-full">
            <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={isSavingAttachment}
                  className="w-full justify-start"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Add Link
                </Button>
              </PopoverTrigger>
              <PopoverContent portalled={false} className="w-80" align="start">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Add Link</h4>
                  <Input
                    placeholder="URL"
                    value={attachmentLinkUrl}
                    onChange={(e) => setAttachmentLinkUrl(e.target.value)}
                  />
                  <Input
                    placeholder="Display name (optional)"
                    value={attachmentLinkName}
                    onChange={(e) => setAttachmentLinkName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddLinkAttachment}
                      disabled={!attachmentLinkUrl.trim() || isSavingAttachment}
                      size="sm"
                    >
                      {isSavingAttachment ? 'Adding...' : 'Add Link'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAttachmentLinkUrl('');
                        setAttachmentLinkName('');
                        setIsLinkPopoverOpen(false);
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Display Attachments */}
      {allAttachments.length > 0 && (
        <div className="mt-4 space-y-2">
          {allAttachments.map((attachment) => (
            <AttachmentPreview 
              key={attachment.id}
              url={attachment.url}
              filename={attachment.name}
              type={attachment.type}
              onDelete={() => handleDeleteAttachment(attachment.id, attachment.isOptimistic)}
              isOptimistic={attachment.isOptimistic}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 