/* eslint-disable */
// @ts-nocheck
import { PrismaClient, Priority } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// Polyfill __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Clear existing columns, projects, and users to avoid duplicate-ID errors
  console.log('Clearing existing seeded data...');
  await prisma.column.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
  
  const boardPath = path.join(__dirname, '..', 'data', 'board.json');
  const raw = fs.readFileSync(boardPath, 'utf-8');
  const board = JSON.parse(raw);

  console.log('Seeding database from board.json');

  // Create an admin user
  const admin = await prisma.user.create({
    data: {
      id: 'admin', // fixed ID for admin user
      name: 'admin', // login username
    },
  });

  // Create a default board for admin
  const boardEntry = await prisma.board.create({
    data: {
      title: 'Admin Board',
      theme: board.theme || 'dark',
      // Only visible to the admin user
      isPublic: false,
      user: { connect: { id: admin.id } }
    },
  });

  // Seed columns with their index as the order
  for (const [index, col] of board.columns.entries()) {
    const column = await prisma.column.create({
      data: {
        id: col.id,
        title: col.title,
        width: col.width,
        order: index,
        projectId: boardEntry.id,
      },
    });

    // Seed cards for this column
    for (const card of col.cards) {
      await prisma.card.create({
        data: {
          id: card.id,
          title: card.title,
          description: card.description || '',
          dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
          priority: card.priority as Priority,
          order: card.order,
          columnId: column.id,
        },
      });
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 