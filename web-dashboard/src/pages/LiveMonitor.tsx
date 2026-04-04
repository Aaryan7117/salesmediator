import { useState, useEffect, useRef } from 'react'
import { useAuth, API_URL } from '../App'

interface LiveLead {
  id: string
  session_id: string
  persona: string | null
  qualification_checklist: Record<string, any>
  qualification_status: string
  calendly_shown: boolean
  updated_at: string | null
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

  useEffect(() => {
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
                } catch (e) { }
              }
            }
          }
        }
      } catch (err) {
        setConnected(false)
        if (!aborted) setTimeout(connectSSE, 5000)
      }
    }
    connectSSE()
    return () => {
      aborted = true
      setConnected(false)
    }
  }, [auth.token])

  useEffect(() => {
    if (!selected) return
    fetchDetail(selected)
    const interval = setInterval(() => fetchDetail(selected), 4000)
    return () => clearInterval(interval)
  }, [selected])

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

  const stateEmoji = (s: string) =>
    s === 'qualified' ? '🟢' : s === 'unqualified' ? '🔴' : '🟡'
    
  const getStatusColor = (s: string) =>
    s === 'qualified' ? 'var(--accent-green)' : s === 'unqualified' ? 'var(--accent-red)' : 'var(--accent-yellow)'

  const timeSince = (dateStr: string | null) => {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  const getChecklistCount = (cl: any = {}) => {
    const total = Object.keys(cl).length || 6
    const checked = Object.values(cl).filter(v => v !== null && v !== undefined).length
    return `${checked}/${total}`
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Live Monitor</h1>
          <p className="page-subtitle">Watch your agent gather qualification data in real-time</p>
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
            ) : sessions.map(s => (
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
                    {stateEmoji(s.qualification_status)} {s.persona || 'New Visitor'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: getStatusColor(s.qualification_status) }}>
                    {getChecklistCount(s.qualification_checklist)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {s.qualification_status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {timeSince(s.updated_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Brain Panel */}
        {selected && selectedDetail ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Brain Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
              padding: '0 0 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 16,
            }}>
              {/* Progress */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Progress</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: getStatusColor(selectedDetail.qualification_status) }}>
                  {getChecklistCount(selectedDetail.qualification_checklist)}
                </div>
              </div>
              {/* State */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Status</div>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: getStatusColor(selectedDetail.qualification_status) }}>
                  {selectedDetail.qualification_status}
                </div>
              </div>
              {/* Persona */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Persona</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedDetail.persona || '—'}
                </div>
              </div>
              {/* Calendly Gate */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Calendly</div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: selectedDetail.calendly_shown ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                  {selectedDetail.calendly_shown ? '✓ Shown' : '✗ Gated'}
                </div>
              </div>
            </div>

            {/* Checklist items */}
            {selectedDetail.qualification_checklist && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Qualification Checklist
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {Object.entries(selectedDetail.qualification_checklist).map(([key, val]: any) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ color: val !== null ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                         {val !== null ? '✅' : '❌'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {key.replace('_', ' ')}:
                      </span>
                      <span style={{ fontWeight: 600 }}>{val !== null ? String(val) : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Transcript */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 0', borderTop: '1px solid var(--border-subtle)',
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
      `}</style>
    </div>
  )
}
