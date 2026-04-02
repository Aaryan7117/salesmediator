import { useState, useEffect } from 'react'
import { useAuth, API_URL } from '../App'
import { Link } from 'react-router-dom'

export default function Leads() {
  const { auth } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${API_URL}/leads/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setLeads(await res.json())
    } catch (err) {
      console.error('Leads fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'all'
    ? leads
    : leads.filter(l => l.intent_state === filter)

  const getStateColor = (state: string) => {
    switch(state) {
      case 'Decision-Ready': return 'var(--accent-green)'
      case 'Comparing': return 'var(--accent-yellow)'
      default: return 'var(--accent-blue)'
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{leads.length} total conversations</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { label: 'All', value: 'all', count: leads.length },
          { label: 'Exploring', value: 'Exploring', count: leads.filter(l => l.intent_state === 'Exploring').length },
          { label: 'Comparing', value: 'Comparing', count: leads.filter(l => l.intent_state === 'Comparing').length },
          { label: 'Decision-Ready', value: 'Decision-Ready', count: leads.filter(l => l.intent_state === 'Decision-Ready').length },
        ].map(f => (
          <button
            key={f.value}
            className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Lead Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><p>Loading leads...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No leads found</h3>
            <p>Leads will appear once buyers start chatting with your AI agent.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Intent Score</th>
                  <th>State</th>
                  <th>Signals</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead: any) => (
                  <tr key={lead.id}>
                    <td>
                      <Link
                        to={`/leads/${lead.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                      >
                        <div
                          className="lead-avatar"
                          style={{ background: getStateColor(lead.intent_state), width: 36, height: 36, fontSize: 13 }}
                        >
                          {(lead.persona || 'L')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                            {lead.persona || 'Unknown Persona'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {lead.session_id.slice(0, 12)}...
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 18, color: getStateColor(lead.intent_state), minWidth: 32 }}>
                          {lead.intent_score}
                        </span>
                        <div className="intent-gauge" style={{ width: 80 }}>
                          <div
                            className="intent-gauge-fill"
                            style={{
                              width: `${lead.intent_score}%`,
                              background: getStateColor(lead.intent_state),
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={
                        lead.intent_state === 'Decision-Ready' ? 'badge-intent badge-decision-ready' :
                        lead.intent_state === 'Comparing' ? 'badge-intent badge-comparing' :
                        'badge-intent badge-exploring'
                      }>
                        <span className="live-dot" style={{
                          width: 6, height: 6,
                          background: getStateColor(lead.intent_state),
                          animation: lead.intent_state === 'Decision-Ready' ? 'pulse-live 1.5s infinite' : 'none',
                        }} />
                        {lead.intent_state}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                        {(lead.signals || []).slice(0, 3).map((s: string, i: number) => (
                          <span key={i} style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(99,102,241,0.1)',
                            color: 'var(--accent-primary)',
                            fontWeight: 500,
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {lead.updated_at
                        ? new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
