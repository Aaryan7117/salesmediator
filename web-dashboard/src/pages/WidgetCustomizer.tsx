import { useState } from 'react'
import { useAuth, API_URL } from '../App'

export default function WidgetCustomizer() {
  const { auth } = useAuth()
  const [config, setConfig] = useState({
    botName: 'AI Assistant',
    greeting: 'Hi! How can I help you today?',
    brandColor: '#6366f1',
    position: 'right',
  })
  const [copied, setCopied] = useState(false)

  const embedCode = `<script src="${API_URL}/widget/widget.js" data-org="${auth.orgSlug || 'your-slug'}" data-api="${API_URL}"></script>`

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Widget Customizer</h1>
        <p className="page-subtitle">Customize how your AI agent looks on your website</p>
      </div>

      <div className="grid-2">
        {/* Config Form */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 24 }}>Appearance</div>

          <div className="form-group">
            <label className="form-label">Bot Name</label>
            <input
              className="form-input"
              value={config.botName}
              onChange={e => setConfig({ ...config, botName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Greeting Message</label>
            <input
              className="form-input"
              value={config.greeting}
              onChange={e => setConfig({ ...config, greeting: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Brand Color</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="color"
                value={config.brandColor}
                onChange={e => setConfig({ ...config, brandColor: e.target.value })}
                style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}
              />
              <input
                className="form-input"
                value={config.brandColor}
                onChange={e => setConfig({ ...config, brandColor: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Position</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['left', 'right'].map(pos => (
                <button
                  key={pos}
                  className={`btn btn-sm ${config.position === pos ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setConfig({ ...config, position: pos })}
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
            Save Changes
          </button>
        </div>

        {/* Preview */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden', minHeight: 440 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Live Preview</div>

          {/* Mock website bg */}
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: 'var(--radius-md)',
            height: 360,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
          }}>
            {/* Fake website content */}
            <div style={{ padding: 24, opacity: 0.3 }}>
              <div style={{ width: '60%', height: 12, background: '#fff', borderRadius: 6, marginBottom: 16 }} />
              <div style={{ width: '80%', height: 8, background: '#fff', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: '70%', height: 8, background: '#fff', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: '50%', height: 8, background: '#fff', borderRadius: 4 }} />
            </div>

            {/* Preview widget */}
            <div style={{
              position: 'absolute',
              bottom: 16,
              [config.position]: 16,
            }}>
              {/* Chat panel preview */}
              <div style={{
                width: 280,
                background: 'white',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                marginBottom: 12,
              }}>
                <div style={{
                  background: config.brandColor,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'white',
                  }}>SG</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{config.botName}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Online</div>
                  </div>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{
                    background: '#f0f0f0',
                    borderRadius: '4px 12px 12px 12px',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#333',
                    lineHeight: 1.5,
                  }}>
                    {config.greeting}
                  </div>
                </div>
              </div>

              {/* FAB */}
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: config.brandColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 16px ${config.brandColor}66`,
                marginLeft: config.position === 'right' ? 'auto' : 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Embed Code</div>
            <div className="card-subtitle">Paste this on your website — that's it, your AI agent is live!</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={copyCode}>
            {copied ? '✓ Copied!' : 'Copy Code'}
          </button>
        </div>
        <pre style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: 16,
          fontSize: 13,
          color: 'var(--accent-primary)',
          overflowX: 'auto',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
        }}>
          {embedCode}
        </pre>
      </div>
    </div>
  )
}
