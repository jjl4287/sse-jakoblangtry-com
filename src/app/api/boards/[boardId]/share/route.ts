import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma'; // Assuming this is your Prisma client path
import { sendEmail } from '~/lib/email'; // Path to our email sending utility

interface ShareRequestBody {
  emailToShareWith?: string;
}

export async function POST(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId } = params;
  let body: ShareRequestBody;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { emailToShareWith } = body;

  if (!emailToShareWith) {
    return NextResponse.json({ error: 'Email to share with is required' }, { status: 400 });
  }

  if (!boardId) {
    return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch the board (owner check skipped until permissions are implemented)
    const board = await prisma.board.findUnique({
      where: { id: boardId },
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // 2. Find the user to share with by email
    const userToShareWith = await prisma.user.findUnique({
      where: { email: emailToShareWith },
    });

    if (!userToShareWith) {
      return NextResponse.json({ error: `User with email '${emailToShareWith}' not found` }, { status: 404 });
    }
    
    // Prevent sharing with oneself if desired (optional check)
    if (userToShareWith.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot share a board with yourself' }, { status: 400 });
    }

    // 3. Check if already a member
    const existingMembership = await prisma.boardMembership.findUnique({
      where: {
        boardId_userId: {
          boardId: boardId,
          userId: userToShareWith.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json({ error: 'Board already shared with this user' }, { status: 409 });
    }

    // 4. Create BoardMembership record
    await prisma.boardMembership.create({
      data: {
        boardId: boardId,
        userId: userToShareWith.id,
        // role: 'member', // Default is 'member' as per schema
      },
    });

    // 5. Send email notification
    const emailSubject = `You've been invited to the board: ${board.title}`;
    const emailHtml = `
      <p>Hello ${userToShareWith.name || userToShareWith.email},</p>
      <p>
        User <strong>${session.user.name || session.user.email}</strong> 
        has shared the board "<strong>${board.title}</strong>" with you.
      </p>
      <p>
        You can access it here: 
        <a href="${process.env.NEXTAUTH_URL}/?boardId=${board.id}">View Board</a>
      </p>
      <p>Thanks!</p>
    `;

    try {
      await sendEmail({
        to: userToShareWith.email!,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Failed to send share notification email:', emailError);
      // Non-critical error: proceed with success response even if email fails for now
      // In a production app, you might want to queue this or have a retry mechanism.
    }

    return NextResponse.json({ message: 'Board shared successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error sharing board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 