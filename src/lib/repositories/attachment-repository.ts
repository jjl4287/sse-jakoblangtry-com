import prisma from '~/lib/prisma';
import type { Attachment } from '~/types';
import type { BaseRepository } from './base-repository';
import type { Prisma } from '@prisma/client';

export interface AttachmentRepository extends BaseRepository<Attachment> {
  findByCardId(cardId: string): Promise<Attachment[]>;
  createForCard(cardId: string, data: {
    name: string;
    url: string;
    type: string;
  }): Promise<Attachment>;
  deleteByCardId(cardId: string): Promise<void>;
}

class PrismaAttachmentRepository implements AttachmentRepository {
  private mapToAttachment(prismaAttachment: Prisma.AttachmentGetPayload<{}>): Attachment {
    return {
      id: prismaAttachment.id,
      name: prismaAttachment.name,
      url: prismaAttachment.url,
      type: prismaAttachment.type,
      createdAt: prismaAttachment.createdAt,
    };
  }

  async findById(id: string): Promise<Attachment | null> {
    const attachment = await prisma.attachment.findUnique({
      where: { id }
    });

    return attachment ? this.mapToAttachment(attachment) : null;
  }

  async findMany(): Promise<Attachment[]> {
    const attachments = await prisma.attachment.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return attachments.map(this.mapToAttachment);
  }

  async findByCardId(cardId: string): Promise<Attachment[]> {
    const attachments = await prisma.attachment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' }
    });

    return attachments.map(this.mapToAttachment);
  }

  async create(data: {
    name: string;
    url: string;
    type: string;
    cardId: string;
  }): Promise<Attachment> {
    const attachment = await prisma.attachment.create({
      data
    });

    return this.mapToAttachment(attachment);
  }

  async createForCard(cardId: string, data: {
    name: string;
    url: string;
    type: string;
  }): Promise<Attachment> {
    return this.create({ ...data, cardId });
  }

  async update(id: string, data: Partial<{
    name: string;
    url: string;
    type: string;
  }>): Promise<Attachment> {
    const attachment = await prisma.attachment.update({
      where: { id },
      data
    });

    return this.mapToAttachment(attachment);
  }

  async delete(id: string): Promise<void> {
    await prisma.attachment.delete({ where: { id } });
  }

  async deleteByCardId(cardId: string): Promise<void> {
    await prisma.attachment.deleteMany({ where: { cardId } });
  }
}

export const attachmentRepository: AttachmentRepository = new PrismaAttachmentRepository(); 