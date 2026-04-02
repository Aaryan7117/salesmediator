import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

/**
 * Onboarding — shown right after signup.
 * Steps: Upload KB → Get embed code → Done
 */
export default function Onboarding() {
  const { auth } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [copied, setCopied] = useState(false)

  const embedCode = `<script src="https://cdn.salesgen.com/widget.js" data-org="${auth.orgSlug || 'your-slug'}"></script>`

  const copyCode = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = [
    { num: 1, label: 'Upload Docs' },
    { num: 2, label: 'Get Embed Code' },
    { num: 3, label: 'You\'re Live!' },
  ]

  return (
    <div className="auth-page" style={{ flexDirection: 'column', gap: 32 }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {steps.map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: step >= s.num ? 'var(--accent-gradient)' : 'var(--bg-card)',
              border: step >= s.num ? 'none' : '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: step >= s.num ? 'white' : 'var(--text-muted)',
              transition: 'all 0.3s',
            }}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)',
            }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{
                width: 40, height: 2, borderRadius: 1,
                background: step > s.num ? 'var(--accent-primary)' : 'var(--border-subtle)',
                margin: '0 4px',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="auth-card animate-fade-in" style={{ maxWidth: 520 }} key={step}>
        {step === 1 && (
          <>
            <h1 className="auth-title" style={{ marginBottom: 8 }}>Upload your product docs</h1>
            <p className="auth-subtitle">
              Your AI agent learns from these. Upload PDFs or CSVs with product info, pricing, FAQs — anything a buyer might ask about.
            </p>

            <div
              style={{
                border: '2px dashed var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 40,
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 24,
                transition: 'all 0.2s',
              }}
              onClick={() => {/* File upload - connected after backend setup */}}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.6 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Drop PDF or CSV here
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                or click to browse
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(2)}>
                Skip for now
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="auth-title" style={{ marginBottom: 8 }}>Add this to your website</h1>
            <p className="auth-subtitle">
              Paste this one line of code anywhere on your site. Your AI sales agent will appear instantly.
            </p>

            <pre style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 20,
              fontSize: 13,
              color: 'var(--accent-primary)',
              overflowX: 'auto',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              marginBottom: 20,
              lineHeight: 1.6,
            }}>
              {embedCode}
            </pre>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={copyCode}
            >
              {copied ? '✓ Copied to clipboard!' : 'Copy Embed Code'}
            </button>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={() => setStep(3)}
            >
              I've added it →
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🚀</div>
              <h1 className="auth-title">You're all set!</h1>
              <p className="auth-subtitle" style={{ marginBottom: 0 }}>
                Your AI sales agent is now live. It'll handle inbound leads 24/7, score their intent, and notify you when someone's ready to buy.
              </p>
            </div>

            <div style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent-green)' }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)' }}>AI agent deployed on your website</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent-green)' }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Real-time intent scoring active</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent-green)' }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Leads will appear in your dashboard</span>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
