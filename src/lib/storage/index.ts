import fs from 'fs/promises';
import path from 'path';
import type { Board } from '~/types';
import { BoardSchema } from '~/types/validation';
import { createDefaultBoard } from '~/types/defaults';
import { parseJsonWithDates, stringifyWithDates } from './json-utils';

// Data file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');

/**
 * Ensures the data directory exists
 */
export const ensureDataDir = async (): Promise<void> => {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};

/**
 * Reads the board data from the JSON file
 * @returns The board data or a default board if the file doesn't exist
 */
export const readBoard = async (): Promise<Board> => {
  try {
    await ensureDataDir();
    
    try {
      // Check if the file exists
      await fs.access(BOARD_FILE);
    } catch (error) {
      // If file doesn't exist, create a default board
      const defaultBoard = createDefaultBoard();
      await writeBoard(defaultBoard);
      return defaultBoard;
    }
    
    // Read and parse the file with Date handling
    const data = await fs.readFile(BOARD_FILE, 'utf-8');
    const parsedData = parseJsonWithDates<Board>(data);
    
    // Validate data against schema
    const validationResult = BoardSchema.safeParse(parsedData);
    
    if (!validationResult.success) {
      console.error('Invalid board data:', validationResult.error);
      // If validation fails, create a new default board
      const defaultBoard = createDefaultBoard();
      await writeBoard(defaultBoard);
      return defaultBoard;
    }
    
    return parsedData;
  } catch (error) {
    console.error('Error reading board data:', error);
    // Return a default board in case of errors
    return createDefaultBoard();
  }
};

/**
 * Writes board data to the JSON file
 * @param board The board data to write
 */
export const writeBoard = async (board: Board): Promise<void> => {
  try {
    await ensureDataDir();
    
    // Validate data before writing
    const validationResult = BoardSchema.safeParse(board);
    
    if (!validationResult.success) {
      throw new Error(`Invalid board data: ${validationResult.error}`);
    }
    
    // Create temporary file path
    const tempFile = `${BOARD_FILE}.tmp`;
    
    // Write to temporary file first with Date handling for atomic operation
    await fs.writeFile(tempFile, stringifyWithDates(board), 'utf-8');
    
    // Rename temporary file to actual file (atomic operation)
    await fs.rename(tempFile, BOARD_FILE);
  } catch (error) {
    console.error('Error writing board data:', error);
    throw error;
  }
};

/**
 * Updates a part of the board data
 * @param updateFn Function that receives the current board data and returns updated data
 */
export const updateBoard = async (updateFn: (board: Board) => Board): Promise<Board> => {
  try {
    // Read current board
    const currentBoard = await readBoard();
    
    // Get updated board
    const updatedBoard = updateFn(currentBoard);
    
    // Write the updated board
    await writeBoard(updatedBoard);
    
    return updatedBoard;
  } catch (error) {
    console.error('Error updating board data:', error);
    throw error;
  }
}; 