import 'next-auth';
import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      /** The user's unique identifier. */
      id: string;
    } & DefaultSession['user'];
  }
} 