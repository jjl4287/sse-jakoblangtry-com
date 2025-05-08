/* eslint-disable */
// @ts-nocheck
import { PrismaClient, Priority } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// Polyfill __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Clear existing data to avoid duplicate-ID errors and ensure clean slate
  console.log('Clearing existing seeded data...');
  await prisma.attachment.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.boardMembership.deleteMany({}); // Clear memberships first
  await prisma.card.deleteMany({});
  await prisma.column.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.user.deleteMany({});
  
  const boardPath = path.join(__dirname, '..', 'data', 'board.json');
  const raw = fs.readFileSync(boardPath, 'utf-8');
  const boardFromFile = JSON.parse(raw); // Renamed to avoid conflict

  console.log('Seeding database...');

  // --- Helper for password hashing ---
  const getSaltRounds = () => {
    const saltRoundsEnv = process.env.BCRYPT_SALT_ROUNDS;
    const saltRounds = parseInt(saltRoundsEnv ?? '10', 10);
    if (isNaN(saltRounds) || saltRounds <= 0) {
      console.warn(
        `Invalid BCRYPT_SALT_ROUNDS value: "${saltRoundsEnv}". Falling back to default value of 10.`
      );
      return 10;
    }
    return saltRounds;
  };
  const saltRounds = getSaltRounds();
  const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

  // --- Create Users ---
  console.log('Creating users...');
  const adminUser = await prisma.user.create({
    data: {
      id: 'admin', // fixed ID for admin user
      name: 'Admin User',
      email: process.env.ADMIN_EMAIL || (() => {
        console.warn('ADMIN_EMAIL environment variable is not set. Falling back to default email: admin@example.com');
        return 'admin@example.com';
      })(),
      hashedPassword: await hashPassword('AdminPass123!'),
    },
  });

  const aliceUser = await prisma.user.create({
    data: {
      name: 'Alice Wonder',
      email: 'alice@example.com',
      hashedPassword: await hashPassword('AlicePass123!'),
    },
  });

  const bobUser = await prisma.user.create({
    data: {
      name: 'Bob The Builder',
      email: 'bob@example.com',
      hashedPassword: await hashPassword('BobPass123!'),
    },
  });
  console.log(`Created users: ${adminUser.name}, ${aliceUser.name}, ${bobUser.name}`);

  // --- Create Admin's Board (from JSON file) ---
  console.log(`Creating board for ${adminUser.name} from board.json...`);
  const adminBoard = await prisma.board.create({
    data: {
      title: boardFromFile.title || 'Admin Board (from JSON)',
      theme: boardFromFile.theme || 'dark',
      isPublic: false,
      userId: adminUser.id,
      columns: {
        create: boardFromFile.columns.map((col: any, index: number) => ({
          id: col.id, // Keep original ID from JSON for this board
          title: col.title,
          width: col.width,
          order: index,
          cards: {
            create: col.cards.map((card: any) => ({
              id: card.id, // Keep original ID from JSON for this board
              title: card.title,
              description: card.description || '',
              dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
              priority: card.priority as Priority,
              order: card.order,
            })),
          },
        })),
      },
    },
  });
  console.log(`Created board: ${adminBoard.title}`);

  // --- Create Alice's Board ---
  console.log(`Creating board for ${aliceUser.name}...`);
  const aliceBoard = await prisma.board.create({
    data: {
      title: "Alice's Project Board",
      theme: 'light',
      userId: aliceUser.id,
      columns: {
        create: [
          {
            title: 'To Do',
            width: 50,
            order: 0,
            cards: {
              create: [
                { title: 'Setup project repository', description: 'Initialize git and push to remote', order: 0, priority: 'high' },
                { title: 'Define database schema', description: 'Create initial Prisma schema', order: 1, priority: 'medium' },
              ],
            },
          },
          {
            title: 'Done',
            width: 50,
            order: 1,
            cards: {
              create: [
                { title: 'Brainstorm feature ideas', description: 'Initial planning session complete', order: 0, priority: 'low' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`Created board: ${aliceBoard.title}`);

  // --- Create Bob's Board ---
  console.log(`Creating board for ${bobUser.name}...`);
  const bobBoard = await prisma.board.create({
    data: {
      title: "Bob's Task List",
      theme: 'dark',
      userId: bobUser.id,
      columns: {
        create: [
          {
            title: 'Pending',
            width: 60,
            order: 0,
            cards: {
              create: [
                { title: 'Fix login bug', description: 'Users reporting issues with social login', order: 0, priority: 'high' },
                { title: 'Update documentation', description: 'Add section for new API endpoints', order: 1, priority: 'medium' },
              ],
            },
          },
          {
            title: 'Completed',
            width: 40,
            order: 1,
            cards: {
              create: [
                { title: 'Deploy to staging', description: 'Version 1.2 deployed successfully', order: 0, priority: 'high' },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`Created board: ${bobBoard.title}`);

  // --- Create Board Memberships (Sharing) ---
  console.log('Creating board memberships (sharing boards)...');
  // Admin shares their board with Alice
  await prisma.boardMembership.create({
    data: {
      boardId: adminBoard.id,
      userId: aliceUser.id,
      role: 'member',
    },
  });
  console.log(`${adminUser.name} shared "${adminBoard.title}" with ${aliceUser.name}`);

  // Alice shares her board with Bob
  await prisma.boardMembership.create({
    data: {
      boardId: aliceBoard.id,
      userId: bobUser.id,
      role: 'member',
    },
  });
  console.log(`${aliceUser.name} shared "${aliceBoard.title}" with ${bobUser.name}`);

  // Bob shares his board with Admin
  await prisma.boardMembership.create({
    data: {
      boardId: bobBoard.id,
      userId: adminUser.id,
      role: 'member',
    },
  });
  console.log(`${bobUser.name} shared "${bobBoard.title}" with ${adminUser.name}`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 