'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner'; // Import toast from sonner

interface ShareBoardSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  boardId: string;
  boardTitle: string;
}

// Define expected API response structure
interface ApiResponse {
  message?: string;
  error?: string;
}

export const ShareBoardSheet: React.FC<ShareBoardSheetProps> = ({
  isOpen,
  onOpenChange,
  boardId,
  boardTitle,
}) => {
  const [emailToShareWith, setEmailToShareWith] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Removed local error/success message states, will rely on toasts primarily
  // const [error, setError] = useState<string | null>(null);
  // const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset state when dialog is closed or boardId changes
  useEffect(() => {
    if (!isOpen) {
      setEmailToShareWith('');
      setIsLoading(false);
      // setError(null);
      // setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToShareWith.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/boards/${boardId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailToShareWith }),
      });

      const result = await response.json() as ApiResponse; // Typed API response with assertion

      if (!response.ok) {
        throw new Error(result.error ?? 'Failed to share board'); // Use nullish coalescing
      }

      toast.success(result.message ?? 'Board shared successfully!'); // Use nullish coalescing
      setEmailToShareWith(''); // Clear input on success
      // Optionally close the dialog after a short delay
      setTimeout(() => onOpenChange(false), 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg w-full max-w-md p-6 z-[70]"
              >
                <Dialog.Close asChild>
                  <button className="absolute top-3 right-3 p-1 rounded hover:bg-muted/10 text-muted-foreground hover:text-foreground">
                    <XIcon className="h-4 w-4" />
                  </button>
                </Dialog.Close>
                
                <Dialog.Title className="text-lg font-semibold">
                  {`Share "${boardTitle}"`}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground mt-1 mb-4">
                  Enter the email address of the user you want to share this board with.
                  They will receive an email notification.
                </Dialog.Description>
                
                <form onSubmit={handleSubmit} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email-to-share" className="sr-only"> 
                      Email
                    </Label>
                    <Input
                      id="email-to-share"
                      type="email"
                      value={emailToShareWith}
                      onChange={(e) => setEmailToShareWith(e.target.value)}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      className="w-full" // Ensure input takes full width within form
                    />
                  </div>
                  {/* Removed direct error/success message display, relying on toasts */}
                  
                  <div className="flex justify-end space-x-2 mt-4">
                    <Dialog.Close asChild>
                      <Button type="button" variant="outline" disabled={isLoading}>
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button type="submit" disabled={isLoading || !emailToShareWith.trim()}>
                      {isLoading ? 'Sharing...' : 'Share Board'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}; 