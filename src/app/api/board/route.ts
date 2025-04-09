import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Board } from '~/types';
import { createDefaultBoard } from '~/types/defaults';

// Data file paths
const DATA_DIR = path.join(process.cwd(), 'data');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');

// Ensure the data directory exists
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// GET /api/board
export async function GET() {
  try {
    await ensureDataDir();
    
    try {
      // Check if the file exists
      await fs.access(BOARD_FILE);
    } catch (error) {
      // If file doesn't exist, create a default board
      const defaultBoard = createDefaultBoard();
      await fs.writeFile(BOARD_FILE, JSON.stringify(defaultBoard, null, 2), 'utf-8');
      return NextResponse.json(defaultBoard);
    }
    
    // Read and parse the file
    const data = await fs.readFile(BOARD_FILE, 'utf-8');
    const board = JSON.parse(data);
    
    return NextResponse.json(board);
  } catch (error) {
    console.error('Error reading board:', error);
    return NextResponse.json({ error: 'Failed to read board data' }, { status: 500 });
  }
}

// POST /api/board
export async function POST(request: Request) {
  try {
    await ensureDataDir();
    const board = await request.json() as Board;
    
    // Write the board data to the file
    await fs.writeFile(BOARD_FILE, JSON.stringify(board, null, 2), 'utf-8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing board:', error);
    return NextResponse.json({ error: 'Failed to write board data' }, { status: 500 });
  }
}

// PATCH /api/board - Update specific parts of the board
export async function PATCH(request: Request) {
  try {
    await ensureDataDir();
    const data = await request.json();
    
    // Read the current board data
    let board: Board;
    try {
      // Check if the file exists
      await fs.access(BOARD_FILE);
      const fileData = await fs.readFile(BOARD_FILE, 'utf-8');
      board = JSON.parse(fileData);
    } catch (error) {
      // If file doesn't exist, create a default board
      board = createDefaultBoard();
    }
    
    if (data.action === 'updateTheme' && data.theme) {
      // Update the theme
      board.theme = data.theme;
      
      // Write the updated board back to the file
      await fs.writeFile(BOARD_FILE, JSON.stringify(board, null, 2), 'utf-8');
      
      return NextResponse.json(board);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json({ error: 'Failed to update board data' }, { status: 500 });
  }
} 