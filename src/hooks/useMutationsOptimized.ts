import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { 
  Board, 
  Card, 
  Column, 
  Label, 
  User, 
  Priority,
  CardUpdate,
  ColumnUpdate,
  BoardUpdate,
  CardCreateData,
  ColumnCreateData
} from '~/types';
import { localStorageService } from '~/lib/services/local-storage-service';

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
  originalState?: Partial<Card>;
}

interface ColumnReorderOperation extends BaseOperation {
  type: 'column_reorder';
  boardId: string;
  columnOrders: { id: string; order: number }[];
  originalState?: Column[];
}

interface CardUpdateOperation extends BaseOperation {
  type: 'card_update';
  cardId: string;
  updates: CardUpdate;
  originalState?: Partial<Card>;
}

interface CardCreateOperation extends BaseOperation {
  type: 'card_create';
  tempId: string;
  cardData: CardCreateData;
}

interface ColumnCreateOperation extends BaseOperation {
  type: 'column_create';
  tempId: string;
  boardId: string;
  columnData: ColumnCreateData;
}

interface ColumnUpdateOperation extends BaseOperation {
  type: 'column_update';
  columnId: string;
  updates: ColumnUpdate;
  originalState?: Partial<Column>;
}

interface ColumnDeleteOperation extends BaseOperation {
  type: 'column_delete';
  columnId: string;
  boardId: string;
  originalState?: Column;
}

interface CardDeleteOperation extends BaseOperation {
  type: 'card_delete';
  cardId: string;
  originalState?: {
    card: Card;
    columnId: string;
    cardIndex: number;
  };
}

interface BoardUpdateOperation extends BaseOperation {
  type: 'board_update';
  boardId: string;
  updates: BoardUpdate;
  originalState?: Partial<Board>;
}

type Operation = 
  | CardMoveOperation 
  | ColumnReorderOperation 
  | CardUpdateOperation 
  | CardCreateOperation 
  | ColumnCreateOperation 
  | ColumnUpdateOperation 
  | ColumnDeleteOperation 
  | CardDeleteOperation
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
      case 'column_update':
        return `column_update_${operation.columnId}`;
      case 'column_delete':
        return `column_delete_${operation.columnId}`;
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

      case 'column_update':
        const incomingColumnUpdate = incoming as Omit<ColumnUpdateOperation, 'id' | 'timestamp' | 'retryCount' | 'status' | 'dependencies'>;
        return {
          ...existing,
          updates: { ...existing.updates, ...incomingColumnUpdate.updates },
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
        const typeOrder = { 'card_move': 0, 'column_reorder': 1, 'card_update': 2, 'board_update': 3, 'card_create': 4, 'column_create': 5, 'column_update': 6, 'column_delete': 7 };
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
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessing = useRef(false);

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
    let originalState: Partial<Card> | null = null;

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
    let originalState: Column[] | null = null;

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

  const updateCard = useCallback(async (cardId: string, updates: CardUpdate) => {
    if (!boardId) return;

    let originalState: Partial<Card> | null = null;

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

  // Interface for input data (without order field which is calculated)
  interface NewCardInput {
    columnId: string;
    title: string;
    description?: string;
    boardId: string;
    priority?: Priority;
    dueDate?: Date;
    weight?: number;
    labelIds?: string[];
    assigneeIds?: string[];
  }

  const createCard = useCallback(async (inputData: NewCardInput) => {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    
    // Transform input to match CardCreateData interface
    const cardData: CardCreateData = {
      ...inputData,
      order: 0 // Will be overridden by actual position calculation
    };
    
    updateBoardLocal((board) => {
      const newColumns = board.columns.map(col => {
        if (col.id === cardData.columnId) {
          const newCard: Card = {
            id: tempId,
            title: cardData.title,
            description: cardData.description || '',
            order: col.cards.length, // Calculate actual order
            priority: cardData.priority || 'medium',
            dueDate: cardData.dueDate || undefined,
            weight: cardData.weight || undefined,
            columnId: cardData.columnId,
            labels: [],
            assignees: [],
            attachments: [],
            comments: []
          };
          
          return { ...col, cards: [...col.cards, newCard] };
        }
        return col;
      });
      
      return { ...board, columns: newColumns };
    });

    // Update the cardData with the calculated order for the API
    const finalCardData: CardCreateData = {
      ...cardData,
      order: 0 // The API will handle order calculation
    };

    operationQueue.current.addOperation({
      type: 'card_create',
      tempId,
      cardData: finalCardData
    });

    // Trigger processing immediately for card operations
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 50);
  }, [updateBoardLocal]);

  const createColumn = useCallback(async (boardId: string, columnData: { title: string; width?: number }) => {
    const tempId = `temp_col_${Date.now()}_${Math.random()}`;
    
    // Transform input to match ColumnCreateData interface
    const fullColumnData: ColumnCreateData = {
      title: columnData.title,
      width: columnData.width || 300,
      order: 0 // Will be calculated
    };
    
    updateBoardLocal((board) => {
      const newColumn: Column = {
        id: tempId,
        title: fullColumnData.title,
        order: board.columns.length, // Calculate actual order
        width: fullColumnData.width || 300,
        cards: []
      };
      
      return { ...board, columns: [...board.columns, newColumn] };
    });

    // Update the columnData with the calculated order for the API
    const finalColumnData: ColumnCreateData = {
      ...fullColumnData,
      order: 0 // The API will handle order calculation
    };

    operationQueue.current.addOperation({
      type: 'column_create',
      tempId,
      boardId,
      columnData: finalColumnData
    });

    // Trigger processing immediately for column operations
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 50);
  }, [updateBoardLocal]);

  const updateColumn = useCallback(async (columnId: string, updates: ColumnUpdate) => {
    let originalState: Partial<Column> | null = null;

    updateBoardLocal((board) => {
      const newColumns = board.columns.map(col => {
        if (col.id === columnId) {
          originalState = { ...col };
          return { ...col, ...updates };
        }
        return col;
      });
      
      return { ...board, columns: newColumns };
    });

    operationQueue.current.addOperation({
      type: 'column_update',
      columnId,
      updates,
      originalState
    });

    // Trigger processing immediately for column operations
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 50);
  }, [updateBoardLocal]);

  const deleteColumn = useCallback(async (columnId: string) => {
    let originalState: Column | null = null;

    updateBoardLocal((board) => {
      const columnToDelete = board.columns.find(col => col.id === columnId);
      if (columnToDelete) {
        originalState = columnToDelete;
        const newColumns = board.columns.filter(col => col.id !== columnId);
        return { ...board, columns: newColumns };
      }
      return board;
    });

    if (originalState) {
      operationQueue.current.addOperation({
        type: 'column_delete',
        columnId,
        boardId: boardId!,
        originalState
      });

      // Trigger processing immediately for column operations
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
      processTimeoutRef.current = setTimeout(processBatchOperations, 50);
    }
  }, [updateBoardLocal, boardId]);

  const deleteCard = useCallback(async (cardId: string) => {
    if (!boardId) {
      console.warn('deleteCard: No boardId available');
      return;
    }

    let originalState: { card: Card; columnId: string; cardIndex: number } | null = null;

    // Immediate optimistic update - remove card from UI
    updateBoardLocal((board) => {
      const sourceColumn = board.columns.find(col => 
        col.cards.some(card => card.id === cardId)
      );
      
      if (!sourceColumn) {
        console.warn(`deleteCard: Card ${cardId} not found in any column`);
        return board;
      }
      
      const cardIndex = sourceColumn.cards.findIndex(card => card.id === cardId);
      const cardToDelete = sourceColumn.cards[cardIndex];
      
      if (cardIndex === -1 || !cardToDelete) {
        console.warn(`deleteCard: Card ${cardId} not found`);
        return board;
      }

      // Store original state for potential rollback
      originalState = {
        card: cardToDelete,
        columnId: sourceColumn.id,
        cardIndex
      };

      // Remove card from the column and reorder remaining cards
      const newColumns = board.columns.map(col => {
        if (col.id === sourceColumn.id) {
          const filteredCards = col.cards.filter(c => c.id !== cardId);
          // Reorder remaining cards to maintain proper order
          const reorderedCards = filteredCards.map((card, index) => ({
            ...card,
            order: index
          }));
          return { ...col, cards: reorderedCards };
        }
        return col;
      });
      
      return { ...board, columns: newColumns };
    });

    // Only queue operation if we successfully captured original state
    if (originalState) {
      operationQueue.current.addOperation({
        type: 'card_delete',
        cardId,
        originalState
      });

      // Trigger processing immediately for card operations
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
      processTimeoutRef.current = setTimeout(processBatchOperations, 50);
      
      // Show success toast immediately since the UI update is instant
      toast.success('Card deleted successfully');
    } else {
      console.error('deleteCard: Failed to capture original state');
      toast.error('Failed to delete card');
    }
  }, [updateBoardLocal, boardId]);

  const updateBoard = useCallback(async (boardId: string, updates: BoardUpdate) => {
    console.log('[updateBoard] called with', boardId, updates);
    let originalState: Partial<Board> | null = null;

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

    // Trigger processing immediately for board operations
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    processTimeoutRef.current = setTimeout(processBatchOperations, 50);
  }, [updateBoardLocal]);

  // Enhanced batch processor with better error handling
  const processBatchOperations = useCallback(async () => {
    if (!boardId || isProcessing.current) {
      console.log(`⏸️ Skipping batch processing: boardId=${!!boardId}, isProcessing=${isProcessing.current}`);
      return;
    }
    
    isProcessing.current = true;
    
    try {
      const operations = operationQueue.current.getPendingOperations();
      const retryOperations = operationQueue.current.getRetryableOperations();
      
      console.log(`🔍 Batch processing check: ${operations.length} pending, ${retryOperations.length} retryable`);
      
      // Retry failed operations first
      for (const operation of retryOperations) {
        operation.status = 'pending';
        operation.timestamp = Date.now();
        console.log(`🔄 Retrying operation: ${operation.type} (attempt ${operation.retryCount + 1})`);
      }
      
      const allOperations = operationQueue.current.getPendingOperations();
      
      if (allOperations.length === 0) {
        console.log(`✅ No operations to process`);
        isProcessing.current = false;
        return;
      }

      console.log(`🔄 Processing ${allOperations.length} operations...`, allOperations.map(op => `${op.type}:${op.id}`));

      // Process in smaller batches for better reliability
      const BATCH_SIZE = 2;
      for (let i = 0; i < allOperations.length; i += BATCH_SIZE) {
        const batch = allOperations.slice(i, i + BATCH_SIZE);
        console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.map(op => op.type).join(', ')}`);
        
        const batchPromises = batch.map(async (operation) => {
          const promise = processOperation(operation);
          operationQueue.current.markProcessing(operation.id, promise);
          return promise;
        });

        const results = await Promise.allSettled(batchPromises);
        console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1} results:`, results.map((r, idx) => `${batch[idx].type}: ${r.status}`));
        
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
      console.log(`📊 Operation queue status:`, status);
      if (status.pending > 0 || status.failed > 0) {
        console.log(`⏰ Scheduling next batch processing in 300ms`);
        processTimeoutRef.current = setTimeout(processBatchOperations, 300);
      }
    }
  }, [boardId]);

  const processOperation = useCallback(async (operation: Operation): Promise<void> => {
    console.log(`🔄 Processing operation: ${operation.type}`, operation);
    
    // Dynamically check if this operation involves a local board
    const operationBoardId = (() => {
      switch (operation.type) {
        case 'card_move':
        case 'card_update':
        case 'card_create':
          return boardId; // Current board
        case 'column_reorder':
        case 'column_create':
        case 'column_update':
        case 'column_delete':
          return operation.boardId || boardId;
        case 'board_update':
          return operation.boardId;
        default:
          return boardId;
      }
    })();

    console.log(`🔍 Operation board ID: ${operationBoardId}, Current board ID: ${boardId}`);
    
    const isOperationForLocalBoard = operationBoardId ? localStorageService.isLocalBoard(operationBoardId) : false;
    
    console.log(`🏠 Is operation for local board: ${isOperationForLocalBoard}`);
    
    // For local boards, skip API calls - optimistic updates already handled via updateBoardCache
    if (isOperationForLocalBoard) {
      console.log(`✅ Skipping API call for local board operation: ${operation.type}`);
      operationQueue.current.markCompleted(operation.id);
      return;
    }
    
    console.log(`🌐 Proceeding with API call for remote board operation: ${operation.type}`);
    
    try {
      let response: Response;
      
      switch (operation.type) {
        case 'card_move':
          // Additional validation before API call
          if (!operation.cardId || !operation.targetColumnId) {
            throw new Error(`Invalid card move operation: cardId=${operation.cardId}, targetColumnId=${operation.targetColumnId}`);
          }
          
          console.log(`📦 Card move API call: /api/cards/${operation.cardId}/move`);
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
          
          console.log(`📦 Column reorder API call: /api/columns (PATCH)`, { boardId: operation.boardId, columnOrders: operation.columnOrders });
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
          
          console.log(`📦 Card update API call: /api/cards/${operation.cardId}`);
          response = await fetch(`/api/cards/${operation.cardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.updates),
          });
          break;
          
        case 'card_create':
          console.log(`📦 Card create API call: /api/cards`, operation.cardData);
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
          console.log(`📦 Column create API call: /api/columns`, { ...operation.columnData, boardId: operation.boardId });
          response = await fetch('/api/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ...operation.columnData, boardId: operation.boardId }),
          });
          
          if (response.ok) {
            const newColumn = await response.json();
            console.log(`✅ Column created successfully:`, newColumn);
            updateBoardLocal((board) => {
              const newColumns = board.columns.map(col => 
                col.id === operation.tempId ? newColumn : col
              );
              return { ...board, columns: newColumns };
            });
          }
          break;
          
        case 'column_update':
          if (!operation.columnId || !operation.updates) {
            throw new Error(`Invalid column update operation: columnId=${operation.columnId}, updates=${!!operation.updates}`);
          }
          
          console.log(`📦 Column update API call: /api/columns/${operation.columnId}`, operation.updates);
          response = await fetch(`/api/columns/${operation.columnId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.updates),
          });
          break;
          
        case 'column_delete':
          if (!operation.columnId || !operation.boardId) {
            throw new Error(`Invalid column delete operation: columnId=${operation.columnId}, boardId=${operation.boardId}`);
          }
          
          console.log(`📦 Column delete API call: /api/columns/${operation.columnId}`);
          response = await fetch(`/api/columns/${operation.columnId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          break;
          
        case 'card_delete':
          if (!operation.cardId) {
            throw new Error(`Invalid card delete operation: cardId=${operation.cardId}`);
          }
          
          console.log(`📦 Card delete API call: /api/cards/${operation.cardId}`);
          response = await fetch(`/api/cards/${operation.cardId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          break;
          
        case 'board_update':
          console.log(`📦 Board update API call: /api/boards/${operation.boardId}`, operation.updates);
          response = await fetch(`/api/boards/${operation.boardId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(operation.updates),
          });
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      console.log(`📡 Response status for ${operation.type}:`, response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error(`❌ API Error for ${operation.type}:`, {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        
        // Enhanced error message for validation errors
        if (response.status === 400 && errorData.error === 'Validation failed') {
          const validationDetails = errorData.issues?.map((issue: { path?: string[]; message: string }) => 
            `${issue.path?.join('.')}: ${issue.message}`
          ).join(', ') || 'Unknown validation error';
          
          throw new Error(`Validation failed: ${validationDetails}`);
        }
        
        throw new Error(`HTTP ${response.status}: ${errorData.error || errorText}`);
      }
      
      operationQueue.current.markCompleted(operation.id);
      console.log(`✅ Operation ${operation.type} completed successfully`, operation);
      
      // Add success toasts for operations
      switch (operation.type) {
        case 'card_create':
          // Toast is already shown in NewCardSheet
          break;
        case 'card_delete':
          // Toast is already shown immediately in deleteCard function
          break;
        case 'column_create':
          toast.success('Column created successfully');
          break;
        case 'column_update':
          toast.success('Column updated successfully');
          break;
        case 'board_update':
          toast.success('Board title updated successfully');
          // Dispatch global event for board title sync
          window.dispatchEvent(new CustomEvent('boardTitleUpdated', { 
            detail: { boardId: operation.boardId, updates: operation.updates } 
          }));
          break;
        case 'column_delete':
          toast.success('Column deleted successfully');
          break;
        // Don't show toasts for card moves and updates - they're frequent and would be annoying
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Operation ${operation.type} failed (attempt ${operation.retryCount + 1}):`, {
        operation,
        error: errorMessage,
        fullError: error
      });
      
      operationQueue.current.markFailed(operation.id, error as Error);
      
      if (operation.retryCount >= 3) {
        // Handle specific rollback logic for different operation types
        if (operation.type === 'card_delete' && operation.originalState) {
          console.log('🔄 Rolling back card deletion due to API failure');
          
          // Restore the card to its original position
          updateBoardLocal((board) => {
            const newColumns = board.columns.map(col => {
              if (col.id === operation.originalState!.columnId) {
                const newCards = [...col.cards];
                // Insert the card back at its original index
                newCards.splice(operation.originalState!.cardIndex, 0, operation.originalState!.card);
                return { ...col, cards: newCards };
              }
              return col;
            });
            return { ...board, columns: newColumns };
          });
          
          toast.error(`Failed to delete card: ${errorMessage}. Card has been restored.`);
        } else {
          toast.error(`Failed to ${operation.type.replace('_', ' ')}: ${errorMessage}`);
        }
        
        if (operation.originalState && operation.type !== 'card_delete') {
          console.log('🔄 Triggering smart refetch due to final failure');
          smartRefetch();
        }
      }
      
      throw error;
    }
  }, [updateBoardLocal, smartRefetch, boardId]);

  return {
    moveCard,
    updateCard,
    createCard,
    reorderColumns,
    createColumn,
    updateColumn,
    deleteColumn,
    deleteCard,
    updateBoard,
    getOperationStatus: () => operationQueue.current.getStatus()
  };
} 