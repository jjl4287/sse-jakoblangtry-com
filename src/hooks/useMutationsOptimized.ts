import { useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import type { Board, Card, Column, Label, User, Priority } from '~/types';

// Enhanced operation types for better tracking and conflict resolution
interface BaseOperation {
  id: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  dependencies: string[];
}

interface CardMoveOperation extends BaseOperation {
  type: 'card_move';
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  newOrder: number;
  originalState?: any;
}

interface ColumnReorderOperation extends BaseOperation {
  type: 'column_reorder';
  boardId: string;
  columnOrders: { id: string; order: number }[];
  originalState?: any;
}

interface CardUpdateOperation extends BaseOperation {
  type: 'card_update';
  cardId: string;
  updates: any;
  originalState?: any;
}

interface CardCreateOperation extends BaseOperation {
  type: 'card_create';
  tempId: string;
  cardData: any;
}

interface ColumnCreateOperation extends BaseOperation {
  type: 'column_create';
  tempId: string;
  boardId: string;
  columnData: any;
}

interface BoardUpdateOperation extends BaseOperation {
  type: 'board_update';
  boardId: string;
  updates: any;
  originalState?: any;
}

type Operation = 
  | CardMoveOperation 
  | ColumnReorderOperation 
  | CardUpdateOperation 
  | CardCreateOperation 
  | ColumnCreateOperation 
  | BoardUpdateOperation;

// Enhanced conflict resolution and operation merging
class OperationQueue {
  private queue: Map<string, Operation> = new Map();
  private processing: Set<string> = new Set();
  private processingPromises: Map<string, Promise<void>> = new Map();
  
  // Generate operation ID with conflict detection
  private generateOperationId(operation: Omit<Operation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>): string {
    switch (operation.type) {
      case 'card_move':
        return `card_move_${operation.cardId}`;
      case 'column_reorder':
        return `column_reorder_${operation.boardId}`;
      case 'card_update':
        return `card_update_${operation.cardId}`;
      case 'card_create':
        return `card_create_${operation.tempId}`;
      case 'column_create':
        return `column_create_${operation.tempId}`;
      case 'board_update':
        return `board_update_${operation.boardId}`;
      default:
        return `unknown_${Date.now()}_${Math.random()}`;
    }
  }

  // Intelligent operation merging for conflicting operations
  private mergeOperations(existing: Operation, incoming: Omit<Operation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>): Operation {
    if (existing.type !== incoming.type) {
      console.warn('Cannot merge operations of different types');
      return existing;
    }

    switch (existing.type) {
      case 'card_move':
        const incomingMove = incoming as Omit<CardMoveOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>;
        return {
          ...existing,
          targetColumnId: incomingMove.targetColumnId,
          newOrder: incomingMove.newOrder,
          timestamp: Date.now(), // Update timestamp for latest change
        };

      case 'column_reorder':
        const incomingReorder = incoming as Omit<ColumnReorderOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>;
        return {
          ...existing,
          columnOrders: incomingReorder.columnOrders,
          timestamp: Date.now(),
        };

      case 'card_update':
        const incomingUpdate = incoming as Omit<CardUpdateOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>;
        return {
          ...existing,
          updates: { ...existing.updates, ...incomingUpdate.updates },
          timestamp: Date.now(),
        };

      case 'board_update':
        const incomingBoardUpdate = incoming as Omit<BoardUpdateOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>;
        return {
          ...existing,
          updates: { ...existing.updates, ...incomingBoardUpdate.updates },
          timestamp: Date.now(),
        };

      default:
        return existing;
    }
  }

  // Add operation with intelligent conflict resolution
  addOperation(operationData: Omit<Operation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>): string {
    const id = this.generateOperationId(operationData);
    
    const operation: Operation = {
      ...operationData,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      dependencies: []
    } as Operation;

    // Check for existing conflicting operation
    const existing = this.queue.get(id);
    if (existing && existing.status === 'pending') {
      // Merge with existing operation
      const merged = this.mergeOperations(existing, operationData);
      this.queue.set(id, merged);
      console.log(`🔄 Merged operation ${id}`, merged);
    } else {
      this.queue.set(id, operation);
      console.log(`➕ Added operation ${id}`, operation);
    }

    return id;
  }

  // Get all pending operations sorted by dependencies and timestamp
  getPendingOperations(): Operation[] {
    const pending = Array.from(this.queue.values())
      .filter(op => op.status === 'pending' && !this.processing.has(op.id))
      .sort((a, b) => {
        // Prioritize by type (moves first, then updates, then creates)
        const typeOrder = { 'card_move': 0, 'column_reorder': 1, 'card_update': 2, 'board_update': 3, 'card_create': 4, 'column_create': 5 };
        const typeDiff = (typeOrder[a.type] || 999) - (typeOrder[b.type] || 999);
        if (typeDiff !== 0) return typeDiff;
        
        // Then by timestamp
        return a.timestamp - b.timestamp;
      });

    return pending;
  }

  markProcessing(id: string, promise: Promise<void>): void {
    this.processing.add(id);
    this.processingPromises.set(id, promise);
    const operation = this.queue.get(id);
    if (operation) {
      operation.status = 'processing';
    }
  }

  markCompleted(id: string): void {
    this.processing.delete(id);
    this.processingPromises.delete(id);
    this.queue.delete(id);
  }

  markFailed(id: string, error?: Error): void {
    this.processing.delete(id);
    this.processingPromises.delete(id);
    const operation = this.queue.get(id);
    if (operation) {
      operation.status = 'failed';
      operation.retryCount++;
      console.error(`❌ Operation ${id} failed (attempt ${operation.retryCount}):`, error);
    }
  }

  // Retry failed operations with exponential backoff
  getRetryableOperations(): Operation[] {
    const now = Date.now();
    return Array.from(this.queue.values())
      .filter(op => {
        if (op.status !== 'failed' || op.retryCount >= 3) return false;
        
        // Exponential backoff: 1s, 2s, 4s
        const backoffMs = Math.pow(2, op.retryCount - 1) * 1000;
        return (now - op.timestamp) > backoffMs;
      });
  }

  // Wait for all processing operations to complete
  async waitForProcessing(): Promise<void> {
    const promises = Array.from(this.processingPromises.values());
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  clear(): void {
    this.queue.clear();
    this.processing.clear();
    this.processingPromises.clear();
  }

  getStatus() {
    const pending = Array.from(this.queue.values()).filter(op => op.status === 'pending').length;
    const processing = this.processing.size;
    const failed = Array.from(this.queue.values()).filter(op => op.status === 'failed').length;
    return { pending, processing, failed, total: this.queue.size };
  }
}

// Enhanced optimized mutation system
export function useOptimizedMutations(
  boardId: string | null,
  updateBoardLocal: (updater: (board: Board) => Board) => void,
  smartRefetch: () => void
) {
  const operationQueue = useRef(new OperationQueue());
  const isProcessing = useRef(false);
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced mutation functions with better conflict resolution
  const moveCard = useCallback(async (cardId: string, targetColumnId: string, newOrder: number) => {
    if (!boardId) {
      console.warn('moveCard: No boardId available');
      return;
    }

    // Validate required parameters
    if (!cardId || !targetColumnId || typeof newOrder !== 'number') {
      console.error('moveCard: Invalid parameters', { cardId, targetColumnId, newOrder });
      toast.error('Invalid card move parameters');
      return;
    }

    // Capture original state for rollback
    let originalState: any = null;

    // Immediate optimistic update with rollback tracking
    updateBoardLocal((board) => {
      const sourceColumn = board.columns.find(col => 
        col.cards.some(card => card.id === cardId)
      );
      
      if (!sourceColumn) {
        console.warn(`moveCard: Card ${cardId} not found in any column`);
        return board;
      }
      
      const card = sourceColumn.cards.find(c => c.id === cardId);
      if (!card) {
        console.warn(`moveCard: Card ${cardId} not found`);
        return board;
      }

      // Validate target column exists
      const targetColumn = board.columns.find(col => col.id === targetColumnId);
      if (!targetColumn) {
        console.error(`moveCard: Target column ${targetColumnId} not found`);
        toast.error('Target column not found');
        return board;
      }

      // Store original state
      originalState = {
        sourceColumnId: sourceColumn.id,
        originalOrder: card.order,
        card: { ...card }
      };

      const newColumns = board.columns.map(col => {
        if (col.id === targetColumnId) {
          const filteredCards = col.cards.filter(c => c.id !== cardId);
          const newCards = [...filteredCards];
          newCards.splice(newOrder, 0, { ...card, columnId: targetColumnId, order: newOrder });
          
          return {
            ...col,
            cards: newCards.map((c, idx) => ({ ...c, order: idx }))
          };
        } else {
          return {
            ...col,
            cards: col.cards.filter(c => c.id !== cardId)
          };
        }
      });
      
      return { ...board, columns: newColumns };
    });

    // Only queue operation if we have valid original state
    if (!originalState) {
      console.error('moveCard: Failed to capture original state');
      toast.error('Failed to prepare card move');
      return;
    }

    // Queue operation
    operationQueue.current.addOperation({
      type: 'card_move',
      cardId,
      sourceColumnId: originalState.sourceColumnId,
      targetColumnId,
      newOrder,
      originalState
    });

    // Trigger processing with reduced debounce
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 150);
  }, [boardId, updateBoardLocal]);

  const reorderColumns = useCallback(async (boardId: string, columnOrders: { id: string; order: number }[]) => {
    let originalState: any = null;

    // Immediate optimistic update
    updateBoardLocal((board) => {
      originalState = {
        columns: board.columns.map(col => ({ id: col.id, order: col.order }))
      };

      const orderMap = new Map(columnOrders.map(co => [co.id, co.order]));
      const newColumns = [...board.columns]
        .map(col => ({ ...col, order: orderMap.get(col.id) ?? col.order }))
        .sort((a, b) => a.order - b.order);
      
      return { ...board, columns: newColumns };
    });

    // Queue operation
    operationQueue.current.addOperation({
      type: 'column_reorder',
      boardId,
      columnOrders,
      originalState
    });

    // Trigger processing
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 150);
  }, [updateBoardLocal]);

  const updateCard = useCallback(async (cardId: string, updates: any) => {
    if (!boardId) return;

    let originalState: any = null;

    updateBoardLocal((board) => {
      const newColumns = board.columns.map(col => ({
        ...col,
        cards: col.cards.map(card => {
          if (card.id === cardId) {
            if (!originalState) {
              originalState = { ...card };
            }
            
            let updatedCard = { ...card };
            Object.keys(updates).forEach(key => {
              if (key.endsWith('ToAdd') || key.endsWith('ToRemove')) {
                if (key === 'labelIdsToAdd') {
                  const labelsToAdd = board.labels?.filter(l => updates[key].includes(l.id)) || [];
                  updatedCard.labels = [...(updatedCard.labels || []), ...labelsToAdd];
                } else if (key === 'labelIdsToRemove') {
                  updatedCard.labels = (updatedCard.labels || []).filter(l => !updates[key].includes(l.id));
                }
              } else {
                updatedCard[key] = updates[key];
              }
            });
            
            return updatedCard;
          }
          return card;
        })
      }));
      
      return { ...board, columns: newColumns };
    });

    operationQueue.current.addOperation({
      type: 'card_update',
      cardId,
      updates,
      originalState
    });

    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 200);
  }, [boardId, updateBoardLocal]);

  const createCard = useCallback(async (cardData: any) => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    updateBoardLocal((board) => {
      const newColumns = board.columns.map(col => {
        if (col.id === cardData.columnId) {
          const newCard: Card = {
            id: tempId,
            title: cardData.title,
            description: cardData.description || '',
            order: col.cards.length,
            priority: cardData.priority || 'medium',
            dueDate: cardData.dueDate || null,
            weight: cardData.weight || null,
            columnId: cardData.columnId,
            boardId: cardData.boardId,
            labels: [],
            assignees: [],
            attachments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          return { ...col, cards: [...col.cards, newCard] };
        }
        return col;
      });
      
      return { ...board, columns: newColumns };
    });

    operationQueue.current.addOperation({
      type: 'card_create',
      tempId,
      cardData
    });
  }, [updateBoardLocal]);

  const createColumn = useCallback(async (boardId: string, columnData: any) => {
    const tempId = `temp_col_${Date.now()}_${Math.random()}`;
    
    updateBoardLocal((board) => {
      const newColumn: Column = {
        id: tempId,
        title: columnData.title,
        order: board.columns.length,
        width: columnData.width || 300,
        boardId,
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      return { ...board, columns: [...board.columns, newColumn] };
    });

    operationQueue.current.addOperation({
      type: 'column_create',
      tempId,
      boardId,
      columnData
    });
  }, [updateBoardLocal]);

  const updateBoard = useCallback(async (boardId: string, updates: any) => {
    let originalState: any = null;

    updateBoardLocal((board) => {
      originalState = { ...board };
      return { ...board, ...updates };
    });

    operationQueue.current.addOperation({
      type: 'board_update',
      boardId,
      updates,
      originalState
    });
  }, [updateBoardLocal]);

  // Enhanced batch processor with better error handling
  const processBatchOperations = useCallback(async () => {
    if (!boardId || isProcessing.current) return;
    
    isProcessing.current = true;
    
    try {
      const operations = operationQueue.current.getPendingOperations();
      const retryOperations = operationQueue.current.getRetryableOperations();
      
      // Retry failed operations first
      for (const operation of retryOperations) {
        operation.status = 'pending';
        operation.timestamp = Date.now();
      }
      
      const allOperations = operationQueue.current.getPendingOperations();
      
      if (allOperations.length === 0) {
        isProcessing.current = false;
        return;
      }

      console.log(`🔄 Processing ${allOperations.length} operations...`);

      // Process in smaller batches for better reliability
      const BATCH_SIZE = 2;
      for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
        const batch = allOperations.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (operation) => {
          const promise = processOperation(operation);
          operationQueue.current.markProcessing(operation.id, promise);
          return promise;
        });

        await Promise.allSettled(batchPromises);
        
        // Small delay between batches
        if (i + BATCH_SIZE < allOperations.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`✅ Batch processing completed`);

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
    } finally {
      isProcessing.current = false;
      
      // Schedule next processing if needed
      const status = operationQueue.current.getStatus();
      if (status.pending > 0 || status.failed > 0) {
        processTimeoutRef.current = setTimeout(processBatchOperations, 300);
      }
    }
  }, [boardId]);

  const processOperation = useCallback(async (operation: Operation): Promise<void> => {
    try {
      let response: Response;
      
      switch (operation.type) {
        case 'card_move':
          // Additional validation before API call
          if (!operation.cardId || !operation.targetColumnId) {
            throw new Error(`Invalid card move operation: cardId=${operation.cardId}, targetColumnId=${operation.targetColumnId}`);
          }
          
          response = await fetch(`/api/cards/${operation.cardId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              targetColumnId: operation.targetColumnId, 
              order: operation.newOrder 
            }),
          });
          break;
          
        case 'column_reorder':
          if (!operation.boardId || !operation.columnOrders?.length) {
            throw new Error(`Invalid column reorder operation: boardId=${operation.boardId}, orders=${operation.columnOrders?.length}`);
          }
          
          response = await fetch('/api/columns', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              boardId: operation.boardId, 
              columnOrders: operation.columnOrders 
            }),
          });
          break;
          
        case 'card_update':
          if (!operation.cardId || !operation.updates) {
            throw new Error(`Invalid card update operation: cardId=${operation.cardId}, updates=${!!operation.updates}`);
          }
          
          response = await fetch(`/api/cards/${operation.cardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.updates),
          });
          break;
          
        case 'card_create':
          response = await fetch('/api/cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.cardData),
          });
          
          if (response.ok) {
            const newCard = await response.json();
            updateBoardLocal((board) => {
              const newColumns = board.columns.map(col => ({
                ...col,
                cards: col.cards.map(card => 
                  card.id === operation.tempId ? newCard : card
                )
              }));
              return { ...board, columns: newColumns };
            });
          }
          break;
          
        case 'column_create':
          response = await fetch('/api/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ...operation.columnData, boardId: operation.boardId }),
          });
          
          if (response.ok) {
            const newColumn = await response.json();
            updateBoardLocal((board) => {
              const newColumns = board.columns.map(col => 
                col.id === operation.tempId ? newColumn : col
              );
              return { ...board, columns: newColumns };
            });
          }
          break;
          
        case 'board_update':
          response = await fetch(`/api/boards/${operation.boardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.updates),
          });
          break;
          
        default:
          throw new Error(`Unknown operation type: ${(operation as any).type}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        // Enhanced error message for validation errors
        if (response.status === 400 && errorData.error === 'Validation failed') {
          const validationDetails = errorData.issues?.map((issue: any) => 
            `${issue.path?.join('.')}: ${issue.message}`
          ).join(', ') || 'Unknown validation error';
          
          throw new Error(`Validation failed: ${validationDetails}`);
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || errorText}`);
      }
      
      operationQueue.current.markCompleted(operation.id);
      console.log(`✅ Operation ${operation.type} completed successfully`, operation);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Operation ${operation.type} failed (attempt ${operation.retryCount + 1}):`, {
        operation,
        error: errorMessage
      });
      
      operationQueue.current.markFailed(operation.id, error as Error);
      
      if (operation.retryCount >= 3) {
        toast.error(`Failed to ${operation.type.replace('_', ' ')}: ${errorMessage}`);
        if (operation.originalState) {
          console.log('🔄 Triggering smart refetch due to final failure');
          smartRefetch();
        }
      }
      
      throw error;
    }
  }, [updateBoardLocal, smartRefetch]);

  return {
    moveCard,
    updateCard,
    createCard,
    reorderColumns,
    createColumn,
    updateBoard,
    getOperationStatus: () => operationQueue.current.getStatus()
  };
} 