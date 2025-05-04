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

// Removed __dirname polyfill as it might not be needed with tsx and direct seeding logic

async function main() {
  console.log(`Start seeding ...`);

  // --- Clear existing data --- 
  console.log('Clearing existing data...');
  // Order matters due to foreign key constraints
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.label.deleteMany();
  await prisma.card.deleteMany();
  await prisma.column.deleteMany();
  await prisma.boardMember.deleteMany();
  await prisma.boardGroup.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();
  await prisma.milestone.deleteMany();
  console.log('Existing data cleared.');

  // --- Create Users --- 
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
  const insecurePassword = 'password123'; // Simple password for seeding
  const hashedPassword = await bcrypt.hash(insecurePassword, saltRounds);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const maintainerEmail = process.env.MAINTAINER_EMAIL || 'maintainer@example.com';

  if (adminEmail === 'admin@example.com') {
      console.warn('ADMIN_EMAIL environment variable is not set. Using default: admin@example.com');
  }
  if (maintainerEmail === 'maintainer@example.com') {
      console.warn('MAINTAINER_EMAIL environment variable is not set. Using default: maintainer@example.com');
  }

  const adminUser = await prisma.user.create({
    data: {
      id: 'user-admin',
      name: 'Admin User',
      email: adminEmail,
      hashedPassword: hashedPassword,
    },
  });
  console.log(`Created admin user: ${adminUser.name} (${adminUser.email})`);

  const maintainerUser = await prisma.user.create({
    data: {
      id: 'user-maintainer',
      name: 'Maintainer User',
      email: maintainerEmail,
      hashedPassword: hashedPassword, // Same insecure password for simplicity
    },
  });
  console.log(`Created maintainer user: ${maintainerUser.name} (${maintainerUser.email})`);

  // --- Create Shared Board --- 
  const sharedBoard = await prisma.board.create({
    data: {
      id: 'board-shared',
      title: 'Shared Project Board',
      theme: 'dark',
      isPublic: false, // Keep it private initially
      pinned: true,
      userId: adminUser.id, // Admin is the owner
    },
  });
  console.log(`Created shared board: ${sharedBoard.title}`);

  // --- Add Members to Board --- 
  await prisma.boardMember.createMany({
    data: [
      { userId: adminUser.id, boardId: sharedBoard.id },
      { userId: maintainerUser.id, boardId: sharedBoard.id },
    ],
  });
  console.log('Added admin and maintainer as members to the shared board.');

  // --- Create Columns --- 
  const columnsData = [
    { id: 'col-1', title: 'Backlog', width: 25, order: 0 },
    { id: 'col-2', title: 'To Do', width: 25, order: 1 },
    { id: 'col-3', title: 'In Progress', width: 25, order: 2 },
    { id: 'col-4', title: 'Done', width: 25, order: 3 },
  ];

  const createdColumns = await Promise.all(
    columnsData.map(col => 
      prisma.column.create({
        data: {
          ...col,
          board: { connect: { id: sharedBoard.id } }
        },
      })
    )
  );
  console.log(`Created ${createdColumns.length} columns.`);
  const backlogCol = createdColumns.find(c => c.id === 'col-1');
  const todoCol = createdColumns.find(c => c.id === 'col-2');
  const progressCol = createdColumns.find(c => c.id === 'col-3');
  const doneCol = createdColumns.find(c => c.id === 'col-4');

  if (!backlogCol || !todoCol || !progressCol || !doneCol) {
      throw new Error('Failed to find created columns');
  }

  // --- Create Labels --- 
  const labelsData = [
    { id: 'lbl-feat', name: 'Feature', color: '#1A7F56' },
    { id: 'lbl-bug', name: 'Bug', color: '#ff0000' },
    { id: 'lbl-ui', name: 'UI/UX', color: '#3b82f6' },
    { id: 'lbl-chore', name: 'Chore', color: '#6b7280' },
  ];
  await prisma.label.createMany({ data: labelsData });
  console.log(`Created ${labelsData.length} labels.`);

  // --- Create Milestones --- 
  const milestonesData = [
    { id: 'mil-1', name: 'Sprint 1', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // Due in 1 week
    { id: 'mil-2', name: 'Sprint 2', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }, // Due in 2 weeks
  ];
  await prisma.milestone.createMany({ data: milestonesData });
  console.log(`Created ${milestonesData.length} milestones.`);

  // --- Create Cards with Relations --- 
  console.log('Creating cards...');
  // Card 1: Backlog, assigned to admin, Feature, Sprint 1
  const card1 = await prisma.card.create({
    data: {
      id: 'card-1',
      title: 'Implement User Authentication',
      description: 'Set up NextAuth with email/password provider.',
      priority: Priority.high,
      order: 0,
      columnId: backlogCol.id,
      milestoneId: milestonesData[0].id,
      assignees: { connect: { id: adminUser.id } },
      labels: { connect: { id: labelsData[0].id } }, // Feature label
      comments: {
        create: [
          { id: 'com-1', author: adminUser.name, content: 'Initial requirement spec.' },
        ],
      },
    },
  });

  // Card 2: Backlog, assigned to maintainer, UI, Sprint 1
  const card2 = await prisma.card.create({
    data: {
      id: 'card-2',
      title: 'Design Dashboard Layout',
      description: 'Create wireframes and mockups for the main dashboard.',
      priority: Priority.medium,
      order: 1,
      columnId: backlogCol.id,
      milestoneId: milestonesData[0].id,
      assignees: { connect: { id: maintainerUser.id } },
      labels: { connect: { id: labelsData[2].id } }, // UI/UX label
    },
  });

  // Card 3: To Do, assigned to admin, Bug, Sprint 1
  const card3 = await prisma.card.create({
    data: {
      id: 'card-3',
      title: 'Fix Button Alignment Issue',
      description: 'The primary action button is misaligned on mobile view.',
      priority: Priority.high,
      order: 0,
      columnId: todoCol.id,
      milestoneId: milestonesData[0].id,
      assignees: { connect: { id: adminUser.id } },
      labels: { connect: [{ id: labelsData[1].id }, { id: labelsData[2].id }] }, // Bug and UI/UX labels
      attachments: {
        create: [
          { id: 'att-1', name: 'mobile-screenshot.png', url: '/seed/mobile.png', type: 'image/png' },
        ],
      },
    },
  });

  // Card 4: In Progress, assigned to both, Chore, Sprint 2
  const card4 = await prisma.card.create({
    data: {
      id: 'card-4',
      title: 'Setup CI/CD Pipeline',
      description: 'Configure GitHub Actions for automated testing and deployment.',
      priority: Priority.medium,
      order: 0,
      columnId: progressCol.id,
      milestoneId: milestonesData[1].id,
      assignees: { connect: [{ id: adminUser.id }, { id: maintainerUser.id }] },
      labels: { connect: { id: labelsData[3].id } }, // Chore label
      comments: {
        create: [
          { id: 'com-2', author: maintainerUser.name, content: 'Started working on the workflow file.' },
          { id: 'com-3', author: adminUser.name, content: 'Let me know if you need help with secrets.' },
        ],
      },
       attachments: {
        create: [
          { id: 'att-2', name: 'workflow-draft.yml', url: '/seed/workflow.yml', type: 'text/yaml' },
        ],
      },
    },
  });

  // Card 5: Done, unassigned
  const card5 = await prisma.card.create({
    data: {
      id: 'card-5',
      title: 'Initial Project Setup',
      description: 'Configured Next.js, Prisma, and Tailwind.',
      priority: Priority.low,
      order: 0,
      columnId: doneCol.id,
      // No assignee, no milestone, no labels
    },
  });
  console.log(`Created 5 sample cards.`);

  // --- Create Groups (Optional Example) --- 
  const developersGroup = await prisma.group.create({
      data: {
          id: 'group-devs',
          name: 'Developers',
      }
  });
  console.log(`Created group: ${developersGroup.name}`);

  // --- Add Users to Group --- 
  await prisma.groupMember.createMany({
      data: [
          { groupId: developersGroup.id, userId: adminUser.id },
          { groupId: developersGroup.id, userId: maintainerUser.id },
      ]
  });
  console.log(`Added users to group ${developersGroup.name}`);

  // --- Share Board with Group --- 
  await prisma.boardGroup.create({
      data: {
          boardId: sharedBoard.id,
          groupId: developersGroup.id,
      }
  });
  console.log(`Shared board ${sharedBoard.title} with group ${developersGroup.name}`);


  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 