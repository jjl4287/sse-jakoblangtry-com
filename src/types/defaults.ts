import type { Board } from './index';
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
    },
    {
      id: uuidv4(),
      title: 'In Progress',
      width: 25,
      cards: [],
    },
    {
      id: uuidv4(),
      title: 'Code Review',
      width: 25,
      cards: [],
    },
    {
      id: uuidv4(),
      title: 'Done',
      width: 25,
      cards: [],
    },
  ];

  return {
    columns: defaultColumns,
    theme: 'dark', // Default to dark theme as per PRD
  };
};

/**
 * Default board with sample data for development purposes
 */
export const sampleBoard: Board = {
  columns: [
    {
      id: '1',
      title: 'Product Backlog',
      width: 25,
      cards: [
        {
          id: '101',
          title: 'Implement dark mode toggle',
          description: 'Create a toggle switch for changing between light and dark themes',
          labels: [
            { id: '201', name: 'Feature', color: '#1A7F56' }
          ],
          assignees: ['John Doe'],
          priority: 'medium',
          attachments: [],
          comments: [],
          columnId: '1',
          order: 0,
        },
        {
          id: '102',
          title: 'Add drag animation',
          description: 'Improve the card drag and drop with smooth animations',
          labels: [
            { id: '202', name: 'Enhancement', color: '#15593B' }
          ],
          assignees: ['Jane Smith'],
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
      cards: [
        {
          id: '103',
          title: 'Fix responsive layout',
          description: 'Ensure the board works well on mobile devices',
          labels: [
            { id: '203', name: 'Bug', color: '#ff0000' }
          ],
          assignees: ['John Doe'],
          priority: 'high',
          attachments: [],
          comments: [
            {
              id: '301',
              author: 'John Doe',
              content: 'This is mostly affecting small tablets',
              createdAt: new Date('2024-01-15'),
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
      cards: [],
    },
    {
      id: '4',
      title: 'Done',
      width: 25,
      cards: [
        {
          id: '104',
          title: 'Initial project setup',
          description: 'Set up Next.js, TypeScript, and TailwindCSS',
          labels: [
            { id: '204', name: 'Setup', color: '#0A3622' }
          ],
          dueDate: new Date('2024-01-10'),
          assignees: ['Jane Smith'],
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