import { useState, useEffect } from 'react'
import { useAuth, API_URL } from '../App'

export default function Team() {
  const { auth } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchTeam() }, [])

  const fetchTeam = async () => {
    try {
      const res = await fetch(`${API_URL}/team/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setMembers(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const generateInvite = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`${API_URL}/team/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setInviteCode(data.code)
      }
    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Manage your sales team members</p>
        </div>
        <button className="btn btn-primary" onClick={generateInvite} disabled={generating}>
          {generating ? 'Generating...' : '+ Invite Rep'}
        </button>
      </div>

      {/* Invite Code */}
      {inviteCode && (
        <div className="card" style={{ marginBottom: 24, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Invite Code Generated
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Share this code with your sales rep. They'll use it to join your org.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <code style={{
                fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)',
                background: 'var(--bg-input)', padding: '8px 16px',
                borderRadius: 'var(--radius-sm)', letterSpacing: 2,
              }}>
                {inviteCode}
              </code>
              <button className="btn btn-sm btn-secondary" onClick={copyInvite}>
                {copied ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><p>Loading team...</p></div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <h3>Just you here</h3>
            <p>Invite sales reps to your org so they can monitor and respond to leads.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Leads Assigned</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member: any) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: member.role === 'admin' ? 'var(--accent-gradient)' : 'rgba(99,102,241,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: 'white',
                        }}>
                          {(member.full_name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{member.full_name || 'Team Member'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{member.email || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: '3px 10px',
                        borderRadius: 10, textTransform: 'capitalize',
                        background: member.role === 'admin' ? 'rgba(139,92,246,0.1)' : 'rgba(99,102,241,0.1)',
                        color: member.role === 'admin' ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                      }}>
                        {member.role}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{member.leads_count || 0}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString()
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
