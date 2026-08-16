"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, API_URL } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-zinc-950 text-white relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-900 rounded-full filter blur-[128px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-indigo-900 rounded-full filter blur-[128px] opacity-30 animate-pulse"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-sm relative z-10">
        <h2 className="mt-10 text-center text-3xl font-extrabold leading-9 tracking-tight bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
          Welcome back to Nexus
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Sign in to manage your organizations and AI services
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 px-8 py-10 rounded-2xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold leading-6 text-zinc-300">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full rounded-lg border-0 bg-zinc-800/40 py-2.5 px-3.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700/60 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition duration-200 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold leading-6 text-zinc-300">
                  Password
                </label>
              </div>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border-0 bg-zinc-800/40 py-2.5 px-3.5 text-white shadow-sm ring-1 ring-inset ring-zinc-700/60 placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6 transition duration-200 outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-2.5 text-sm font-semibold leading-6 text-white shadow-md hover:from-purple-500 hover:to-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-400">
            Don't have an account yet?{" "}
            <Link href="/signup" className="font-semibold leading-6 text-indigo-400 hover:text-indigo-300 transition duration-150">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
