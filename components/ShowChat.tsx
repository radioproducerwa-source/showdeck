'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { IconMessage, IconSend, IconX, Spinner } from './icons'

type Msg = {
  id: string
  user_id: string
  sender_name: string | null
  sender_avatar: string | null
  body: string
  created_at: string
}

function timeLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

export default function ShowChat({ showId }: { showId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const [me, setMe] = useState<{ id: string; name: string; avatar: string | null } | null>(null)
  const [sending, setSending] = useState(false)

  const openRef = useRef(open)
  openRef.current = open
  const seenIds = useRef<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const addMessage = useCallback((m: Msg) => {
    if (seenIds.current.has(m.id)) return
    seenIds.current.add(m.id)
    setMessages(prev => [...prev, m])
    if (!openRef.current) setUnread(u => u + 1)
  }, [])

  // Load current user + recent messages, then subscribe to realtime inserts
  useEffect(() => {
    let ignore = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || ignore) return
      const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
      if (ignore) return
      setMe({
        id: user.id,
        name: profile?.display_name || user.email?.split('@')[0] || 'You',
        avatar: profile?.avatar_url || null,
      })

      const { data } = await supabase.from('show_messages')
        .select('*').eq('show_id', showId)
        .order('created_at', { ascending: true }).limit(100)
      if (ignore) return
      const rows = (data || []) as Msg[]
      rows.forEach(r => seenIds.current.add(r.id))
      setMessages(rows)
      setLoading(false)
    })()

    const channel = supabase
      .channel(`show-chat-${showId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'show_messages', filter: `show_id=eq.${showId}` },
        payload => addMessage(payload.new as Msg))
      .subscribe()

    return () => { ignore = true; supabase.removeChannel(channel) }
  }, [showId, addMessage])

  // Auto-scroll to newest when open / new message
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => { if (open) setUnread(0) }, [open])

  const send = async () => {
    const body = input.trim()
    if (!body || !me || sending) return
    setSending(true)
    setInput('')
    const { data, error } = await supabase.from('show_messages').insert({
      show_id: showId,
      user_id: me.id,
      sender_name: me.name,
      sender_avatar: me.avatar,
      body,
    }).select().single()
    setSending(false)
    if (error) { setInput(body); return }
    if (data) addMessage(data as Msg)
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#0d0d0f] text-white shadow-lg hover:bg-[#2a2a2f] active:scale-95 transition-all flex items-center justify-center"
          aria-label="Open show chat"
        >
          <IconMessage size={22} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#00e5a0] text-black text-xs font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed z-40 bg-white border border-[#e2e4e8] shadow-2xl flex flex-col
          inset-x-0 bottom-0 h-[70vh] rounded-t-2xl
          sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:h-[520px] sm:rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e4e8] bg-[#0d0d0f] text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <IconMessage size={16} />
              <span className="font-semibold text-sm">Show chat</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors" aria-label="Close chat">
              <IconX size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#f7f8fa]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-[#9a9aaa]"><Spinner size={20} /></div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#9a9aaa] px-6">
                <div className="w-12 h-12 rounded-full bg-white border border-[#e2e4e8] flex items-center justify-center mb-3 text-[#c8cad0]">
                  <IconMessage size={20} />
                </div>
                <p className="text-sm font-medium text-[#6b6b7a]">No messages yet</p>
                <p className="text-xs mt-0.5">Say hello to your team.</p>
              </div>
            ) : (
              messages.map(m => {
                const mine = me && m.user_id === me.id
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-[#00e5a0] flex items-center justify-center text-black text-xs font-bold">
                      {m.sender_avatar
                        ? <img src={m.sender_avatar} alt={m.sender_name || ''} className="w-full h-full object-cover" />
                        : (m.sender_name?.[0]?.toUpperCase() || '?')}
                    </div>
                    <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!mine && <span className="text-[10px] text-[#9a9aaa] mb-0.5 px-1">{m.sender_name || 'Someone'}</span>}
                      <div className={`rounded-2xl px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap ${
                        mine ? 'bg-[#00e5a0] text-black rounded-br-md' : 'bg-white border border-[#e2e4e8] text-[#0d0d0f] rounded-bl-md'
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[9px] text-[#c8cad0] mt-0.5 px-1">{timeLabel(m.created_at)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-[#e2e4e8] p-2.5 flex items-center gap-2 bg-white rounded-b-2xl">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Message…"
              className="flex-1 bg-[#f7f8fa] border border-[#e2e4e8] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[#00e5a0] placeholder-[#c8cad0]"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full bg-[#00e5a0] text-black flex items-center justify-center flex-shrink-0 hover:bg-[#00d494] active:scale-95 transition-all disabled:opacity-40"
              aria-label="Send message"
            >
              <IconSend size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
