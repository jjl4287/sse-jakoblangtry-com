import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from '~/lib/prisma';
import type { NextAuthOptions } from "next-auth";

// Use Prisma to persist users
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Username",
      credentials: {
        username: { label: "Username", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.username) return null;
        // Only allow login for existing users
        const dbUser = await prisma.user.findFirst({ where: { name: credentials.username } });
        if (!dbUser) {
          return null; // user must register first
        }
        return { id: dbUser.id, name: dbUser.name };
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.name = token.name!;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 