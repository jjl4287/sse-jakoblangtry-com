import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import prisma from '~/lib/prisma'; // Assuming prisma is correctly located here
import bcrypt from 'bcrypt';
import type { NextAuthOptions } from "next-auth";

// Centralized NextAuth options
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.hashedPassword) return null;
        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!isValid) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image }; // Added image here as well for consistency
      }
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!
    })
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth" }, // Assuming your signin page is at /auth
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        // Potentially fetch user from DB here to ensure fresh data if needed
        // const dbUser = await prisma.user.findUnique({ where: { id: token.sub! } });
        // if (dbUser) { session.user.name = dbUser.name; session.user.image = dbUser.image; }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) { // This user object is from the provider (on sign in)
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        // token.picture = user.image; // if image is part of user object from provider
      }
      return token;
    }
  }
}; 