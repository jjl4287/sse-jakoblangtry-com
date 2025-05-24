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
  console.log('🌱 Seeding database...');

  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      email: 'john@example.com',
      name: 'John Doe',
      image: 'https://avatar.iran.liara.run/public/1'
    }
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      email: 'jane@example.com',
      name: 'Jane Smith',
      image: 'https://avatar.iran.liara.run/public/2'
    }
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      image: 'https://avatar.iran.liara.run/public/3'
    }
  });

  console.log('✅ Created users');

  // Create Board 1: Product Development
  const board1 = await prisma.board.create({
    data: {
      title: 'Product Development',
      theme: 'dark',
      creator: { connect: { id: user1.id } },
      members: {
        create: [
          { userId: user1.id, role: 'owner' },
          { userId: user2.id, role: 'member' }
        ]
      },
      labels: {
        create: [
          { name: 'Bug', color: '#ef4444' },
          { name: 'Feature', color: '#3b82f6' },
          { name: 'Enhancement', color: '#8b5cf6' },
          { name: 'Documentation', color: '#10b981' },
          { name: 'Critical', color: '#dc2626' },
          { name: 'Nice to Have', color: '#f59e0b' }
        ]
      }
    }
  });

  // Create columns for Board 1
  const board1Columns = await Promise.all([
    prisma.column.create({
      data: { title: 'Backlog', order: 0, width: 320, boardId: board1.id }
    }),
    prisma.column.create({
      data: { title: 'In Progress', order: 1, width: 320, boardId: board1.id }
    }),
    prisma.column.create({
      data: { title: 'Review', order: 2, width: 320, boardId: board1.id }
    }),
    prisma.column.create({
      data: { title: 'Done', order: 3, width: 320, boardId: board1.id }
    })
  ]);

  // Create cards for Board 1
  await Promise.all([
    // Backlog cards
    prisma.card.create({
      data: {
        title: 'Implement user authentication',
        description: 'Add login/logout functionality with session management',
        priority: 'high',
        weight: 8,
        order: 0,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        columnId: board1Columns[0].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user1.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Design new landing page',
        description: 'Create mockups and wireframes for the new landing page',
        priority: 'medium',
        weight: 5,
        order: 1,
        columnId: board1Columns[0].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user2.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Fix responsive design issues',
        description: 'Address mobile layout problems on various screen sizes',
        priority: 'high',
        weight: 3,
        order: 2,
        columnId: board1Columns[0].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user1.id }, { id: user2.id }] }
      }
    }),
    // In Progress cards
    prisma.card.create({
      data: {
        title: 'API endpoint optimization',
        description: 'Improve performance of user data retrieval endpoints',
        priority: 'medium',
        weight: 6,
        order: 0,
        columnId: board1Columns[1].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user1.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Database migration script',
        description: 'Create migration to add new user preferences table',
        priority: 'low',
        weight: 2,
        order: 1,
        columnId: board1Columns[1].id,
        boardId: board1.id
      }
    }),
    // Review cards
    prisma.card.create({
      data: {
        title: 'Security audit documentation',
        description: 'Comprehensive security review of authentication system',
        priority: 'high',
        weight: 4,
        order: 0,
        columnId: board1Columns[2].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user3.id }] }
      }
    }),
    // Done cards
    prisma.card.create({
      data: {
        title: 'Setup CI/CD pipeline',
        description: 'Automated testing and deployment configured',
        priority: 'medium',
        weight: 7,
        order: 0,
        columnId: board1Columns[3].id,
        boardId: board1.id,
        assignees: { connect: [{ id: user1.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Update project dependencies',
        description: 'Upgraded all packages to latest stable versions',
        priority: 'low',
        weight: 1,
        order: 1,
        columnId: board1Columns[3].id,
        boardId: board1.id
      }
    })
  ]);

  // Create Board 2: Marketing Campaign
  const board2 = await prisma.board.create({
    data: {
      title: 'Marketing Campaign',
      theme: 'light',
      creator: { connect: { id: user2.id } },
      members: {
        create: [
          { userId: user2.id, role: 'owner' },
          { userId: user3.id, role: 'member' }
        ]
      },
      labels: {
        create: [
          { name: 'Social Media', color: '#ec4899' },
          { name: 'Content', color: '#06b6d4' },
          { name: 'Analytics', color: '#84cc16' },
          { name: 'Urgent', color: '#f97316' }
        ]
      }
    }
  });

  // Create columns for Board 2
  const board2Columns = await Promise.all([
    prisma.column.create({
      data: { title: 'Ideas', order: 0, width: 300, boardId: board2.id }
    }),
    prisma.column.create({
      data: { title: 'In Progress', order: 1, width: 300, boardId: board2.id }
    }),
    prisma.column.create({
      data: { title: 'Completed', order: 2, width: 300, boardId: board2.id }
    })
  ]);

  // Create cards for Board 2
  await Promise.all([
    prisma.card.create({
      data: {
        title: 'Launch Instagram campaign',
        description: 'Plan and execute social media campaign for product launch',
        priority: 'high',
        weight: 10,
        order: 0,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        columnId: board2Columns[0].id,
        boardId: board2.id,
        assignees: { connect: [{ id: user2.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Create blog content series',
        description: 'Write 5 blog posts about product features',
        priority: 'medium',
        weight: 8,
        order: 1,
        columnId: board2Columns[0].id,
        boardId: board2.id,
        assignees: { connect: [{ id: user3.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Design promotional graphics',
        description: 'Create visual assets for social media posts',
        priority: 'medium',
        weight: 5,
        order: 0,
        columnId: board2Columns[1].id,
        boardId: board2.id,
        assignees: { connect: [{ id: user2.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Market research analysis',
        description: 'Completed competitive analysis and target audience research',
        priority: 'high',
        weight: 6,
        order: 0,
        columnId: board2Columns[2].id,
        boardId: board2.id,
        assignees: { connect: [{ id: user3.id }] }
      }
    })
  ]);

  // Create Board 3: Personal Projects  
  const board3 = await prisma.board.create({
    data: {
      title: 'Personal Projects',
      theme: 'dark',
      creator: { connect: { id: user1.id } },
      members: {
        create: [
          { userId: user1.id, role: 'owner' }
        ]
      },
      labels: {
        create: [
          { name: 'Learning', color: '#6366f1' },
          { name: 'Side Project', color: '#8b5cf6' },
          { name: 'Quick Win', color: '#10b981' }
        ]
      }
    }
  });

  // Create columns for Board 3
  const board3Columns = await Promise.all([
    prisma.column.create({
      data: { title: 'Todo', order: 0, width: 280, boardId: board3.id }
    }),
    prisma.column.create({
      data: { title: 'Done', order: 1, width: 280, boardId: board3.id }
    })
  ]);

  // Create cards for Board 3
  await Promise.all([
    prisma.card.create({
      data: {
        title: 'Learn Next.js 14',
        description: 'Complete the official Next.js tutorial and build a demo app',
        priority: 'medium',
        weight: 5,
        order: 0,
        columnId: board3Columns[0].id,
        boardId: board3.id,
        assignees: { connect: [{ id: user1.id }] }
      }
    }),
    prisma.card.create({
      data: {
        title: 'Build portfolio website',
        description: 'Create a personal portfolio showcasing projects',
        priority: 'low',
        weight: 8,
        order: 1,
        columnId: board3Columns[0].id,
        boardId: board3.id
      }
    }),
    prisma.card.create({
      data: {
        title: 'Setup development environment',
        description: 'Configured VS Code, installed extensions, and set up Git',
        priority: 'high',
        weight: 2,
        order: 0,
        columnId: board3Columns[1].id,
        boardId: board3.id
      }
    })
  ]);

  console.log('✅ Created boards with columns and cards');

  // Add some comments to the first card
  const firstCard = await prisma.card.findFirst({
    where: { boardId: board1.id },
    orderBy: { order: 'asc' }
  });

  if (firstCard) {
    await prisma.comment.createMany({
      data: [
        {
          content: 'This is a high priority task. Let\'s make sure we get the authentication flow right.',
          cardId: firstCard.id,
          userId: user1.id
        },
        {
          content: 'I can help with the testing once the implementation is ready.',
          cardId: firstCard.id,
          userId: user2.id
        },
        {
          content: 'Great progress so far! Don\'t forget to include two-factor authentication.',
          cardId: firstCard.id,
          userId: user3.id
        }
      ]
    });

    console.log('✅ Added comments to cards');
  }

  // Add some activity logs
  if (firstCard) {
    await prisma.activityLog.createMany({
      data: [
        {
          actionType: 'CREATE_CARD',
          details: { title: 'Implement user authentication' },
          cardId: firstCard.id,
          userId: user1.id
        },
        {
          actionType: 'UPDATE_CARD_PRIORITY',
          details: { oldPriority: 'medium', newPriority: 'high' },
          cardId: firstCard.id,
          userId: user1.id
        },
        {
          actionType: 'ADD_ASSIGNEES_TO_CARD',
          details: { assigneeIds: [user1.id] },
          cardId: firstCard.id,
          userId: user2.id
        }
      ]
    });

    console.log('✅ Added activity logs');
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nCreated:');
  console.log('- 3 boards with different themes');
  console.log('- Multiple columns per board');
  console.log('- Sample cards with various priorities and assignments');
  console.log('- Comments and activity logs');
  console.log('- Users with different roles');
  console.log('\nYou can now test the application with realistic data!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 