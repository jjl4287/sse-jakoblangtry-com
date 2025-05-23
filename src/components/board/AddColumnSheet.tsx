import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { useColumnMutations } from '~/hooks/useColumn';

interface AddColumnSheetProps {
  boardId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnAdded?: () => void;
  /** Optional optimized mutation function */
  createColumn?: (boardId: string, data: { title: string; width: number }) => Promise<void>;
}

export const AddColumnSheet: React.FC<AddColumnSheetProps> = ({ 
  boardId, 
  isOpen, 
  onOpenChange, 
  onColumnAdded, 
  createColumn 
}) => {
  const { createColumn: defaultCreateColumn } = useColumnMutations();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (isOpen) {
      // Auto-focus the input when the sheet opens
      setTimeout(() => {
        const input = document.querySelector('input[name="column-name"]') as HTMLInputElement;
        input?.focus();
      }, 100);
    } else {
      resetForm();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await (createColumn || defaultCreateColumn)(boardId, { title: name.trim(), width: 300 });
      onOpenChange(false);
      onColumnAdded?.();
      resetForm();
    } catch (error) {
      console.error('Error creating column:', error);
    } finally {
      setIsSubmitting(false);
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
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg shadow-lg w-full max-w-[420px] p-6 z-[70]"
              >
                <Dialog.Close asChild>
                  <button className="absolute top-4 right-4 p-2 rounded hover:bg-muted/10">
                    <XIcon className="size-4" />
                  </button>
                </Dialog.Close>
                
                <div className="space-y-4">
                  <div>
                    <Dialog.Title className="text-xl font-bold">Add Column</Dialog.Title>
                    <Dialog.Description className="text-sm text-muted-foreground mt-1">
                      Enter a name for your new column.
                    </Dialog.Description>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      name="column-name"
                      placeholder="Column name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="text-base"
                      autoComplete="off"
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={!name.trim() || isSubmitting}
                      >
                        {isSubmitting ? 'Adding...' : 'Add Column'}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}; 