import type { Card as PrismaCard, Label, User, Attachment, Comment } from '@prisma/client';
import type { Card } from '~/types';

type CardWithRelations = PrismaCard & {
  labels: Label[];
  assignees: User[];
  attachments: Attachment[];
  comments: (Comment & {
    user: User;
  })[];
};

export function formatCardForAPI(card: CardWithRelations): Card {
  return {
    id: card.id,
    columnId: card.columnId,
    order: card.order,
    title: card.title,
    description: card.description,
    labels: card.labels.map(l => ({ 
      id: l.id, 
      name: l.name, 
      color: l.color, 
      boardId: l.boardId 
    })),
    assignees: card.assignees.map(u => ({ 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      image: u.image 
    })),
    priority: card.priority as 'low' | 'medium' | 'high',
    weight: card.weight ?? undefined,
    attachments: card.attachments.map(a => ({ 
      id: a.id, 
      name: a.name, 
      url: a.url, 
      type: a.type, 
      createdAt: a.createdAt 
    })),
    comments: card.comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      cardId: c.cardId,
      userId: c.userId,
      user: {
        id: c.user.id,
        name: c.user.name,
        email: c.user.email,
        image: c.user.image,
      }
    })),
    dueDate: card.dueDate ?? undefined,
    boardId: card.boardId,
  };
} 