'use client'
import { useState, useRef, useEffect } from 'react'

type ToastState = { msg: string; phase: 'in' | 'out'; error?: boolean } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)
  const timer = useRef<any>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const showToast = (msg: string, error = false) => {
    clearTimeout(timer.current)
    setToast({ msg, phase: 'in', error })
    timer.current = setTimeout(() => {
      setToast(t => t ? { ...t, phase: 'out' } : null)
      timer.current = setTimeout(() => setToast(null), 220)
    }, 1800)
  }

  return { toast, showToast }
}

export default function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl pointer-events-none ${toast.error ? 'bg-red-600' : 'bg-[#0d0d0f]'} ${toast.phase === 'in' ? 'animate-toast-in' : 'animate-toast-out'}`}>
      {toast.error
        ? <span className="w-4 h-4 rounded-full bg-red-400 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">✕</span>
        : <span className="w-4 h-4 rounded-full bg-[#00e5a0] flex items-center justify-center text-black text-[9px] font-black flex-shrink-0">✓</span>
      }
      {toast.msg}
    </div>
  )
}
