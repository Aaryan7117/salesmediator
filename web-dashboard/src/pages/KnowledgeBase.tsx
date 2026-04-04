import { useState, useEffect, useRef } from 'react'
import { useAuth, API_URL } from '../App'

export default function KnowledgeBase() {
  const { auth } = useAuth()
  
  // Doc Uploads
  const [docs, setDocs] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Structured Resources
  const [resources, setResources] = useState<any[]>([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [isAddingRes, setIsAddingRes] = useState(false)
  const [resForm, setResForm] = useState({ title: '', url: '', type: 'doc', description: '' })

  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  useEffect(() => { 
    fetchDocs()
    fetchResources()
  }, [])

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/kb/documents`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setDocs(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoadingDocs(false) }
  }

  const fetchResources = async () => {
    try {
      const res = await fetch(`${API_URL}/kb/resources`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) setResources(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoadingRes(false) }
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

  const handleDeleteDoc = async (docId: string) => {
    try {
      await fetch(`${API_URL}/kb/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      fetchDocs()
    } catch (err) { console.error(err) }
  }

  const handleAddResource = async () => {
    try {
      const res = await fetch(`${API_URL}/kb/resources`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${auth.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(resForm)
      })
      if (res.ok) {
        setIsAddingRes(false)
        setResForm({ title: '', url: '', type: 'doc', description: '' })
        fetchResources()
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteResource = async (resId: string) => {
    try {
      await fetch(`${API_URL}/kb/resources/${resId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      fetchResources()
    } catch (err) { console.error(err) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Knowledge Base</h1>
        <p className="page-subtitle">Manage learning material and structured resources for your AI agent</p>
      </div>

      <div className="grid-2">
        {/* Left Column: Documents for RAG */}
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Unstructured Uploads</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Upload product documentation. Your agent will pull quotes from here during chats.</p>
          
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: 32,
              marginBottom: 16,
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
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {uploading ? 'Uploading...' : 'Drop PDF or CSV files here'}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {loadingDocs ? (
              <div className="empty-state" style={{ padding: 32 }}><p>Loading...</p></div>
            ) : docs.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No documents uploaded</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {docs.map((doc: any) => (
                  <div key={doc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{doc.filename}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.chunk_count} chunks</div>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleDeleteDoc(doc.id)}
                      style={{ color: 'var(--accent-red)' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Structured Resources */}
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Structured Resources</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Links to specs, videos, or guides. Your agent sends these to unqualified buyers.</p>
          
          <div className="card" style={{ padding: 0 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Saved Resources</div>
                <button className="btn btn-sm btn-primary" onClick={() => setIsAddingRes(!isAddingRes)}>
                  {isAddingRes ? 'Cancel' : '+ Add Resource'}
                </button>
            </div>

            {isAddingRes && (
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <input className="form-input" placeholder="Title" value={resForm.title} onChange={e => setResForm({...resForm, title: e.target.value})} />
                  <select className="form-input" style={{ width: 120 }} value={resForm.type} onChange={e => setResForm({...resForm, type: e.target.value})}>
                    <option value="doc">Doc</option>
                    <option value="video">Video</option>
                    <option value="spec">Spec</option>
                    <option value="guide">Guide</option>
                  </select>
                </div>
                <input className="form-input" placeholder="URL" style={{ marginBottom: 12 }} value={resForm.url} onChange={e => setResForm({...resForm, url: e.target.value})} />
                <textarea className="form-input" placeholder="Description (optional)" style={{ marginBottom: 12 }} value={resForm.description} onChange={e => setResForm({...resForm, description: e.target.value})} />
                <button className="btn btn-primary btn-sm" disabled={!resForm.title || !resForm.url} onClick={handleAddResource}>Save Resource</button>
              </div>
            )}

            {loadingRes ? (
              <div className="empty-state" style={{ padding: 32 }}><p>Loading...</p></div>
            ) : resources.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No structured resources yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {resources.map((res: any) => (
                  <div key={res.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                         <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--border-subtle)', borderRadius: 4, textTransform: 'uppercase' }}>{res.type}</span>
                         {res.title}
                      </div>
                      <a href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent-primary)', display: 'block', marginTop: 4 }}>
                        {res.url}
                      </a>
                    </div>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleDeleteResource(res.id)}
                      style={{ color: 'var(--accent-red)' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    
    </div>
  )
}
