import { NextResponse } from 'next/server';
import { activityService } from '~/lib/services/activity-service';
import { accessService } from '~/lib/services/access-service';
import { jsonError } from '~/lib/api/response';
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth/authOptions";

// GET /api/cards/[cardId]/activity
export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Access check
    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    // Fetch activity via service
    const activityLogs = await activityService.getActivityByCardId(cardId);

    return NextResponse.json(activityLogs);

  } catch (error: unknown) {
    return jsonError(error, 'Failed to fetch activity logs');
  }
} 