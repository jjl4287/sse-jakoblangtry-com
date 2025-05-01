'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    const result = await signIn('credentials', {
      redirect: false,
      email: email.trim(),
      password
    });
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-gray-900">
      <h1 className="text-2xl mb-4 text-gray-800 dark:text-gray-200">Sign In</h1>
      <div className="flex flex-col space-y-2 w-full max-w-xs mb-4">
        <button
          type="button"
          onClick={() => signIn('github', { callbackUrl: '/' })}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 font-medium"
        >
          Sign in with GitHub
        </button>
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 font-medium"
        >
          Sign in with Google
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full max-w-xs">
        <label className="flex flex-col text-gray-700 dark:text-gray-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col text-gray-700 dark:text-gray-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
            placeholder="Enter password"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors duration-200 font-medium"
        >
          Sign in
        </button>
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
} 