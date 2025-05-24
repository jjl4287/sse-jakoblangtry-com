 
'use client';

import React, { useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    const result = await signIn('credentials', { redirect: false, email: email.trim(), password });
    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim() || !password) {
      setError('All fields are required');
      return;
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const errorMessage = (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string')
          ? data.error
          : 'Registration failed';
        setError(errorMessage);
      } else {
        const signInResult = await signIn('credentials', { redirect: false, email: email.trim(), password });
        if (signInResult?.error) {
          setError('Registration succeeded but sign-in failed');
        } else {
          router.push('/');
        }
      }
    } catch {
      setError('Registration failed');
    }
  };

  const oauthSignIn = (provider: 'github' | 'google') => {
    if (mode === 'register') {
      void signOut({ redirect: false });
    }
    void signIn(provider, { callbackUrl: '/' });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-background">
      {/* Toggle buttons */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setMode('signin')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
            mode === 'signin'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => setMode('register')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
            mode === 'register'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          Register
        </button>
      </div>

      {mode === 'signin' ? (
        <>
          <h1 className="text-2xl mb-4 text-gray-800 dark:text-gray-200">Sign In</h1>
          <div className="flex flex-col space-y-2 w-full max-w-xs mb-4">
            <button
              type="button"
              onClick={() => oauthSignIn('github')}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 font-medium"
            >
              Sign in with GitHub
            </button>
            <button
              type="button"
              onClick={() => oauthSignIn('google')}
              className="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 font-medium"
            >
              Sign in with Google
            </button>
          </div>

          <form onSubmit={handleSignIn} className="flex flex-col space-y-4 w-full max-w-xs">
            <label className="flex flex-col text-gray-700 dark:text-gray-300">
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
              />
            </label>
            <label className="flex flex-col text-gray-700 dark:text-gray-300">
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
              />
            </label>
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 py-2 transition-colors duration-200 font-medium"
            >
              Sign In
            </button>
            {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-primary hover:underline"
              >
                Register
              </button>
            </p>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl mb-4 text-gray-800 dark:text-gray-200">Register</h1>
          <div className="flex flex-col space-y-2 w-full max-w-xs mb-4">
            <button
              type="button"
              onClick={() => oauthSignIn('github')}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 font-medium"
            >
              Register with GitHub
            </button>
            <button
              type="button"
              onClick={() => oauthSignIn('google')}
              className="w-full bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 font-medium"
            >
              Register with Google
            </button>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col space-y-4 w-full max-w-xs">
            <label className="flex flex-col text-gray-700 dark:text-gray-300">
              Username
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
              />
            </label>
            <label className="flex flex-col text-gray-700 dark:text-gray-300">
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 px-3 py-2 border rounded-lg bg-background dark:bg-gray-800 border-border dark:border-gray-700 text-foreground"
              />
            </label>
            <label className="flex flex-col text-gray-700 dark:text-gray-300">
              Password
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-primary hover:underline"
              >
                Sign In
              </button>
            </p>
          </form>
        </>
      )}
    </div>
  );
} 