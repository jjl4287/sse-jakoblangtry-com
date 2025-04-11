import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createDefaultBoard } from '~/types/defaults';
import type { Board } from '~/types';

// Path to the data file relative to the project root
// Ensure this path is correct for your deployment environment
const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const BOARD_FILE_PATH = path.join(DATA_DIR, 'board.json');

// Ensure the data directory exists
const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err: any) {
    // Ignore EEXIST error (directory already exists)
    if (err.code !== 'EEXIST') {
      console.error('Failed to create data directory:', err);
      throw err; // Re-throw other errors
    }
  }
};

// Helper to read the board data
const readBoardData = async (): Promise<Board> => {
  try {
    await ensureDataDir();
    const fileContent = await fs.readFile(BOARD_FILE_PATH, 'utf8');
    return JSON.parse(fileContent) as Board;
  } catch (error: any) {
    // If file doesn't exist (ENOENT) or is empty/invalid JSON, return default
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.warn(`board.json not found or invalid. Creating default board.`);
      const defaultBoard = createDefaultBoard();
      // Attempt to write the default board back
      try {
        await fs.writeFile(BOARD_FILE_PATH, JSON.stringify(defaultBoard, null, 2), 'utf8');
      } catch (writeError) {
         console.error('Failed to write default board.json:', writeError);
      }
      return defaultBoard;
    }
    // Re-throw other errors
    console.error('Failed to read board.json:', error);
    throw error;
  }
};

// Helper to write the board data
const writeBoardData = async (data: Board): Promise<void> => {
  try {
    await ensureDataDir();
    await fs.writeFile(BOARD_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write board.json:', error);
    throw error; // Re-throw error to indicate failure
  }
};

/**
 * GET handler to retrieve the board data.
 */
export async function GET(request: Request) {
  try {
    const boardData = await readBoardData();
    return NextResponse.json(boardData);
  } catch (error) {
    console.error('[API GET /api/boards] Error:', error);
    return NextResponse.json({ error: 'Failed to load board data' }, { status: 500 });
  }
}

/**
 * POST handler to update the board data.
 */
export async function POST(request: Request) {
  try {
    const boardData = await request.json();
    // Optional: Add validation logic here to ensure boardData conforms to Board type
    await writeBoardData(boardData);
    return NextResponse.json({ success: true });
  } catch (error) {
     console.error('[API POST /api/boards] Error:', error);
     // Differentiate between bad request (invalid JSON) and server error
     if (error instanceof SyntaxError) {
         return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
     }
     return NextResponse.json({ error: 'Failed to save board data' }, { status: 500 });
  }
} 