import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth, API_URL } from '../App'

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const { auth } = useAuth()
  const [lead, setLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLead()
  }, [id])

  const fetchLead = async () => {
    try {
      const res = await fetch(`${API_URL}/leads/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setLead(await res.json())
    } catch (err) {
      console.error('Lead detail error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStateColor = (state: string) => {
    switch(state) {
      case 'Decision-Ready': return 'var(--accent-green)'
      case 'Comparing': return 'var(--accent-yellow)'
      default: return 'var(--accent-blue)'
    }
  }

  if (loading) return <div className="empty-state"><p>Loading lead...</p></div>
  if (!lead) return <div className="empty-state"><h3>Lead not found</h3></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/leads" className="btn btn-sm btn-ghost" style={{ padding: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">{lead.persona || 'Unknown Buyer'}</h1>
          <p className="page-subtitle">Session: {lead.session_id.slice(0, 16)}...</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Score Card */}
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: getStateColor(lead.intent_state), lineHeight: 1 }}>
            {lead.intent_score}
          </div>
          <div className="intent-gauge" style={{ maxWidth: 200, margin: '16px auto' }}>
            <div className="intent-gauge-fill" style={{
              width: `${lead.intent_score}%`,
              background: getStateColor(lead.intent_state),
            }} />
          </div>
          <span className={
            lead.intent_state === 'Decision-Ready' ? 'badge-intent badge-decision-ready' :
            lead.intent_state === 'Comparing' ? 'badge-intent badge-comparing' :
            'badge-intent badge-exploring'
          }>
            {lead.intent_state}
          </span>
        </div>

        {/* Info Card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Lead Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Persona</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{lead.persona || 'Not detected'}</span>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Signals Detected</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(lead.signals || []).map((s: string, i: number) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 10,
                    background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', fontWeight: 500,
                  }}>
                    {s}
                  </span>
                ))}
                {(!lead.signals || lead.signals.length === 0) && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>None yet</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>CRM Filed</span>
                <span style={{ fontSize: 14 }}>{lead.crm_filed ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Calendly Shown</span>
                <span style={{ fontSize: 14 }}>{lead.calendly_shown ? '✅ Yes' : '⏳ Suppressed'}</span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Resources Served</span>
              <span style={{ fontSize: 14 }}>{(lead.resources_served || []).length} documents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Conversation</div>
            <div className="card-subtitle">{(lead.conversation || []).length} messages</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 500, overflowY: 'auto', paddingRight: 8 }}>
          {(lead.conversation || []).map((msg: any, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: 12,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'white',
              }}>
                {msg.role === 'user' ? 'B' : 'AI'}
              </div>
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.1)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(139,92,246,0.15)'}`,
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
              }}>
                {msg.content}
                {msg.timestamp && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!lead.conversation || lead.conversation.length === 0) && (
            <div className="empty-state"><p>No messages yet</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
