import React, { useState, useCallback, useRef } from 'react';
import { useBoard } from '~/services/board-context';
import type { Attachment } from '~/types';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Paperclip, FileUp, Link as LinkIcon, Trash2 } from 'lucide-react';
import { AttachmentPreview } from '../AttachmentPreview';

export interface CardAttachmentsProps {
  cardId: string;
  attachments: Attachment[];
}

// Main component for displaying and managing attachments
export function CardAttachments({ cardId, attachments }: CardAttachmentsProps) {
  const { addAttachment, deleteAttachment } = useBoard();
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleAddUrl = useCallback(async () => {
    if (!url.trim()) return;
    try {
      const name = new URL(url).hostname.replace('www.', '');
      await addAttachment(cardId, name, url, 'link');
      setUrl('');
    } catch (e) {
      console.error('Failed to add attachment URL:', e);
    }
  }, [url, addAttachment, cardId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  }, []);

  const handleAddFile = useCallback(async () => {
    if (!selectedFile) return;
    try {
      const file = selectedFile;
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        await addAttachment(cardId, file.name, result, file.type);
        setSelectedFile(null);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Failed to add file attachment:', e);
    }
  }, [selectedFile, addAttachment, cardId]);

  const handleDelete = useCallback(async (attachmentId: string) => {
    try {
      await deleteAttachment(cardId, attachmentId);
    } catch (e) {
      console.error('Failed to delete attachment:', e);
    }
  }, [deleteAttachment, cardId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <Paperclip className="mr-2 h-4 w-4 text-gray-300" />
        <span className="text-sm font-medium text-gray-300">Attachments ({attachments.length})</span>
      </div>
      <div className="flex items-center space-x-2">
        <Input
          type="url"
          placeholder="Attachment URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-md"
        />
        <Button onClick={handleAddUrl} size="sm" disabled={!url.trim()}>
          Add Link
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        {/* Hidden file input; triggered by Choose File button */}
        <input
          type="file"
          aria-label="Attachment File"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
        />
        <Button onClick={() => fileInputRef.current?.click()} size="sm">
          Choose File
        </Button>
        {selectedFile && (
          <span className="truncate text-sm">{selectedFile.name}</span>
        )}
        <Button onClick={handleAddFile} size="sm" disabled={!selectedFile}>
          Add File
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center space-x-2">
                <AttachmentPreview url={att.url} />
                <span className="truncate">{att.name}</span>
              </div>
              <Button
                aria-label="Delete attachment"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-400 hover:text-red-400"
                onClick={() => handleDelete(att.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 