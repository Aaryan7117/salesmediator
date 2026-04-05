import { useState, useEffect, useCallback } from 'react'
import { useAuth, API_URL } from '../App'

interface UsageStats {
  total_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  total_cost_usd: number
  avg_tokens_per_request: number
  avg_cost_per_request: number
  model: string
  model_pricing: { input: number; output: number }
  rate_limits: { rpm: number; tpm: number; rpd: number }
  today: { requests: number; tokens: number; cost_usd: number }
  last_7_days: { requests: number; tokens: number; cost_usd: number }
  daily_breakdown: Array<{ date: string; requests: number; tokens: number; cost_usd: number }>
  hourly_breakdown: Array<{ hour: string; requests: number; tokens: number }>
}

interface UsageLog {
  id: string
  session_id: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  endpoint: string
  created_at: string
  cost_usd: number
}

export default function UsageMonitor() {
  const { auth } = useAuth()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${auth.token}` }
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/usage/stats/${auth.orgId}`, { headers }),
        fetch(`${API_URL}/usage/logs/${auth.orgId}`, { headers }),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Usage fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [auth.token, auth.orgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30s when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const formatNumber = (n: number) => n.toLocaleString()
  const formatCost = (n: number) => `$${n.toFixed(4)}`
  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Calculate bar chart max for scaling
  const maxDailyTokens = stats?.daily_breakdown?.length
    ? Math.max(...stats.daily_breakdown.map(d => d.tokens), 1)
    : 1
  const maxHourlyReqs = stats?.hourly_breakdown?.length
    ? Math.max(...stats.hourly_breakdown.map(h => h.requests), 1)
    : 1

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Usage Monitor</h1>
          <p className="page-subtitle">Track token usage, API costs, and rate limits in real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            <div
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: autoRefresh ? 'var(--accent-green)' : 'var(--surface-hover)',
                transition: 'background 0.2s', position: 'relative',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: 'white',
                position: 'absolute', top: 2,
                left: autoRefresh ? 18 : 2,
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            Auto-refresh
          </label>
          <button onClick={fetchData} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading usage data...</p></div>
      ) : !stats ? (
        <div className="empty-state">
          <h3>No usage data yet</h3>
          <p>Usage metrics will appear here once your AI agent starts handling conversations.</p>
        </div>
      ) : (
        <>
          {/* ── Model Info Banner ── */}
          <div className="card" style={{ marginBottom: 24, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                fontSize: 18,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{stats.model}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active Model</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Input Price</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)' }}>${stats.model_pricing?.input ?? '—'}/1M tokens</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Output Price</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-secondary)' }}>${stats.model_pricing?.output ?? '—'}/1M tokens</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rate Limit</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-yellow)' }}>
                  {stats.rate_limits?.rpm ?? '—'} RPM · {formatNumber(stats.rate_limits?.tpm ?? 0)} TPM
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Daily Limit</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {formatNumber(stats.rate_limits?.rpd ?? 0)} req/day
                </div>
              </div>
            </div>
          </div>

          {/* ── Metric Cards ── */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 24 }}>
            {/* Today's Requests */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--accent-blue-bg)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div className="stat-value">{formatNumber(stats.today.requests)}</div>
              <div className="stat-label">Today's Requests</div>
            </div>

            {/* Today's Tokens */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="stat-value">{formatNumber(stats.today.tokens)}</div>
              <div className="stat-label">Today's Tokens</div>
            </div>

            {/* Today's Cost */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--accent-green-bg)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div className="stat-value">{formatCost(stats.today.cost_usd)}</div>
              <div className="stat-label">Today's Cost</div>
            </div>

            {/* All-Time Tokens */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--accent-yellow-bg)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <div className="stat-value">{formatNumber(stats.total_tokens)}</div>
              <div className="stat-label">All-Time Tokens</div>
            </div>

            {/* Avg Tokens / Request */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
              </div>
              <div className="stat-value">{formatNumber(stats.avg_tokens_per_request)}</div>
              <div className="stat-label">Avg Tokens/Req</div>
            </div>

            {/* Total Cost */}
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(20, 184, 166, 0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div className="stat-value">{formatCost(stats.total_cost_usd)}</div>
              <div className="stat-label">Total Cost (USD)</div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface-secondary)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {(['overview', 'logs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                  background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === tab ? 'white' : 'var(--text-muted)',
                }}
              >
                {tab === 'overview' ? '📊 Charts' : '📋 Request Logs'}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <div className="grid-2">
              {/* ── Daily Token Usage (7 days) ── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Daily Token Usage</div>
                    <div className="card-subtitle">Last 7 days • {formatNumber(stats.last_7_days.tokens)} tokens total</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>
                    {formatCost(stats.last_7_days.cost_usd)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, padding: '0 4px' }}>
                  {stats.daily_breakdown.map((day, i) => (
                    <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                        {day.tokens > 0 ? formatNumber(day.tokens) : ''}
                      </div>
                      <div
                        style={{
                          width: '100%', maxWidth: 40,
                          height: `${Math.max((day.tokens / maxDailyTokens) * 120, 4)}px`,
                          borderRadius: '6px 6px 2px 2px',
                          background: i === stats.daily_breakdown.length - 1
                            ? 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))'
                            : 'var(--surface-hover)',
                          transition: 'height 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Hourly Activity (24h) ── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Hourly Activity</div>
                    <div className="card-subtitle">Last 24 hours • {formatNumber(stats.today.requests)} requests today</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, padding: '0 4px' }}>
                  {stats.hourly_breakdown.map((hr, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max((hr.requests / maxHourlyReqs) * 120, 2)}px`,
                          borderRadius: '4px 4px 1px 1px',
                          background: hr.requests > 0
                            ? `rgba(99,102,241,${0.3 + (hr.requests / maxHourlyReqs) * 0.7})`
                            : 'var(--surface-hover)',
                          transition: 'height 0.3s ease',
                        }}
                        title={`${hr.hour}: ${hr.requests} requests, ${formatNumber(hr.tokens)} tokens`}
                      />
                      {i % 4 === 0 && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{hr.hour}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Token Breakdown ── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Token Breakdown</div>
                    <div className="card-subtitle">Input vs Output distribution</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Prompt tokens */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Prompt (Input)
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)' }}>
                        {formatNumber(stats.total_prompt_tokens)} tokens
                      </span>
                    </div>
                    <div className="intent-gauge">
                      <div className="intent-gauge-fill" style={{
                        width: `${stats.total_tokens ? (stats.total_prompt_tokens / stats.total_tokens) * 100 : 0}%`,
                        background: 'var(--accent-blue)',
                      }} />
                    </div>
                  </div>
                  {/* Completion tokens */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Completion (Output)
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-secondary)' }}>
                        {formatNumber(stats.total_completion_tokens)} tokens
                      </span>
                    </div>
                    <div className="intent-gauge">
                      <div className="intent-gauge-fill" style={{
                        width: `${stats.total_tokens ? (stats.total_completion_tokens / stats.total_tokens) * 100 : 0}%`,
                        background: 'var(--accent-secondary)',
                      }} />
                    </div>
                  </div>

                  {/* Cost summary */}
                  <div style={{
                    padding: 16, borderRadius: 'var(--radius-md)',
                    background: 'rgba(99,102,241,0.06)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Input Cost</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)' }}>
                        {formatCost((stats.total_prompt_tokens / 1_000_000) * (stats.model_pricing?.input ?? 0))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Output Cost</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-secondary)' }}>
                        {formatCost((stats.total_completion_tokens / 1_000_000) * (stats.model_pricing?.output ?? 0))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Avg per Request</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>
                        {formatCost(stats.avg_cost_per_request)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Rate Limit Gauges ── */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Rate Limit Status</div>
                    <div className="card-subtitle">Current usage vs model limits</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* RPD gauge */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Requests/Day
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatNumber(stats.today.requests)} / {formatNumber(stats.rate_limits?.rpd ?? 0)}
                      </span>
                    </div>
                    <div className="intent-gauge">
                      <div className="intent-gauge-fill" style={{
                        width: `${stats.rate_limits?.rpd ? Math.min((stats.today.requests / stats.rate_limits.rpd) * 100, 100) : 0}%`,
                        background: stats.rate_limits?.rpd && stats.today.requests / stats.rate_limits.rpd > 0.8
                          ? 'var(--accent-red, #ef4444)' : 'var(--accent-green)',
                      }} />
                    </div>
                  </div>

                  {/* Today's tokens vs daily token budget */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Tokens/Min (current model)
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatNumber(stats.rate_limits?.tpm ?? 0)} TPM limit
                      </span>
                    </div>
                    <div className="intent-gauge">
                      <div className="intent-gauge-fill" style={{
                        width: '20%',
                        background: 'var(--accent-blue)',
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Avg {formatNumber(stats.avg_tokens_per_request)} tokens per request
                    </div>
                  </div>

                  {/* Total summary box */}
                  <div style={{
                    padding: 16, borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(99,102,241,0.06))',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Lifetime Requests</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatNumber(stats.total_requests)}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 14px', borderRadius: 20,
                        background: stats.total_cost_usd < 1 ? 'var(--accent-green-bg)' : 'var(--accent-yellow-bg)',
                        color: stats.total_cost_usd < 1 ? 'var(--accent-green)' : 'var(--accent-yellow)',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {formatCost(stats.total_cost_usd)} total
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── Logs Table ── */
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent API Requests</div>
                  <div className="card-subtitle">{logs.length} most recent calls</div>
                </div>
              </div>
              {logs.length === 0 ? (
                <div className="empty-state">
                  <h3>No requests logged yet</h3>
                  <p>API call logs will appear here once the AI agent handles conversations.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {['Time', 'Session', 'Model', 'Prompt', 'Completion', 'Total', 'Cost'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '10px 12px',
                            color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, i) => (
                        <tr
                          key={log.id || i}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatTime(log.created_at)}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <code style={{
                              fontSize: 11, padding: '2px 6px', borderRadius: 4,
                              background: 'var(--surface-hover)', color: 'var(--accent-primary)',
                            }}>
                              {log.session_id?.slice(0, 8)}...
                            </code>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            {log.model}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent-blue)' }}>
                            {formatNumber(log.prompt_tokens)}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                            {formatNumber(log.completion_tokens)}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatNumber(log.total_tokens)}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent-green)' }}>
                            {formatCost(log.cost_usd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
