import type { Board, User, Milestone } from './index';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a default board structure with empty columns
 */
export const createDefaultBoard = (): Board => {
  const defaultColumns = [
    {
      id: uuidv4(),
      title: 'Product Backlog',
      width: 25,
      cards: [],
      order: 0,
    },
    {
      id: uuidv4(),
      title: 'In Progress',
      width: 25,
      cards: [],
      order: 1,
    },
    {
      id: uuidv4(),
      title: 'Code Review',
      width: 25,
      cards: [],
      order: 2,
    },
    {
      id: uuidv4(),
      title: 'Done',
      width: 25,
      cards: [],
      order: 3,
    },
  ];

  return {
    id: uuidv4(),
    title: 'New Board',
    user: { id: 'placeholder-user-id', name: 'Placeholder User' } as User,
    userId: 'placeholder-user-id',
    pinned: false,
    isPublic: false,
    columns: defaultColumns.map((col, index) => ({ ...col, order: index })),
    theme: 'dark',
  };
};

/**
 * Default board with sample data for development purposes
 */

// Define some sample users (replace with actual user data structure/source if needed)
const sampleUser1: Partial<User> = { id: 'user1', name: 'John Doe' };
const sampleUser2: Partial<User> = { id: 'user2', name: 'Jane Smith' };

// Define a sample milestone
const sampleMilestone1: Milestone = { id: 'm1', name: 'Sprint 1 End' };

export const sampleBoard: Board = {
  id: 'board1',
  title: 'Sample Project Board',
  userId: 'user1',
  pinned: false,
  isPublic: false,
  user: sampleUser1 as User,
  columns: [
    {
      id: '1',
      title: 'Product Backlog',
      width: 25,
      order: 0,
      cards: [
        {
          id: '101',
          title: 'Implement dark mode toggle',
          description: 'Create a toggle switch for changing between light and dark themes',
          labels: [
            { id: '201', name: 'Feature', color: '#1A7F56' }
          ],
          assignees: [sampleUser1.id!],
          priority: 'medium',
          attachments: [],
          comments: [],
          columnId: '1',
          order: 0,
          milestoneId: sampleMilestone1.id,
          milestone: sampleMilestone1,
        },
        {
          id: '102',
          title: 'Add drag animation',
          description: 'Improve the card drag and drop with smooth animations',
          labels: [
            { id: '202', name: 'Enhancement', color: '#15593B' }
          ],
          assignees: [sampleUser2.id!],
          priority: 'low',
          attachments: [],
          comments: [],
          columnId: '1',
          order: 1,
        }
      ],
    },
    {
      id: '2',
      title: 'In Progress',
      width: 25,
      order: 1,
      cards: [
        {
          id: '103',
          title: 'Fix responsive layout',
          description: 'Ensure the board works well on mobile devices',
          labels: [
            { id: '203', name: 'Bug', color: '#ff0000' }
          ],
          assignees: [sampleUser1.id!, sampleUser2.id!],
          priority: 'high',
          attachments: [
            {
              id: 'att1', name: 'screenshot.png', url:'/attachments/screenshot.png', type:'image/png', createdAt: new Date()
            }
          ],
          comments: [
            {
              id: '301',
              author: sampleUser1.name!,
              content: 'This is mostly affecting small tablets',
              createdAt: new Date('2024-01-15'),
            },
            {
              id: '302',
              author: sampleUser2.name!,
              content: 'Can confirm, checked on iPad Mini.',
              createdAt: new Date('2024-01-16'),
            }
          ],
          columnId: '2',
          order: 0,
        }
      ],
    },
    {
      id: '3',
      title: 'Code Review',
      width: 25,
      order: 2,
      cards: [],
    },
    {
      id: '4',
      title: 'Done',
      width: 25,
      order: 3,
      cards: [
        {
          id: '104',
          title: 'Initial project setup',
          description: 'Set up Next.js, TypeScript, and TailwindCSS',
          labels: [
            { id: '204', name: 'Setup', color: '#0A3622' }
          ],
          dueDate: new Date('2024-01-10'),
          assignees: [sampleUser2.id!],
          priority: 'high',
          attachments: [
            {
              id: '401',
              name: 'setup-notes.txt',
              url: '/attachments/setup-notes.txt',
              type: 'text/plain',
              createdAt: new Date('2024-01-05'),
            }
          ],
          comments: [],
          columnId: '4',
          order: 0,
        }
      ],
    }
  ],
  theme: 'dark',
}; 