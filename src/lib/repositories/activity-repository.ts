import prisma from '~/lib/prisma';
import type { ActivityLog } from '~/types';
import type { BaseRepository } from './base-repository';
import type { Prisma } from '@prisma/client';

type ActivityLogWithRelations = Prisma.ActivityLogGetPayload<{
  include: {
    user: true;
  }
}>;

export interface ActivityRepository extends BaseRepository<ActivityLog> {
  findByCardId(cardId: string): Promise<ActivityLog[]>;
  createActivityLog(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): Promise<ActivityLog>;
  deleteByCardId(cardId: string): Promise<void>;
}

class PrismaActivityRepository implements ActivityRepository {
  private mapToActivityLog(prismaActivity: ActivityLogWithRelations): ActivityLog {
    return {
      id: prismaActivity.id,
      actionType: prismaActivity.actionType,
      details: prismaActivity.details,
      createdAt: prismaActivity.createdAt,
      cardId: prismaActivity.cardId,
      userId: prismaActivity.userId,
      user: prismaActivity.user ? {
        id: prismaActivity.user.id,
        name: prismaActivity.user.name,
        email: prismaActivity.user.email,
        image: prismaActivity.user.image,
      } : null
    };
  }

  async findById(id: string): Promise<ActivityLog | null> {
    const activity = await prisma.activityLog.findUnique({
      where: { id },
      include: { user: true }
    });

    return activity ? this.mapToActivityLog(activity) : null;
  }

  async findMany(): Promise<ActivityLog[]> {
    const activities = await prisma.activityLog.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    return activities.map(this.mapToActivityLog);
  }

  async findByCardId(cardId: string): Promise<ActivityLog[]> {
    const activities = await prisma.activityLog.findMany({
      where: { cardId },
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    });

    return activities.map(this.mapToActivityLog);
  }

  async create(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): Promise<ActivityLog> {
    const activity = await prisma.activityLog.create({
      data,
      include: { user: true }
    });

    return this.mapToActivityLog(activity);
  }

  async createActivityLog(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): Promise<ActivityLog> {
    return this.create(data);
  }

  async update(id: string, data: Partial<{
    actionType: string;
    details: any;
  }>): Promise<ActivityLog> {
    const activity = await prisma.activityLog.update({
      where: { id },
      data,
      include: { user: true }
    });

    return this.mapToActivityLog(activity);
  }

  async delete(id: string): Promise<void> {
    await prisma.activityLog.delete({ where: { id } });
  }

  async deleteByCardId(cardId: string): Promise<void> {
    await prisma.activityLog.deleteMany({ where: { cardId } });
  }
}

export const activityRepository: ActivityRepository = new PrismaActivityRepository(); 