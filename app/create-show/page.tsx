'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Logo, { LogoIcon } from '../../components/Logo'

const SHOW_TYPES = [
  {
    value: 'podcast',
    label: 'Podcast',
    icon: '🎙️',
    description: 'Flexible episode planning for podcast teams',
    color: '#00e5a0',
    features: ['Host-led segments', 'Episode archive', 'Export runsheets'],
  },
  {
    value: 'radio',
    label: 'Radio Show',
    icon: '📻',
    description: 'Structured broadcast planning for on-air teams',
    color: '#a78bfa',
    features: ['Broadcast segments', 'News, sport, weather & more', 'Live runsheet format'],
  },
]

export default function CreateShow() {
  const [user, setUser] = useState<any>(null)
  const [step, setStep] = useState<'type' | 'details'>('type')
  const [showType, setShowType] = useState<'podcast' | 'radio' | null>(null)
  const [showName, setShowName] = useState('')
  const [host1, setHost1] = useState('')
  const [host2, setHost2] = useState('')
  const [extraHosts, setExtraHosts] = useState<string[]>([])
  const [hasProducer, setHasProducer] = useState(false)
  const [producer, setProducer] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else setUser(data.user)
    })
  }, [])

  const handleCreate = async () => {
    if (!showName || !host1 || !host2) {
      setMessage('Please fill in show name and both names')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('shows').insert({
      name: showName,
      owner_id: user.id,
      show_type: showType,
      host1_name: host1,
      host2_name: host2,
      additional_hosts: JSON.stringify(extraHosts.filter(h => h.trim())),
      has_producer: hasProducer,
      producer_name: hasProducer ? producer : null,
    })
    if (error) { setMessage(error.message); setLoading(false) }
    else window.location.href = '/dashboard'
  }

  const isRadio = showType === 'radio'
  const host1Label = isRadio ? 'Presenter 1' : 'Host 1 Name'
  const host2Label = isRadio ? 'Presenter 2' : 'Host 2 Name'
  const host1Placeholder = isRadio ? 'e.g. Matt Thompson' : 'Your name'
  const host2Placeholder = isRadio ? 'e.g. Sarah Jones' : 'Co-host name'

  const leftPanelContent = showType ? SHOW_TYPES.find(t => t.value === showType) : null

  if (!user) return <div className="min-h-screen bg-[#f7f8fa]" />

  return (
    <main className="min-h-screen flex">

      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0d0f] p-12 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-auto">
          <LogoIcon size={28} />
          <span className="text-white font-bold text-xl tracking-[0.2em]" style={{ fontFamily: 'monospace' }}>SHOWDECK</span>
        </div>
        <div className="mt-auto">
          {leftPanelContent ? (
            <>
              <div className="text-5xl mb-5">{leftPanelContent.icon}</div>
              <h2 className="text-white text-4xl font-bold leading-tight mb-4">{leftPanelContent.label}</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-10">{leftPanelContent.description}</p>
              <div className="flex flex-col gap-4">
                {leftPanelContent.features.map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: leftPanelContent.color + '20' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: leftPanelContent.color }} />
                    </div>
                    <span className="text-white/60 text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-white text-4xl font-bold leading-tight mb-4">Your show.<br />Your way.</h2>
              <p className="text-white/50 text-sm leading-relaxed">Choose a show type to get started with the right setup for your team.</p>
            </>
          )}
        </div>
        <div className="absolute -bottom-16 -right-16 opacity-[0.04] pointer-events-none">
          <LogoIcon size={320} />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f7f8fa]">
        <div className="bg-white border border-[#e2e4e8] rounded-2xl p-10 w-full max-w-lg shadow-sm">
          <div className="mb-1 lg:hidden"><Logo size={0.9} /></div>

          {step === 'type' ? (
            <>
              <h2 className="text-xl font-bold mb-1">What kind of show is this?</h2>
              <p className="text-[#6b6b7a] text-sm mb-8">This sets up the right default segments and labels for your team</p>
              <div className="flex flex-col gap-4 mb-8">
                {SHOW_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setShowType(type.value as 'podcast' | 'radio')}
                    className={`flex items-start gap-5 p-5 rounded-2xl border-2 text-left transition-all ${
                      showType === type.value
                        ? 'border-[#00e5a0] bg-[#f0fff8]'
                        : 'border-[#e2e4e8] bg-white hover:border-[#c8cad0]'
                    }`}
                  >
                    <span className="text-4xl leading-none flex-shrink-0 mt-0.5">{type.icon}</span>
                    <div>
                      <div className="font-bold text-base mb-1">{type.label}</div>
                      <div className="text-[#6b6b7a] text-sm leading-snug">{type.description}</div>
                    </div>
                    <div className={`ml-auto flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all ${
                      showType === type.value ? 'border-[#00e5a0] bg-[#00e5a0]' : 'border-[#e2e4e8]'
                    }`}>
                      {showType === type.value && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep('details')}
                disabled={!showType}
                className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-sm tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-40"
              >
                CONTINUE →
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('type')} className="text-[#6b6b7a] hover:text-[#0d0d0f] text-sm transition-colors">← Back</button>
                <span className="text-2xl">{SHOW_TYPES.find(t => t.value === showType)?.icon}</span>
                <h2 className="text-xl font-bold">{SHOW_TYPES.find(t => t.value === showType)?.label}</h2>
              </div>

              <div className="mb-5">
                <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Show Name</label>
                <input type="text" value={showName} onChange={e => setShowName(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                  placeholder={isRadio ? 'e.g. Breakfast with Matt & Sarah' : 'e.g. The Footy Punt'} />
              </div>
              <div className="mb-5">
                <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">{host1Label}</label>
                <input type="text" value={host1} onChange={e => setHost1(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                  placeholder={host1Placeholder} />
              </div>
              <div className="mb-5">
                <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">{host2Label}</label>
                <input type="text" value={host2} onChange={e => setHost2(e.target.value)}
                  className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                  placeholder={host2Placeholder} />
              </div>

              {/* Extra presenters — radio only */}
              {isRadio && (
                <div className="mb-5">
                  {extraHosts.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <label className="text-[#6b6b7a] text-xs uppercase tracking-widest">Presenter {i + 3}</label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setExtraHosts(prev => prev.map((h, j) => j === i ? e.target.value : h))}
                          className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-2 text-sm outline-none focus:border-[#00e5a0]"
                          placeholder={`e.g. Presenter ${i + 3}`}
                        />
                      </div>
                      <button
                        onClick={() => setExtraHosts(prev => prev.filter((_, j) => j !== i))}
                        className="text-[#c8cad0] hover:text-[#ff5c3a] text-xl leading-none mt-6 flex-shrink-0 transition-colors"
                        title="Remove">×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExtraHosts(prev => [...prev, ''])}
                    className="text-[#6b6b7a] text-sm hover:text-[#00a870] transition-colors mt-1"
                  >
                    + Add another presenter
                  </button>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setHasProducer(!hasProducer)}>
                  <div className={`w-9 h-5 rounded-full relative transition-colors ${hasProducer ? 'bg-[#a78bfa]' : 'bg-[#e2e4e8]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasProducer ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-[#6b6b7a] text-sm">Include a Producer role</span>
                </div>
                {hasProducer && (
                  <input type="text" value={producer} onChange={e => setProducer(e.target.value)}
                    className="w-full bg-white border border-[#e2e4e8] rounded-lg text-[#0d0d0f] px-4 py-3 mt-3 text-sm outline-none focus:border-[#a78bfa]"
                    placeholder="Producer name" />
                )}
              </div>
              {message && <p className="text-[#ff5c3a] text-sm mb-4">{message}</p>}
              <button onClick={handleCreate} disabled={loading}
                className="w-full bg-[#00e5a0] text-black font-bold rounded-xl py-4 text-lg tracking-widest hover:bg-[#00ffc0] transition-colors disabled:opacity-60">
                {loading ? 'Creating...' : 'CREATE SHOW'}
              </button>
            </>
          )}
        </div>
      </div>

    </main>
  )
}
