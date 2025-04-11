import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { Board, Card, Comment, Attachment } from '~/types';
import { createDefaultBoard } from '~/types/defaults';
import crypto from 'crypto'; // Import crypto for UUID generation

// For static export, this forces the route to be included in the export
export const dynamic = 'force-static';
export const revalidate = false;

// Data file paths - for development mode
const DATA_DIR = path.join(process.cwd(), 'data');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
// Static file path - for production/export mode
const STATIC_BOARD_FILE = '/data/board.json';

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
  // For static export, return a mock response
  if (process.env.NODE_ENV === 'production') {
    // In static exports, create a static response
    const defaultBoard = createDefaultBoard();
    return NextResponse.json(defaultBoard);
  }

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
  // For static export, return a mock success response
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: true });
  }

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
  // For static export, return a mock success response
  if (process.env.NODE_ENV === 'production') {
    const defaultBoard = createDefaultBoard();
    return NextResponse.json(defaultBoard);
  }

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
    
    let updated = false;

    if (data.action === 'updateTheme' && data.theme) {
      // Update the theme
      board.theme = data.theme;
      updated = true;
    } else if (data.action === 'addComment' && data.cardId && data.comment) {
      // Add a comment to a specific card
      const { cardId, comment } = data as { cardId: string, comment: { author: string, content: string } };
      const newComment: Comment = {
        id: crypto.randomUUID(),
        author: comment.author || 'User', // Default author
        content: comment.content,
        createdAt: new Date(),
      };
      board.columns.forEach(column => {
        column.cards.forEach(card => {
          if (card.id === cardId) {
            card.comments = [...(card.comments || []), newComment];
            updated = true;
          }
        });
      });
    } else if (data.action === 'deleteComment' && data.cardId && data.commentId) {
      // Delete a comment from a specific card
      const { cardId, commentId } = data as { cardId: string, commentId: string };
      board.columns.forEach(column => {
        column.cards.forEach(card => {
          if (card.id === cardId && card.comments) {
            card.comments = card.comments.filter(c => c.id !== commentId);
            updated = true;
          }
        });
      });
    } else if (data.action === 'addAttachment' && data.cardId && data.attachment) {
        // Add an attachment to a specific card
        const { cardId, attachment } = data as { cardId: string, attachment: { name: string, url: string, type: string } };
        const newAttachment: Attachment = {
            id: crypto.randomUUID(),
            name: attachment.name,
            url: attachment.url,
            type: attachment.type || 'link', // Default type
            createdAt: new Date(),
        };
        board.columns.forEach(column => {
            column.cards.forEach(card => {
                if (card.id === cardId) {
                    card.attachments = [...(card.attachments || []), newAttachment];
                    updated = true;
                }
            });
        });
    } else if (data.action === 'deleteAttachment' && data.cardId && data.attachmentId) {
        // Delete an attachment from a specific card
        const { cardId, attachmentId } = data as { cardId: string, attachmentId: string };
        board.columns.forEach(column => {
            column.cards.forEach(card => {
                if (card.id === cardId && card.attachments) {
                    card.attachments = card.attachments.filter(a => a.id !== attachmentId);
                    updated = true;
                }
            });
        });
    }
    
    if (updated) {
      // Write the updated board back to the file
      await fs.writeFile(BOARD_FILE, JSON.stringify(board, null, 2), 'utf-8');
      return NextResponse.json(board); // Return the updated board
    } else {
      // If no action matched or no update occurred, return original board or error
      // Check if it was just an unknown action or if the item wasn't found
       if (data.action && !['updateTheme', 'addComment', 'deleteComment', 'addAttachment', 'deleteAttachment'].includes(data.action)) {
         return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
       } else {
         // Action might be valid but target card/comment/attachment not found, return current board state
         return NextResponse.json(board);
       }
    }

  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json({ error: 'Failed to update board data' }, { status: 500 });
  }
} 