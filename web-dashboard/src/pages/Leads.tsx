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
    : leads.filter(l => (l.qualification_status || 'collecting') === filter)

  const getStateColor = (state: string) => {
    switch(state) {
      case 'qualified': return 'var(--accent-green)'
      case 'unqualified': return 'var(--accent-red)'
      default: return 'var(--accent-yellow)'
    }
  }

  const getChecklistCount = (cl: any = {}) => {
    const total = Object.keys(cl).length || 6;
    const checked = Object.values(cl).filter(v => v !== null && v !== undefined).length;
    return `${checked}/${total}`
  }

  const getChecklistPercent = (cl: any = {}) => {
    const total = Object.keys(cl).length || 6;
    const checked = Object.values(cl).filter(v => v !== null && v !== undefined).length;
    return Math.floor((checked / total) * 100);
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
          { label: 'Collecting', value: 'collecting', count: leads.filter(l => (l.qualification_status || 'collecting') === 'collecting').length },
          { label: 'Qualified', value: 'qualified', count: leads.filter(l => l.qualification_status === 'qualified').length },
          { label: 'Unqualified', value: 'unqualified', count: leads.filter(l => l.qualification_status === 'unqualified').length },
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
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead: any) => {
                  const status = lead.qualification_status || 'collecting'
                  return (
                  <tr key={lead.id}>
                    <td>
                      <Link
                        to={`/leads/${lead.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                      >
                        <div
                          className="lead-avatar"
                          style={{ background: getStateColor(status), width: 36, height: 36, fontSize: 13 }}
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
                        <span style={{ fontWeight: 700, fontSize: 14, color: getStateColor(status), minWidth: 32 }}>
                          {getChecklistCount(lead.qualification_checklist)}
                        </span>
                        <div className="intent-gauge" style={{ width: 80, borderRadius: 4, background: 'var(--border-subtle)', height: 6, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${getChecklistPercent(lead.qualification_checklist)}%`,
                              background: getStateColor(status),
                              borderRadius: 4
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-intent" style={{ color: getStateColor(status), background: \`\${getStateColor(status)}20\`, textTransform: 'capitalize' }}>
                        <span className="live-dot" style={{
                          width: 6, height: 6,
                          background: getStateColor(status),
                        }} />
                        {status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {lead.updated_at
                        ? new Date(lead.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
