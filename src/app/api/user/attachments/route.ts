import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all attachments from cards on boards the user owns or is a member of
    const attachments = await prisma.attachment.findMany({
      where: {
        card: {
          board: {
            OR: [
              { creatorId: session.user.id },
              { members: { some: { userId: session.user.id } } }
            ]
          }
        }
      },
      include: {
        card: {
          select: {
            id: true,
            title: true,
            board: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format the response to include card and board context
    const formattedAttachments = attachments.map(attachment => ({
      id: attachment.id,
      name: attachment.name,
      url: attachment.url,
      type: attachment.type,
      createdAt: attachment.createdAt,
      card: {
        id: attachment.card.id,
        title: attachment.card.title,
        board: {
          id: attachment.card.board.id,
          title: attachment.card.board.title,
        }
      }
    }));

    return NextResponse.json(formattedAttachments);
  } catch (error: unknown) {
    console.error('[API GET /api/user/attachments] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch user attachments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 