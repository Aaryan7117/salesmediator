import { useState, useEffect, useRef } from 'react'
import { useAuth, API_URL } from '../App'

interface KBResource {
  id: string
  title: string
  url: string
  type: string
  description: string
  created_at?: string
}

export default function KnowledgeBase() {
  const { auth } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Resource links state
  const [resources, setResources] = useState<KBResource[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingResource, setAddingResource] = useState(false)
  const [newResource, setNewResource] = useState({ title: '', url: '', type: 'video', description: '' })

  useEffect(() => { fetchDocs(); fetchResources() }, [])

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/kb/documents`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setDocs(await res.json())
      else console.error('fetchDocs failed:', res.status, await res.text())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const fetchResources = async () => {
    try {
      const res = await fetch(`${API_URL}/kb-resources/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setResources(await res.json())
    } catch (err) { console.error(err) }
    finally { setResourcesLoading(false) }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_URL}/kb/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
        body: formData,
      })
      if (res.ok) {
        fetchDocs()
        alert('✅ Document uploaded successfully!')
      } else {
        const errData = await res.text()
        console.error('Upload failed:', res.status, errData)
        alert(`❌ Upload failed: ${errData}`)
      }
    } catch (err) {
      console.error(err)
      alert(`❌ Upload error: ${err}`)
    }
    finally { setUploading(false) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      const res = await fetch(`${API_URL}/kb/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok || res.status === 204) {
        fetchDocs()
      } else {
        alert(`❌ Delete failed: ${await res.text()}`)
      }
    } catch (err) {
      console.error(err)
      alert(`❌ Delete error: ${err}`)
    }
  }

  const handleAddResource = async () => {
    if (!newResource.title.trim() || !newResource.url.trim()) return
    setAddingResource(true)
    try {
      const res = await fetch(`${API_URL}/kb-resources/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newResource),
      })
      if (res.ok) {
        fetchResources()
        setNewResource({ title: '', url: '', type: 'video', description: '' })
        setShowAddForm(false)
      }
    } catch (err) { console.error(err) }
    finally { setAddingResource(false) }
  }

  const handleDeleteResource = async (id: string) => {
    try {
      await fetch(`${API_URL}/kb-resources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      fetchResources()
    } catch (err) { console.error(err) }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥'
      case 'spec': return '📋'
      case 'guide': return '📖'
      case 'doc': return '📄'
      default: return '🔗'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'video': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' }
      case 'spec': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' }
      case 'guide': return { bg: 'rgba(34,197,94,0.1)', color: '#22c55e' }
      case 'doc': return { bg: 'rgba(168,85,247,0.1)', color: '#a855f7' }
      default: return { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' }
    }
  }

  const detectUrlType = (url: string): string => {
    if (url.match(/youtube|youtu\.be|vimeo|loom|\.mp4|\.webm/i)) return 'video'
    if (url.match(/\.pdf/i)) return 'doc'
    return 'video'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Knowledge Base</h1>
        <p className="page-subtitle">Upload product documents — your AI agent learns from these</p>
      </div>

      {/* Upload Zone */}
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: 48,
          marginBottom: 24,
          border: dragOver ? '2px dashed var(--accent-primary)' : '1px solid var(--border-subtle)',
          background: dragOver ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          hidden
          onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.6 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Supports PDF and CSV files. Your AI agent will learn from this content.
        </div>
      </div>

      {/* Documents List */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Uploaded Documents ({docs.length})</div>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: 32 }}><p>Loading...</p></div>
        ) : docs.length === 0 ? (
          <div className="empty-state">
            <h3>No documents yet</h3>
            <p>Upload your product documentation to teach your AI agent about your product.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map((doc: any) => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: 14,
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                background: 'rgba(17,24,39,0.3)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: doc.file_type === 'pdf' ? 'var(--accent-red-bg)' : 'var(--accent-green-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  color: doc.file_type === 'pdf' ? 'var(--accent-red)' : 'var(--accent-green)',
                }}>
                  {doc.file_type?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.filename}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {doc.chunk_count} chunks · Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'recently'}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleDelete(doc.id)}
                  style={{ color: 'var(--accent-red)' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ VIDEO & RESOURCE LINKS ═══════════ */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">🎥 Video & Resource Links ({resources.length})</div>
            <div className="card-subtitle">
              Add video links (YouTube, Google Drive, Loom) — shown directly in the chat widget
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Link'}
          </button>
        </div>

        {/* Add Resource Form */}
        {showAddForm && (
          <div style={{
            padding: 20, marginBottom: 16,
            background: 'rgba(99,102,241,0.04)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
              <input
                className="form-input"
                placeholder="Title — e.g. Product Demo Video"
                value={newResource.title}
                onChange={e => setNewResource({ ...newResource, title: e.target.value })}
              />
              <select
                className="form-input"
                value={newResource.type}
                onChange={e => setNewResource({ ...newResource, type: e.target.value })}
                style={{ cursor: 'pointer' }}
              >
                <option value="video">🎥 Video</option>
                <option value="spec">📋 Spec</option>
                <option value="doc">📄 Doc</option>
                <option value="guide">📖 Guide</option>
              </select>
            </div>
            <input
              className="form-input"
              placeholder="Paste URL — YouTube, Google Drive, Loom, Dropbox, or direct .mp4 link"
              value={newResource.url}
              onChange={e => {
                const url = e.target.value
                setNewResource({
                  ...newResource,
                  url,
                  type: newResource.type === 'video' ? detectUrlType(url) : newResource.type,
                })
              }}
              style={{ marginBottom: 12 }}
            />
            <input
              className="form-input"
              placeholder="Description (optional) — e.g. 2-minute walkthrough of our dashboard"
              value={newResource.description}
              onChange={e => setNewResource({ ...newResource, description: e.target.value })}
              style={{ marginBottom: 16 }}
            />

            {/* URL format hints */}
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', marginBottom: 16,
              display: 'flex', flexWrap: 'wrap', gap: 12,
            }}>
              <span>✅ youtube.com/watch?v=...</span>
              <span>✅ drive.google.com/file/d/.../view</span>
              <span>✅ loom.com/share/...</span>
              <span>✅ dropbox.com/...</span>
              <span>✅ .mp4 / .webm links</span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleAddResource}
              disabled={addingResource || !newResource.title.trim() || !newResource.url.trim()}
            >
              {addingResource ? 'Adding...' : '🔗 Add Resource Link'}
            </button>
          </div>
        )}

        {/* Resources List */}
        {resourcesLoading ? (
          <div className="empty-state" style={{ padding: 32 }}><p>Loading...</p></div>
        ) : resources.length === 0 ? (
          <div className="empty-state">
            <h3>No resource links yet</h3>
            <p>Add video or document links that your AI can share with visitors in the chat widget.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resources.map(r => {
              const typeStyle = getTypeColor(r.type)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: 14,
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                  background: 'rgba(17,24,39,0.3)', transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 'var(--radius-sm)',
                    background: typeStyle.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {getTypeIcon(r.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.title}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.url}
                    </div>
                    {r.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {r.description}
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 20, background: typeStyle.bg, color: typeStyle.color,
                    textTransform: 'uppercase',
                  }}>
                    {r.type}
                  </span>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleDeleteResource(r.id)}
                    style={{ color: 'var(--accent-red)' }}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Test KB */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Test Your KB</div>
            <div className="card-subtitle">Ask a question to see what your AI would retrieve</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-input"
            placeholder="e.g. What does your product cost?"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && testQuery && setTestResult({
              title: 'Search result will show here',
              excerpt: 'This feature connects to the /chat endpoint to test KB retrieval.',
              relevance_score: 0,
            })}
          />
          <button className="btn btn-primary" onClick={() => testQuery && setTestResult({
            title: 'KB Test',
            excerpt: 'Connect this to the backend KB test endpoint for live results.',
            relevance_score: 85,
          })}>
            Test
          </button>
        </div>
        {testResult && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 'var(--radius-md)',
            background: 'rgba(99,102,241,0.06)', border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{testResult.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{testResult.excerpt}</div>
            <div style={{ fontSize: 12, color: 'var(--accent-primary)', marginTop: 8 }}>
              Relevance: {testResult.relevance_score}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
