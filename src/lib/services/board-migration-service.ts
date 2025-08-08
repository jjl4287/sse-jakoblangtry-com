import { localStorageService, type LocalBoard } from './local-storage-service';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  duplicateBoards: string[];
}

class BoardMigrationService {
  async migrateLocalBoards(): Promise<MigrationResult> {
    const localBoards = localStorageService.getLocalBoards();
    
    if (localBoards.length === 0) {
      return {
        success: true,
        migratedCount: 0,
        errors: [],
        duplicateBoards: []
      };
    }

    const result: MigrationResult = {
      success: true,
      migratedCount: 0,
      errors: [],
      duplicateBoards: []
    };

    // Get existing user boards to check for title conflicts
    let existingTitles: string[] = [];
    try {
      const boardsResponse = await fetch('/api/boards');
      if (boardsResponse.ok) {
        const existingBoards = await boardsResponse.json();
        existingTitles = existingBoards.map((b: { title: string }) => b.title.toLowerCase());
      }
    } catch (error) {
      console.error('Error fetching existing boards for migration:', error);
    }

    // Migrate each local board
    for (const localBoard of localBoards) {
      try {
        await this.migrateBoard(localBoard, existingTitles, result);
      } catch (error) {
        console.error(`Error migrating board "${localBoard.title}":`, error);
        result.errors.push(`Failed to migrate "${localBoard.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    // Clear local storage if all migrations were successful
    if (result.success && result.errors.length === 0) {
      localStorageService.clearLocalBoards();
    }

    return result;
  }

  private async migrateBoard(
    localBoard: LocalBoard, 
    existingTitles: string[], 
    result: MigrationResult
  ): Promise<void> {
    // Check for title conflicts and handle them
    let finalTitle = localBoard.title;
    const lowercaseTitle = localBoard.title.toLowerCase();
    
    if (existingTitles.includes(lowercaseTitle)) {
      // Generate a unique title
      let counter = 1;
      let uniqueTitle: string;
      do {
        uniqueTitle = `${localBoard.title} (${counter})`;
        counter++;
      } while (existingTitles.includes(uniqueTitle.toLowerCase()));
      
      finalTitle = uniqueTitle;
      result.duplicateBoards.push(localBoard.title);
    }

    // Create the board
    const boardResponse = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: finalTitle })
    });

    if (!boardResponse.ok) {
      throw new Error(`Failed to create board: ${boardResponse.statusText}`);
    }

    const newBoard = await boardResponse.json();
    const boardId = newBoard.id;

    // Migrate columns if any exist
    if (localBoard.columns.length > 0) {
      for (const column of localBoard.columns) {
        await this.migrateColumn(boardId, column);
      }
    }

    result.migratedCount++;
    existingTitles.push(finalTitle.toLowerCase()); // Add to prevent future conflicts in same migration
  }

  private async migrateColumn(boardId: string, localColumn: { title: string; order: number; width?: number; cards?: Array<unknown> }): Promise<void> {
    // Create the column
    const columnResponse = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: localColumn.title,
        boardId: boardId,
        order: localColumn.order,
        width: localColumn.width || 300
      })
    });

    if (!columnResponse.ok) {
      throw new Error(`Failed to create column "${localColumn.title}": ${columnResponse.statusText}`);
    }

    const newColumn = await columnResponse.json();
    const columnId = newColumn.id;

    // Migrate cards if any exist
    if (localColumn.cards && localColumn.cards.length > 0) {
      for (const card of localColumn.cards) {
        await this.migrateCard(columnId, card);
      }
    }
  }

  private async migrateCard(columnId: string, localCard: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    order?: number;
    dueDate?: string;
    weight?: number;
  }): Promise<void> {
    const cardData = {
      title: localCard.title,
      description: localCard.description || '',
      columnId: columnId,
      priority: (localCard.priority as 'low' | 'medium' | 'high' | undefined) || 'medium',
      order: localCard.order || 0,
      dueDate: localCard.dueDate || undefined,
      weight: localCard.weight || undefined
    };

    const cardResponse = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(cardData)
    });

    if (!cardResponse.ok) {
      throw new Error(`Failed to create card "${localCard.title}": ${cardResponse.statusText}`);
    }

    // Note: Labels and attachments would need additional migration logic
    // if they were supported in local storage
  }

  // Check if migration is needed
  hasBoardsToMigrate(): boolean {
    return localStorageService.getLocalBoardCount() > 0;
  }

  // Get preview of what will be migrated
  getMigrationPreview(): { count: number; titles: string[] } {
    const localBoards = localStorageService.getLocalBoards();
    return {
      count: localBoards.length,
      titles: localBoards.map(b => b.title)
    };
  }
}

export const boardMigrationService = new BoardMigrationService(); 