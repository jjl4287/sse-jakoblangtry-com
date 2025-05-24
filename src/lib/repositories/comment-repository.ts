import prisma from '~/lib/prisma';
import type { Comment } from '~/types';
import type { BaseRepository } from './base-repository';
import type { Prisma } from '@prisma/client';

type CommentWithRelations = Prisma.CommentGetPayload<{
  include: {
    user: true;
  }
}>;

export interface CommentRepository extends BaseRepository<Comment> {
  findByCardId(cardId: string): Promise<Comment[]>;
  createForCard(cardId: string, userId: string, content: string): Promise<Comment>;
  updateContent(commentId: string, content: string): Promise<Comment>;
  deleteByCardId(cardId: string): Promise<void>;
}

class PrismaCommentRepository implements CommentRepository {
  private mapToComment(prismaComment: CommentWithRelations): Comment {
    return {
      id: prismaComment.id,
      content: prismaComment.content,
      createdAt: prismaComment.createdAt,
      updatedAt: prismaComment.updatedAt,
      cardId: prismaComment.cardId,
      userId: prismaComment.userId,
      user: {
        id: prismaComment.user.id,
        name: prismaComment.user.name,
        email: prismaComment.user.email,
        image: prismaComment.user.image,
      }
    };
  }

  async findById(id: string): Promise<Comment | null> {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { user: true }
    });

    return comment ? this.mapToComment(comment) : null;
  }

  async findMany(): Promise<Comment[]> {
    const comments = await prisma.comment.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    return comments.map(this.mapToComment);
  }

  async findByCardId(cardId: string): Promise<Comment[]> {
    const comments = await prisma.comment.findMany({
      where: { cardId },
      include: { user: true },
      orderBy: { createdAt: 'asc' }
    });

    return comments.map(this.mapToComment);
  }

  async create(data: {
    content: string;
    cardId: string;
    userId: string;
  }): Promise<Comment> {
    const comment = await prisma.comment.create({
      data,
      include: { user: true }
    });

    return this.mapToComment(comment);
  }

  async createForCard(cardId: string, userId: string, content: string): Promise<Comment> {
    return this.create({ cardId, userId, content });
  }

  async update(id: string, data: Partial<{
    content: string;
  }>): Promise<Comment> {
    const comment = await prisma.comment.update({
      where: { id },
      data,
      include: { user: true }
    });

    return this.mapToComment(comment);
  }

  async updateContent(commentId: string, content: string): Promise<Comment> {
    return this.update(commentId, { content });
  }

  async delete(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }

  async deleteByCardId(cardId: string): Promise<void> {
    await prisma.comment.deleteMany({ where: { cardId } });
  }
}

export const commentRepository: CommentRepository = new PrismaCommentRepository(); 