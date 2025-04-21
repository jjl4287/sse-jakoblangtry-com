import { PrismaClient, Priority } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

// Polyfill __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Clear existing columns (which will cascade delete cards) and projects to avoid duplicate-ID errors
  console.log('Clearing existing seeded data...');
  await prisma.column.deleteMany();
  await prisma.project.deleteMany();
  
  const boardPath = path.join(__dirname, '..', 'data', 'board.json');
  const raw = fs.readFileSync(boardPath, 'utf-8');
  const board = JSON.parse(raw);

  console.log('Seeding database from board.json');

  // Create a default project
  const project = await prisma.project.create({
    data: {
      title: 'Default Project',
      theme: board.theme || 'dark',
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
        projectId: project.id,
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