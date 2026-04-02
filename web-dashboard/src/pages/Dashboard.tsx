import { useState, useEffect } from 'react'
import { useAuth, API_URL } from '../App'

export default function Dashboard() {
  const { auth } = useAuth()
  const [stats, setStats] = useState({
    total_leads: 0,
    avg_intent_score: 0,
    decision_ready_count: 0,
    conversion_rate: 0,
  })
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${auth.token}` }
      const [statsRes, leadsRes] = await Promise.all([
        fetch(`${API_URL}/analytics/`, { headers }),
        fetch(`${API_URL}/leads/`, { headers }),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (leadsRes.ok) {
        const data = await leadsRes.json()
        setLeads(data.slice(0, 8))
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
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

  const getStateBadgeClass = (state: string) => {
    switch(state) {
      case 'Decision-Ready': return 'badge-intent badge-decision-ready'
      case 'Comparing': return 'badge-intent badge-comparing'
      default: return 'badge-intent badge-exploring'
    }
  }

  const getGaugeColor = (score: number) => {
    if (score >= 76) return 'var(--accent-green)'
    if (score >= 41) return 'var(--accent-yellow)'
    return 'var(--accent-blue)'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your AI sales agent performance at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-blue-bg)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="stat-value">{stats.total_leads}</div>
          <div className="stat-label">Total Leads</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div className="stat-value">{stats.avg_intent_score}</div>
          <div className="stat-label">Avg Intent Score</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-green-bg)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="stat-value">{stats.decision_ready_count}</div>
          <div className="stat-label">Decision-Ready</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--accent-yellow-bg)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
          </div>
          <div className="stat-value">{stats.conversion_rate}%</div>
          <div className="stat-label">Conversion Rate</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid-2">
        {/* Recent Leads */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Leads</div>
              <div className="card-subtitle">Latest buyer conversations</div>
            </div>
            <a href="/leads" className="btn btn-sm btn-secondary">View all</a>
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading...</p>
            </div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              <h3>No leads yet</h3>
              <p>Leads will appear here once buyers start chatting with your AI agent.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {leads.map((lead: any) => (
                <a
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="lead-item"
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="lead-avatar"
                    style={{ background: getStateColor(lead.intent_state) }}
                  >
                    {(lead.persona || 'L')[0].toUpperCase()}
                  </div>
                  <div className="lead-info">
                    <div className="lead-name">
                      {lead.persona || `Session ${lead.session_id.slice(0, 8)}`}
                    </div>
                    <div className="lead-meta">
                      {lead.signals?.slice(0, 2).join(' · ') || 'No signals yet'}
                    </div>
                  </div>
                  <div className="lead-score">
                    <div className="lead-score-value" style={{ color: getStateColor(lead.intent_state) }}>
                      {lead.intent_score}
                    </div>
                    <div className="lead-score-label">{lead.intent_state}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Intent Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Intent Distribution</div>
              <div className="card-subtitle">Where your leads are in the journey</div>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="empty-state">
              <h3>No data yet</h3>
              <p>Distribution will appear once you have active leads.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                { label: 'Exploring', count: leads.filter(l => l.intent_state === 'Exploring').length, total: leads.length, color: 'var(--accent-blue)' },
                { label: 'Comparing', count: leads.filter(l => l.intent_state === 'Comparing').length, total: leads.length, color: 'var(--accent-yellow)' },
                { label: 'Decision-Ready', count: leads.filter(l => l.intent_state === 'Decision-Ready').length, total: leads.length, color: 'var(--accent-green)' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.count}</span>
                  </div>
                  <div className="intent-gauge">
                    <div
                      className="intent-gauge-fill"
                      style={{
                        width: `${item.total ? (item.count / item.total) * 100 : 0}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, padding: 16, background: 'rgba(99,102,241,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Your embed code</div>
                <code style={{ fontSize: 12, color: 'var(--accent-primary)', wordBreak: 'break-all' }}>
                  {'<script src="https://cdn.salesgen.com/widget.js" data-org="' + (auth.orgSlug || 'your-slug') + '"></script>'}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
