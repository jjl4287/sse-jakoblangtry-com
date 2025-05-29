import { NextRequest, NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { sendEmail } from '~/lib/email';
import * as crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, name: true, email: true, hashedPassword: true }
    });

    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json(
        { message: 'If an account with that email exists, we have sent a password reset code.' },
        { status: 200 }
      );
    }

    // Check if user has a password (not OAuth only)
    if (!user.hashedPassword) {
      return NextResponse.json(
        { error: 'This account uses social login. Please sign in with your social provider.' },
        { status: 400 }
      );
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Set expiry to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Store OTP in database (using resetToken and resetTokenExpiry fields)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: otp,
        resetTokenExpiry: expiresAt
      }
    });

    // Send email with OTP
    const emailSubject = 'Password Reset Code';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
        <p>Hello ${user.name || 'there'},</p>
        <p>You requested a password reset for your account. Use the code below to reset your password:</p>
        
        <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 0; color: #007bff;">${otp}</h1>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          <strong>This code will expire in 15 minutes.</strong>
        </p>
        
        <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          This email was sent from ${process.env.NEXTAUTH_URL || 'your app'}
        </p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email!,
        subject: emailSubject,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send reset email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'If an account with that email exists, we have sent a password reset code.' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 