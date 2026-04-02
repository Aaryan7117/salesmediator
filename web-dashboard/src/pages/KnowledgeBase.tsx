import { useState, useEffect, useRef } from 'react'
import { useAuth, API_URL } from '../App'

export default function KnowledgeBase() {
  const { auth } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchDocs() }, [])

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/kb/`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setDocs(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
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
      if (res.ok) { fetchDocs() }
    } catch (err) { console.error(err) }
    finally { setUploading(false) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleDelete = async (docId: string) => {
    try {
      await fetch(`${API_URL}/kb/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      fetchDocs()
    } catch (err) { console.error(err) }
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
