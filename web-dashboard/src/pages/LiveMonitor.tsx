import { useState, useEffect, useRef } from 'react'
import { useAuth, API_URL } from '../App'

interface LiveLead {
  id: string
  session_id: string
  persona: string | null
  intent_score: number
  intent_state: string
  signals: string[]
  calendly_shown: boolean
  updated_at: string | null
  qualification_status?: string
  qualification_checklist?: Record<string, any> | null
}

export default function LiveMonitor() {
  const { auth } = useAuth()
  const [sessions, setSessions] = useState<LiveLead[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const [takeoverInput, setTakeoverInput] = useState('')
  const [takingOver, setTakingOver] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // SSE Connection
  useEffect(() => {
    // EventSource doesn't support custom headers, so we'll use fetch-based SSE
    let aborted = false

    async function connectSSE() {
      try {
        const res = await fetch(`${API_URL}/live/stream`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
        if (!res.ok || !res.body) return
        setConnected(true)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data && data !== '{}') {
                try {
                  const leads = JSON.parse(data)
                  setSessions(leads)
                } catch (e) { /* heartbeat or parse error */ }
              }
            }
          }
        }
      } catch (err) {
        console.error('SSE connection error:', err)
        setConnected(false)
        // Retry after 5 seconds
        if (!aborted) setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      aborted = true
      setConnected(false)
    }
  }, [auth.token])

  // Fetch selected lead detail
  useEffect(() => {
    if (!selected) return
    fetchDetail(selected)
    const interval = setInterval(() => fetchDetail(selected), 4000)
    return () => clearInterval(interval)
  }, [selected])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedDetail])

  const fetchDetail = async (leadId: string) => {
    try {
      const res = await fetch(`${API_URL}/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setSelectedDetail(await res.json())
    } catch (err) { console.error(err) }
  }

  const handleTakeover = async () => {
    if (!takeoverInput.trim() || !selected || takingOver) return
    setTakingOver(true)
    try {
      const res = await fetch(`${API_URL}/live/takeover/${selected}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ message: takeoverInput }),
      })
      if (res.ok) {
        setTakeoverInput('')
        fetchDetail(selected)
      }
    } catch (err) { console.error(err) }
    finally { setTakingOver(false) }
  }


  const qualStatusColor = (s: string | undefined) =>
    s === 'qualified' ? 'var(--accent-green)' : s === 'unqualified' ? 'var(--accent-red)' : 'var(--accent-yellow)'

  const qualStatusLabel = (s: string | undefined) =>
    s === 'qualified' ? '🟢 Qualified' : s === 'unqualified' ? '🔴 Unqualified' : '🟡 Collecting'

  const getChecklistProgress = (checklist: Record<string, any> | null | undefined) => {
    if (!checklist) return { filled: 0, total: 6 }
    const fields = ['name', 'company', 'role', 'use_case', 'company_size', 'timeline']
    const filled = fields.filter(f => checklist[f] != null && checklist[f] !== '').length
    return { filled, total: fields.length }
  }

  const timeSince = (dateStr: string | null) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Live Monitor</h1>
          <p className="page-subtitle">Watch your AI agent think in real-time</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
          color: connected ? 'var(--accent-green)' : 'var(--accent-red)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? 'var(--accent-green)' : 'var(--accent-red)',
            animation: connected ? 'pulse-dot 2s infinite' : 'none',
          }} />
          {connected ? 'Live • Streaming' : 'Connecting...'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, minHeight: 560 }}>
        {/* Sessions List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
            fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
          }}>
            Active Sessions ({sessions.length})
          </div>

          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {sessions.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <p>No active sessions yet</p>
              </div>
            ) : sessions.map(s => {
              const progress = getChecklistProgress(s.qualification_checklist)
              return (
              <div
                key={s.id}
                onClick={() => setSelected(s.id)}
                style={{
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: selected === s.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                  borderLeft: selected === s.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.qualification_checklist?.name || s.persona || 'New Visitor'}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                    background: s.qualification_status === 'qualified' ? 'rgba(16,185,129,0.1)' : s.qualification_status === 'unqualified' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                    color: qualStatusColor(s.qualification_status),
                  }}>
                    {qualStatusLabel(s.qualification_status)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.qualification_checklist?.company || 'Unknown company'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {timeSince(s.updated_at)}
                  </span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{
                      width: `${(progress.filled / progress.total) * 100}%`,
                      height: '100%', borderRadius: 2, transition: 'width 0.3s',
                      background: progress.filled === progress.total ? 'var(--accent-green)' : 'var(--accent-primary)',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{progress.filled}/{progress.total}</span>
                </div>
              </div>
            )})}
          </div>
        </div>

        {/* Agent Brain Panel */}
        {selected && selectedDetail ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Qualification Header */}
            <div style={{
              padding: '0 0 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, padding: '5px 14px', borderRadius: 10,
                  background: selectedDetail.qualification_status === 'qualified' ? 'rgba(16,185,129,0.12)' : selectedDetail.qualification_status === 'unqualified' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  color: qualStatusColor(selectedDetail.qualification_status),
                }}>
                  {qualStatusLabel(selectedDetail.qualification_status)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedDetail.persona || 'Persona detecting...'}
                </span>
              </div>

              {/* Qualification Checklist */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['name', 'company', 'role', 'use_case', 'company_size', 'timeline'].map(field => {
                  const value = selectedDetail.qualification_checklist?.[field]
                  const label = field.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                  return (
                    <div key={field} style={{
                      padding: '8px 10px', borderRadius: 8, fontSize: 12,
                      background: value ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {value ? '✅' : '⬜'} {label}
                      </div>
                      <div style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: value ? 600 : 400, fontSize: 12 }}>
                        {value ?? '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Chat Transcript */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 0',
              display: 'flex', flexDirection: 'column', gap: 8,
              maxHeight: 280,
            }}>
              {(selectedDetail.conversation || []).map((turn: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: turn.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                    fontSize: 13, lineHeight: 1.5,
                    background: turn.role === 'user'
                      ? 'rgba(99,102,241,0.15)'
                      : turn.human_takeover
                        ? 'rgba(16,185,129,0.15)'
                        : 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    border: turn.human_takeover ? '1px solid rgba(16,185,129,0.3)' : 'none',
                  }}>
                    {turn.human_takeover && (
                      <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 4, fontWeight: 600 }}>
                        👤 HUMAN TAKEOVER
                      </div>
                    )}
                    {turn.content}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, padding: '0 4px' }}>
                    {turn.role === 'user' ? 'Buyer' : turn.human_takeover ? 'You (Admin)' : 'AI Agent'}
                    {turn.timestamp && ` · ${new Date(turn.timestamp).toLocaleTimeString()}`}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Takeover Input */}
            <div style={{
              borderTop: '1px solid var(--border-subtle)', paddingTop: 12,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <input
                className="form-input"
                placeholder="Take over — type a message as the AI..."
                value={takeoverInput}
                onChange={e => setTakeoverInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTakeover()}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleTakeover}
                disabled={takingOver || !takeoverInput.trim()}
              >
                {takingOver ? '...' : 'Send'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <h3>Select a session</h3>
              <p>Click on an active session to see the AI agent's reasoning in real-time, and take over if needed.</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .signal-pill {
          display: inline-block; padding: 3px 10px; border-radius: 10px;
          font-size: 11px; font-weight: 600;
          background: rgba(99,102,241,0.1); color: var(--accent-primary);
        }
        .intent-badge {
          display: inline-block; padding: 4px 12px; border-radius: 10px; font-weight: 600;
        }
        .intent-exploring { background: rgba(100,116,139,0.1); color: var(--text-muted); }
        .intent-comparing { background: rgba(234,179,8,0.1); color: var(--accent-yellow); }
        .intent-decisionready { background: rgba(16,185,129,0.1); color: var(--accent-green); }
      `}</style>
    </div>
  )
}
