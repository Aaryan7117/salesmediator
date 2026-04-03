import { useState, useEffect } from 'react'
import { useAuth, API_URL } from '../App'

export default function Integrations() {
  const { auth } = useAuth()
  const [config, setConfig] = useState({
    calendly_link: '',
    slack_webhook: '',
    webhook_url: '',
  })
  const [saved, setSaved] = useState(false)
  
  useEffect(() => { fetchIntegrations() }, [])

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`${API_URL}/integrations/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConfig({
          calendly_link: data.calendly_link || '',
          slack_webhook: '',
          webhook_url: '',
        })
      }
    } catch (err) { console.error(err) }
  }

  const handleSave = async () => {
    try {
      await fetch(`${API_URL}/integrations/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          calendly_link: config.calendly_link || null,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) { console.error(err) }
  }

  const integrations = [
    {
      name: 'Calendly',
      description: 'Show a booking link when a buyer reaches Decision-Ready intent. The AI agent will suppress this until the right moment.',
      icon: '📅',
      color: 'var(--accent-blue)',
      bg: 'var(--accent-blue-bg)',
      field: 'calendly_link',
      placeholder: 'https://calendly.com/your-team/30min',
    },
    {
      name: 'Slack Notifications',
      description: 'Get instant Slack alerts when a hot lead is detected. Never miss a high-intent buyer again.',
      icon: '💬',
      color: 'var(--accent-yellow)',
      bg: 'var(--accent-yellow-bg)',
      field: 'slack_webhook',
      placeholder: 'https://hooks.slack.com/services/...',
    },
    {
      name: 'Custom Webhook',
      description: 'Fire a POST request to any URL when a lead hits Decision-Ready. Connect to Zapier, Make, HubSpot, or any CRM.',
      icon: '🔗',
      color: 'var(--accent-secondary)',
      bg: 'rgba(139,92,246,0.1)',
      field: 'webhook_url',
      placeholder: 'https://hooks.zapier.com/...',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Integrations</h1>
        <p className="page-subtitle">Connect your AI agent to your existing tools</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {integrations.map(int => (
          <div key={int.name} className="card">
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: int.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>
                {int.icon}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {int.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {int.description}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                className="form-input"
                placeholder={int.placeholder}
                value={(config as any)[int.field] || ''}
                onChange={e => setConfig({ ...config, [int.field]: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Integrations'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Integrations trigger automatically when a lead hits Decision-Ready (score ≥ 76)
        </span>
      </div>
    </div>
  )
}
