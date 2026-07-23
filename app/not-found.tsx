'use client'
import Link from 'next/link'
import { LogoIcon } from '../components/Logo'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-8 opacity-20">
          <LogoIcon size={80} />
        </div>
        <p className="text-[#00e5a0] text-sm font-bold tracking-[0.3em] uppercase mb-4">404</p>
        <h1 className="text-white text-3xl font-bold mb-3">Page not found</h1>
        <p className="text-white/50 text-sm leading-relaxed mb-10">
          This page doesn't exist or you don't have access to it.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#00e5a0] text-black font-bold rounded-xl px-8 py-3 text-sm tracking-widest hover:bg-[#00ffc0] transition-colors"
        >
          GO TO DASHBOARD
        </Link>
        <div className="mt-4">
          <Link href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            or sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
