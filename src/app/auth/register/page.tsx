'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim() || !password) {
      setError('All fields (username, email, password) are required');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || 'Registration failed');
      } else {
        router.push('/auth/signin');
      }
    } catch {
      setError('Registration failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-gray-900">
      <h1 className="text-2xl mb-4 text-gray-800 dark:text-gray-200">Register</h1>
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 w-full max-w-xs">
        <label className="flex flex-col text-gray-700 dark:text-gray-300">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
          />
        </label>
        <label className="flex flex-col text-gray-700 dark:text-gray-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
          />
        </label>
        <label className="flex flex-col text-gray-700 dark:text-gray-300">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter a strong password"
            className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors duration-200 font-medium"
        >
          Register
        </button>
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
} 