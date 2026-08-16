"use client";

import React from "react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-900 rounded-full filter blur-[128px] opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-indigo-900 rounded-full filter blur-[128px] opacity-30 animate-pulse"></div>

      <main className="relative z-10 max-w-2xl px-6 text-center flex flex-col items-center">
        {/* Logo */}
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-3xl text-white shadow-lg mb-8">
          N
        </div>

        {/* Title */}
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent sm:text-6xl">
          Nexus AI Platform
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg leading-8 text-zinc-400 max-w-lg">
          A production-grade, full-stack environment for building and orchestrating distributed AI, ML, and LLM applications.
        </p>

        {/* Actions */}
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 transition duration-150 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold leading-6 text-indigo-400 hover:text-indigo-300 transition duration-150"
          >
            Create account <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>

      {/* Subtle bottom footer info */}
      <footer className="absolute bottom-6 text-xs text-zinc-600">
        Designed for Senior Engineering Transition © {new Date().getFullYear()} Nexus AI
      </footer>
    </div>
  );
}
