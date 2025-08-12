import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '~/lib/auth/authOptions';
import { authService } from '~/lib/services/auth-service';

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
    const status = await authService.getAuthStatus(session.user.id);
    const hasPassword = status.hasPassword;
    const oauthProviders = status.oauthProviders;
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