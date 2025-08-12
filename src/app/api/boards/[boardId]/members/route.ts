import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { jsonError } from '~/lib/api/response';
import { memberService } from '~/lib/services/member-service';

export async function GET(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId } = await params;
  if (!boardId) {
    return new NextResponse('Board ID is required', { status: 400 });
  }

  try {
    const members = await memberService.listMembers(boardId, session.user.id);
    return NextResponse.json(members);
  } catch (error) {
    return jsonError(error);
  }
} 