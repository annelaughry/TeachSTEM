import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

const CATEGORIES = [
  { value: 'general', label: 'General Discussion', badge: 'badge--gray' },
  { value: 'question', label: 'Question', badge: 'badge--pink' },
  { value: 'resource', label: 'Resource Share', badge: 'badge--teal' },
  { value: 'announcement', label: 'Announcement', badge: 'badge--orange' },
]
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ForumThreadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [thread, setThread] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editingThread, setEditingThread] = useState(false)
  const [threadForm, setThreadForm] = useState({ title: '', category: 'general', body: '' })
  const [savingThread, setSavingThread] = useState(false)

  const [replyBody, setReplyBody] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [editingReplyId, setEditingReplyId] = useState(null)
  const [editingReplyBody, setEditingReplyBody] = useState('')

  const load = () => {
    setLoading(true)
    api.get(`forum/threads/${id}/`)
      .then(r => setThread(r.data))
      .catch(() => setError('Could not load this thread.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const startEditThread = () => {
    setThreadForm({ title: thread.title, category: thread.category, body: thread.body || '' })
    setEditingThread(true)
  }

  const saveThread = async e => {
    e.preventDefault()
    if (!threadForm.title.trim()) return
    setSavingThread(true)
    try {
      const { data } = await api.put(`forum/threads/${id}/`, threadForm)
      setThread(data)
      setEditingThread(false)
    } finally {
      setSavingThread(false)
    }
  }

  const deleteThread = async () => {
    if (!window.confirm('Delete this thread and all its replies?')) return
    await api.delete(`forum/threads/${id}/`)
    navigate('/teacher/forum')
  }

  const submitReply = async e => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSubmittingReply(true)
    try {
      await api.post(`forum/threads/${id}/replies/`, { body: replyBody })
      setReplyBody('')
      load()
    } finally {
      setSubmittingReply(false)
    }
  }

  const startEditReply = (reply) => {
    setEditingReplyId(reply.id)
    setEditingReplyBody(reply.body)
  }

  const saveReply = async (replyId) => {
    if (!editingReplyBody.trim()) return
    await api.put(`forum/replies/${replyId}/`, { body: editingReplyBody })
    setEditingReplyId(null)
    load()
  }

  const deleteReply = async (replyId) => {
    if (!window.confirm('Delete this reply?')) return
    await api.delete(`forum/replies/${replyId}/`)
    load()
  }

  if (loading) return <div className="spinner">Loading…</div>
  if (error || !thread) return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div className="form-error">{error || 'Thread not found.'}</div>
      <Link to="/teacher/forum" className="btn btn--outline" style={{ marginTop: '1rem' }}>← Back to Forum</Link>
    </div>
  )

  const cat = CATEGORY_MAP[thread.category] || CATEGORIES[0]

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <div style={{ marginBottom: '0.35rem' }}>
          <Link to="/teacher/forum" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}>
            ← Teacher Forum
          </Link>
        </div>
        <h1 style={{ fontSize: '1.7rem' }}>{thread.title}</h1>
      </div>

      <div className="container" style={{ maxWidth: 760, paddingBottom: '3rem' }}>

        {/* Thread body */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          {editingThread ? (
            <form onSubmit={saveThread}>
              <input className="form-input" style={{ marginBottom: '0.6rem' }}
                value={threadForm.title} onChange={e => setThreadForm(f => ({ ...f, title: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                {CATEGORIES.map(c => (
                  <button key={c.value} type="button" onClick={() => setThreadForm(f => ({ ...f, category: c.value }))}
                    className={`badge ${c.badge}`}
                    style={{ border: threadForm.category === c.value ? '2px solid currentColor' : '2px solid transparent', cursor: 'pointer' }}>
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea className="form-input" rows={4} style={{ marginBottom: '0.6rem' }}
                value={threadForm.body} onChange={e => setThreadForm(f => ({ ...f, body: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn--primary btn--sm" disabled={savingThread}>
                  {savingThread ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingThread(false)} className="btn btn--outline btn--sm">Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${cat.badge}`}>{cat.label}</span>
                  <span className="text-muted text-sm">by {thread.author_name} · {formatDate(thread.created_at)}</span>
                </div>
                {(thread.is_own || isAdmin) && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    {thread.is_own && (
                      <button onClick={startEditThread} className="btn btn--outline btn--sm">Edit</button>
                    )}
                    <button onClick={deleteThread} className="btn btn--danger btn--sm">Delete</button>
                  </div>
                )}
              </div>
              {thread.body && (
                <p style={{ whiteSpace: 'pre-wrap', color: '#333', lineHeight: 1.7 }}>{thread.body}</p>
              )}
            </>
          )}
        </div>

        {/* Replies */}
        <div className="section-title">
          {thread.replies.length} Repl{thread.replies.length !== 1 ? 'ies' : 'y'}
        </div>
        {thread.replies.map(r => (
          <div key={r.id} className="card" style={{ marginBottom: '0.6rem' }}>
            {editingReplyId === r.id ? (
              <div>
                <textarea className="form-input" rows={3} style={{ marginBottom: '0.5rem' }}
                  value={editingReplyBody} onChange={e => setEditingReplyBody(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => saveReply(r.id)} className="btn btn--primary btn--sm">Save</button>
                  <button onClick={() => setEditingReplyId(null)} className="btn btn--outline btn--sm">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.4rem' }}>
                  <span className="text-muted text-sm">{r.author_name} · {formatDate(r.created_at)}</span>
                  {(r.is_own || isAdmin) && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      {r.is_own && (
                        <button onClick={() => startEditReply(r)} className="btn btn--outline btn--sm" style={{ padding: '0.15rem 0.55rem', fontSize: '0.78rem' }}>Edit</button>
                      )}
                      <button onClick={() => deleteReply(r.id)} className="btn btn--danger btn--sm" style={{ padding: '0.15rem 0.55rem', fontSize: '0.78rem' }}>Delete</button>
                    </div>
                  )}
                </div>
                <p style={{ whiteSpace: 'pre-wrap', color: '#333', margin: 0 }}>{r.body}</p>
              </>
            )}
          </div>
        ))}

        {/* Reply form */}
        <form onSubmit={submitReply} className="card" style={{ marginTop: '1.25rem' }}>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Write a reply…"
            value={replyBody}
            onChange={e => setReplyBody(e.target.value)}
            style={{ marginBottom: '0.6rem' }}
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={submittingReply}>
            {submittingReply ? 'Posting…' : 'Post Reply'}
          </button>
        </form>
      </div>
    </div>
  )
}
