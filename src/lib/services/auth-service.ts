import prisma from '~/lib/prisma';
import bcrypt from 'bcrypt';

export interface AuthService {
  register(username: string, email: string, password: string): Promise<{ id: string; name: string; email: string }>;
  findUserByEmail(email: string): Promise<{ id: string; name: string | null; email: string | null; hashedPassword: string | null } | null>;
  setResetToken(userId: string, otp: string, expiresAt: Date): Promise<void>;
  verifyResetToken(email: string, otp: string): Promise<{ id: string; name: string | null; email: string | null; hashedPassword: string | null } | null>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  getAuthStatus(userId: string): Promise<{ hasPassword: boolean; oauthProviders: string[] }>;
  updateProfile(userId: string, data: { name?: string | null; image?: string | null }): Promise<{ id: string; name: string | null; email: string | null; image: string | null; createdAt: Date }>;
}

export class AuthServiceImpl implements AuthService {
  async register(username: string, email: string, password: string) {
    const existing = await prisma.user.findFirst({ where: { OR: [{ name: username }, { email }] } });
    if (existing) {
      throw new Error('Username or email already in use');
    }
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10');
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const user = await prisma.user.create({ data: { name: username, email, hashedPassword } });
    return { id: user.id, name: user.name, email: user.email };
  }

  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true, name: true, email: true, hashedPassword: true } });
  }

  async setResetToken(userId: string, otp: string, expiresAt: Date) {
    await prisma.user.update({ where: { id: userId }, data: { resetToken: otp, resetTokenExpiry: expiresAt } });
  }

  async verifyResetToken(email: string, otp: string) {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), resetToken: otp, resetTokenExpiry: { gt: new Date() } },
      select: { id: true, name: true, email: true, hashedPassword: true }
    });
  }

  async updatePassword(userId: string, newPassword: string) {
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    await prisma.user.update({ where: { id: userId }, data: { hashedPassword: hashedNewPassword, resetToken: null, resetTokenExpiry: null } });
  }

  async getAuthStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hashedPassword: true, accounts: { select: { provider: true } } }
    });
    if (!user) {
      throw new Error('User not found');
    }
    return { hasPassword: Boolean(user.hashedPassword), oauthProviders: user.accounts.map(a => a.provider) };
  }

  async updateProfile(userId: string, data: { name?: string | null; image?: string | null }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, image: true, createdAt: true }
    });
    return updated;
  }
}

export const authService: AuthService = new AuthServiceImpl();


