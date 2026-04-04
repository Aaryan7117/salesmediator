import { useState, useEffect } from 'react'
import { useAuth, API_URL } from '../App'

const ALL_FIELDS = [
  { key: 'name', label: 'Name', icon: '👤', description: 'Visitor\'s full name' },
  { key: 'company', label: 'Company', icon: '🏢', description: 'Company or organisation name' },
  { key: 'role', label: 'Role', icon: '💼', description: 'Job title or role' },
  { key: 'use_case', label: 'Use Case', icon: '🎯', description: 'What they need the product for' },
  { key: 'company_size', label: 'Company Size', icon: '📊', description: 'Number of employees or seats', numeric: true },
  { key: 'timeline', label: 'Timeline', icon: '⏰', description: 'When they need it implemented', numeric: false },
]

const OPERATORS = [
  { value: '>=', label: '≥ (at least)' },
  { value: '<=', label: '≤ (at most)' },
  { value: '>', label: '> (more than)' },
  { value: '<', label: '< (less than)' },
  { value: '==', label: '= (exactly)' },
]

const CONDITION_FIELDS = [
  { value: 'company_size', label: 'Company Size' },
  { value: 'timeline_months', label: 'Timeline (months)' },
]

interface Condition {
  field: string
  op: string
  value: number
}

export default function QualificationSettings() {
  const { auth } = useAuth()
  const [requiredFields, setRequiredFields] = useState<string[]>(['name', 'company', 'role', 'use_case'])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/qualification-settings/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRequiredFields(data.required_fields || ['name', 'company', 'role', 'use_case'])
        setConditions(data.conditions || [])
        setIsCustom(data.is_custom || false)
      }
    } catch (err) {
      console.error('Failed to fetch qualification settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleField = (field: string) => {
    setRequiredFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    )
  }

  const addCondition = () => {
    setConditions(prev => [...prev, { field: 'company_size', op: '>=', value: 50 }])
  }

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (requiredFields.length === 0) {
      setError('At least one required field must be selected.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/qualification-settings/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ required_fields: requiredFields, conditions }),
      })
      if (res.ok) {
        setSaved(true)
        setIsCustom(true)
        setTimeout(() => setSaved(false), 2500)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to save.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Qualification Settings</h1>
        <p className="page-subtitle">
          Configure what criteria a lead must meet to be marked as <strong>Qualified</strong>
        </p>
      </div>

      {/* Status Banner */}
      <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid ${isCustom ? 'var(--accent-primary)' : 'var(--accent-yellow)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{isCustom ? '✅' : '⚠️'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {isCustom ? 'Custom criteria active' : 'Using default criteria'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isCustom
                ? `${requiredFields.length} required fields, ${conditions.length} condition${conditions.length !== 1 ? 's' : ''}`
                : 'Configure your own criteria below and save to activate'}
            </div>
          </div>
        </div>
      </div>

      {/* Required Fields */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Required Fields
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            The AI agent will ask for these fields during conversation. A lead stays "Collecting" until all are provided.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {ALL_FIELDS.map(field => {
            const isActive = requiredFields.includes(field.key)
            return (
              <div
                key={field.key}
                onClick={() => toggleField(field.key)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isActive ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--glass-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `2px solid ${isActive ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                  background: isActive ? 'var(--accent-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', flexShrink: 0,
                }}>
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                <span style={{ fontSize: 18, flexShrink: 0 }}>{field.icon}</span>

                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {field.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {field.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Numeric Conditions */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Numeric Conditions
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Optional thresholds. If a lead fails any condition, they're marked "Unqualified".
            </p>
          </div>
          <button className="btn btn-secondary" onClick={addCondition} style={{ fontSize: 13 }}>
            + Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div style={{
            padding: '32px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)',
            border: '1px dashed var(--glass-border)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}>
            No numeric conditions set. Leads will qualify once all required fields are collected.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conditions.map((cond, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}>
                {/* Field */}
                <select
                  className="form-input"
                  style={{ flex: 1, fontSize: 13 }}
                  value={cond.field}
                  onChange={e => updateCondition(i, { field: e.target.value })}
                >
                  {CONDITION_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  className="form-input"
                  style={{ width: 130, fontSize: 13 }}
                  value={cond.op}
                  onChange={e => updateCondition(i, { op: e.target.value })}
                >
                  {OPERATORS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Value */}
                <input
                  className="form-input"
                  type="number"
                  style={{ width: 100, fontSize: 13 }}
                  value={cond.value}
                  onChange={e => updateCondition(i, { value: parseInt(e.target.value) || 0 })}
                  min={0}
                />

                {/* Remove */}
                <button
                  onClick={() => removeCondition(i)}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(239,68,68,0.1)', border: 'none',
                    color: '#ef4444', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="card" style={{ marginBottom: 24, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>
          Preview — When is a lead qualified?
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {requiredFields.length > 0 && (
            <div>
              ✅ Must provide: <strong>{requiredFields.map(f => ALL_FIELDS.find(af => af.key === f)?.label || f).join(', ')}</strong>
            </div>
          )}
          {conditions.map((c, i) => (
            <div key={i}>
              📏 {CONDITION_FIELDS.find(f => f.value === c.field)?.label || c.field} must be {OPERATORS.find(o => o.value === c.op)?.label || c.op} <strong>{c.value}</strong>
            </div>
          ))}
          {requiredFields.length === 0 && conditions.length === 0 && (
            <div style={{ color: 'var(--text-muted)' }}>No criteria configured — select at least one field above.</div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Save */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 180 }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Criteria'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Changes apply to all new conversations immediately
        </span>
      </div>
    </div>
  )
}
