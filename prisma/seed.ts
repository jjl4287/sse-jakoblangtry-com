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
      creator: { connect: { id: adminUser.id } },
      columns: {
        create: boardFromFile.columns.map((col: any, index: number) => ({ // Create columns without cards initially
          id: col.id, 
          title: col.title,
          width: col.width,
          order: index,
          // Cards will be created in a separate step
        })),
      },
    },
    include: { columns: true } // Include columns to get their IDs for card creation
  });
  console.log(`Created board: ${adminBoard.title} with columns.`);

  // Now, create cards for each column in Admin's Board
  for (const colData of boardFromFile.columns) {
    const createdColumn = adminBoard.columns.find(c => c.id === colData.id);
    if (createdColumn && colData.cards && colData.cards.length > 0) {
      await prisma.card.createMany({
        data: colData.cards.map((card: any) => ({
          id: card.id, 
          title: card.title,
          description: card.description || '',
          dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
          priority: card.priority as Priority,
          order: card.order,
          columnId: createdColumn.id, // Connect to the created column
          boardId: adminBoard.id,    // Explicitly connect to the board
        })),
      });
    }
  }
  console.log("Created cards for Admin's board.");

  // Create sample labels for Admin's Board
  const adminLabelBug = await prisma.label.create({
    data: { name: 'Bug', color: '#D93F30', boardId: adminBoard.id },
  });
  const adminLabelFeature = await prisma.label.create({
    data: { name: 'Feature Request', color: '#0E8A16', boardId: adminBoard.id },
  });
  const adminLabelDocs = await prisma.label.create({
    data: { name: 'Documentation', color: '#5319E7', boardId: adminBoard.id },
  });
  console.log(`Created labels for Admin's board.`);

  // Update cards in Admin's Board with labels and assignees
  for (const column of boardFromFile.columns) {
    for (const card of column.cards) {
      let labelsToConnect = [];
      if (card.id === 'card-1') labelsToConnect.push({ id: adminLabelBug.id });
      if (card.id === 'card-2') labelsToConnect.push({ id: adminLabelFeature.id }, { id: adminLabelDocs.id });
      if (card.id === 'card-3') labelsToConnect.push({ id: adminLabelDocs.id });

      let assigneesToConnect = [];
      if (card.id === 'card-1') assigneesToConnect.push({ id: adminUser.id });
      if (card.id === 'card-2') assigneesToConnect.push({ id: aliceUser.id });
      if (card.id === 'card-3') assigneesToConnect.push({ id: adminUser.id }, { id: bobUser.id });
      
      if (labelsToConnect.length > 0 || assigneesToConnect.length > 0) {
        await prisma.card.update({
          where: { id: card.id },
          data: {
            labels: labelsToConnect.length > 0 ? { connect: labelsToConnect } : undefined,
            assignees: assigneesToConnect.length > 0 ? { connect: assigneesToConnect } : undefined,
          },
        });
      }
    }
  }
  console.log("Updated Admin's board cards with labels and assignees.");
  console.log('Adding adminUser as owner in BoardMembership...');
  await prisma.boardMembership.create({
    data: { boardId: adminBoard.id, userId: adminUser.id, role: 'owner' },
  });

  // --- Create Alice's Board ---
  console.log(`Creating board for ${aliceUser.name}...`);
  const aliceBoardData = {
    title: "Alice's Project Board",
    theme: 'light',
    creator: { connect: { id: aliceUser.id } },
    columns: {
      create: [
        {
          id: 'alice-col-todo', // Added ID for easier reference
          title: 'To Do',
          width: 50,
          order: 0,
          // Cards will be created in a separate step
        },
        {
          id: 'alice-col-done', // Added ID for easier reference
          title: 'Done',
          width: 50,
          order: 1,
          // Cards will be created in a separate step
        },
      ],
    },
  };
  const aliceBoard = await prisma.board.create({
    data: aliceBoardData,
    include: { columns: true } 
  });
  console.log(`Created board: ${aliceBoard.title} with columns.`);

  // Add Alice as an owner member for her board
  console.log(`Adding ${aliceUser.name} as owner for board: ${aliceBoard.title}`);
  await prisma.boardMembership.create({
    data: {
      boardId: aliceBoard.id,
      userId: aliceUser.id,
      role: 'owner',
    },
  });

  // Create cards for Alice's board
  const aliceCardsToDo = [
    {
      title: 'Setup project repository',
      description: 'Initialize git and push to remote',
      order: 0,
      priority: 'high',
      assignees: { connect: [{ id: aliceUser.id }] },
      columnId: aliceBoard.columns.find(c => c.id === 'alice-col-todo')!.id,
      boardId: aliceBoard.id
    },
    {
      title: 'Define database schema',
      description: 'Create initial Prisma schema',
      order: 1,
      priority: 'medium',
      assignees: { connect: [{ id: aliceUser.id }] },
      columnId: aliceBoard.columns.find(c => c.id === 'alice-col-todo')!.id,
      boardId: aliceBoard.id
    },
  ];
  await prisma.card.createMany({ data: aliceCardsToDo.map(card => ({...card, assignees: undefined})) }); // createMany doesn't support relation objects directly
  // Re-fetch cards to connect assignees as createMany doesn't handle it well with other fields for some connectors/versions
  for (const cardData of aliceCardsToDo) {
      const createdCard = await prisma.card.findFirst({where: {title: cardData.title, boardId: aliceBoard.id}});
      if (createdCard && cardData.assignees) {
          await prisma.card.update({ where: {id: createdCard.id}, data: { assignees: cardData.assignees } });
      }
  }

  const aliceCardsDone = [
    {
      title: 'Brainstorm feature ideas',
      description: 'Initial planning session complete',
      order: 0,
      priority: 'low',
      assignees: { connect: [{ id: aliceUser.id }] },
      columnId: aliceBoard.columns.find(c => c.id === 'alice-col-done')!.id,
      boardId: aliceBoard.id
    },
  ];
  await prisma.card.createMany({ data: aliceCardsDone.map(card => ({...card, assignees: undefined})) });
  for (const cardData of aliceCardsDone) {
      const createdCard = await prisma.card.findFirst({where: {title: cardData.title, boardId: aliceBoard.id}});
      if (createdCard && cardData.assignees) {
          await prisma.card.update({ where: {id: createdCard.id}, data: { assignees: cardData.assignees } });
      }
  }
  console.log("Created cards for Alice's board.");

  // Create sample labels for Alice's Board
  const aliceLabelTask = await prisma.label.create({
    data: { name: 'Task', color: '#FBCA04', boardId: aliceBoard.id },
  });
  const aliceLabelUrgent = await prisma.label.create({
    data: { name: 'Urgent', color: '#FF0000', boardId: aliceBoard.id },
  });
  console.log(`Created labels for Alice's board.`);

  // Update Alice's cards with labels
  const aliceToDoCards = aliceBoard.columns.find(c => c.title === 'To Do')?.cards;
  if (aliceToDoCards) {
    const setupRepoCard = aliceToDoCards.find(card => card.title === 'Setup project repository');
    if (setupRepoCard) {
      await prisma.card.update({
        where: { id: setupRepoCard.id },
        data: { labels: { connect: [{ id: aliceLabelTask.id }, { id: aliceLabelUrgent.id }] } },
      });
    }
    const defineSchemaCard = aliceToDoCards.find(card => card.title === 'Define database schema');
    if (defineSchemaCard) {
      await prisma.card.update({
        where: { id: defineSchemaCard.id },
        data: { labels: { connect: [{ id: aliceLabelTask.id }] } },
      });
    }
  }
  const aliceDoneCards = aliceBoard.columns.find(c => c.title === 'Done')?.cards;
  if (aliceDoneCards) {
    const brainstormCard = aliceDoneCards.find(card => card.title === 'Brainstorm feature ideas');
    if (brainstormCard) {
      await prisma.card.update({
        where: { id: brainstormCard.id },
        data: { labels: { connect: [{ id: aliceLabelTask.id }] } },
      });
    }
  }
  console.log("Updated Alice's board cards with labels.");

  // --- Create Bob's Board ---
  console.log(`Creating board for ${bobUser.name}...`);
  const bobBoardData = {
    title: "Bob's Task List",
    theme: 'dark',
    creator: { connect: { id: bobUser.id } },
    isPublic: true, 
    columns: {
      create: [
        {
          id: 'bob-col-pending', // Added ID
          title: 'Pending',
          width: 60,
          order: 0,
        },
        {
          id: 'bob-col-completed', // Added ID
          title: 'Completed',
          width: 40,
          order: 1,
        },
      ],
    },
  };
  const bobBoard = await prisma.board.create({
    data: bobBoardData,
    include: { columns: true } 
  });
  console.log(`Created board: ${bobBoard.title} with columns.`);

  // Add Bob as an owner member for his board
  console.log(`Adding ${bobUser.name} as owner for board: ${bobBoard.title}`);
  await prisma.boardMembership.create({
    data: {
      boardId: bobBoard.id,
      userId: bobUser.id,
      role: 'owner',
    },
  });

  // Create cards for Bob's board
  const bobCardsPending = [
    {
      title: 'Fix login bug',
      description: 'Users reporting issues with social login',
      order: 0,
      priority: 'high',
      assignees: { connect: [{ id: bobUser.id }, { id: adminUser.id }] },
      columnId: bobBoard.columns.find(c => c.id === 'bob-col-pending')!.id,
      boardId: bobBoard.id
    },
    {
      title: 'Update documentation',
      description: 'Add section for new API endpoints',
      order: 1,
      priority: 'medium',
      assignees: { connect: [{ id: bobUser.id }] },
      columnId: bobBoard.columns.find(c => c.id === 'bob-col-pending')!.id,
      boardId: bobBoard.id
    },
  ];
  await prisma.card.createMany({ data: bobCardsPending.map(card => ({...card, assignees: undefined})) });
  for (const cardData of bobCardsPending) {
      const createdCard = await prisma.card.findFirst({where: {title: cardData.title, boardId: bobBoard.id}});
      if (createdCard && cardData.assignees) {
          await prisma.card.update({ where: {id: createdCard.id}, data: { assignees: cardData.assignees } });
      }
  }

  const bobCardsCompleted = [
    {
      title: 'Deploy to staging',
      description: 'Version 1.2 deployed successfully',
      order: 0,
      priority: 'high',
      assignees: { connect: [{ id: bobUser.id }] },
      columnId: bobBoard.columns.find(c => c.id === 'bob-col-completed')!.id,
      boardId: bobBoard.id
    },
  ];
  await prisma.card.createMany({ data: bobCardsCompleted.map(card => ({...card, assignees: undefined})) });
   for (const cardData of bobCardsCompleted) {
      const createdCard = await prisma.card.findFirst({where: {title: cardData.title, boardId: bobBoard.id}});
      if (createdCard && cardData.assignees) {
          await prisma.card.update({ where: {id: createdCard.id}, data: { assignees: cardData.assignees } });
      }
  }
  console.log("Created cards for Bob's board.");
  
  // Create sample labels for Bob's Board
  const bobLabelImprovement = await prisma.label.create({
    data: { name: 'Improvement', color: '#A2EEEF', boardId: bobBoard.id },
  });
  const bobLabelBugFix = await prisma.label.create({
    data: { name: 'Bug Fix', color: '#D93F30', boardId: bobBoard.id },
  });
  console.log(`Created labels for Bob's board.`);

  // Update Bob's cards with labels
  const bobPendingCards = bobBoard.columns.find(c => c.title === 'Pending')?.cards;
  if (bobPendingCards) {
    const fixLoginCard = bobPendingCards.find(card => card.title === 'Fix login bug');
    if (fixLoginCard) {
      await prisma.card.update({
        where: { id: fixLoginCard.id },
        data: { labels: { connect: [{ id: bobLabelBugFix.id }] } },
      });
    }
    const updateDocsCard = bobPendingCards.find(card => card.title === 'Update documentation');
    if (updateDocsCard) {
      await prisma.card.update({
        where: { id: updateDocsCard.id },
        data: { labels: { connect: [{ id: bobLabelImprovement.id }] } },
      });
    }
  }
  console.log("Updated Bob's board cards with labels.");

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