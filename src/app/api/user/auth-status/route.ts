import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has a password set
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        hashedPassword: true,
        accounts: {
          select: {
            provider: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const hasPassword = Boolean(user.hashedPassword);
    const oauthProviders = user.accounts.map(account => account.provider);
    const hasOAuth = oauthProviders.length > 0;

    return NextResponse.json({
      hasPassword,
      hasOAuth,
      oauthProviders,
      authMethods: {
        credentials: hasPassword,
        oauth: hasOAuth
      }
    });

  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 