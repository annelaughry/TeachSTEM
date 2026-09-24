import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const CATEGORIES = [
  { value: 'general', label: 'General Discussion', badge: 'badge--gray' },
  { value: 'question', label: 'Question', badge: 'badge--pink' },
  { value: 'resource', label: 'Resource Share', badge: 'badge--teal' },
  { value: 'announcement', label: 'Announcement', badge: 'badge--orange' },
]
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]))

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ForumList() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'general', body: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = (cat) => {
    setLoading(true)
    api.get('forum/threads/', { params: cat ? { category: cat } : {} })
      .then(r => setThreads(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(category) }, [category])

  const submitThread = async e => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) { setError('Please enter a title.'); return }
    setSubmitting(true)
    try {
      await api.post('forum/threads/', form)
      setForm({ title: '', category: 'general', body: '' })
      setShowForm(false)
      load(category)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>Teacher Forum</h1>
        <p>Ask questions, share resources, and discuss ideas with other teachers.</p>
        <div style={{ marginTop: '1.25rem' }}>
          <button onClick={() => setShowForm(s => !s)} className="btn btn--primary" style={{ background: '#fff', color: 'var(--pink)', fontWeight: 800 }}>
            {showForm ? 'Cancel' : '+ New Thread'}
          </button>
        </div>
      </div>

      <div className="container">

        {showForm && (
          <form onSubmit={submitThread} className="card" style={{ marginBottom: '1.5rem' }}>
            <input
              className="form-input"
              placeholder="Thread title…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{ marginBottom: '0.6rem' }}
            />
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`badge ${c.badge}`}
                  style={{ border: form.category === c.value ? '2px solid currentColor' : '2px solid transparent', cursor: 'pointer' }}>
                  {c.label}
                </button>
              ))}
            </div>
            <textarea
              className="form-input"
              rows={3}
              placeholder="What's on your mind? (optional)"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              style={{ marginBottom: '0.6rem' }}
            />
            {error && <p style={{ color: 'var(--red, #c62828)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>{error}</p>}
            <button type="submit" className="btn btn--primary btn--sm" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post Thread'}
            </button>
          </form>
        )}

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button onClick={() => setCategory('')} className="btn btn--sm" style={{
            background: category === '' ? 'var(--pink)' : '#f5f5f5',
            color: category === '' ? '#fff' : 'var(--text-muted)',
            border: 'none', fontWeight: 700,
          }}>All</button>
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)} className="btn btn--sm" style={{
              background: category === c.value ? 'var(--pink)' : '#f5f5f5',
              color: category === c.value ? '#fff' : 'var(--text-muted)',
              border: 'none', fontWeight: 700,
            }}>{c.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="spinner">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="empty"><p>No threads yet. Start the conversation!</p></div>
        ) : (
          threads.map(t => {
            const cat = CATEGORY_MAP[t.category] || CATEGORIES[0]
            return (
              <Link to={`/teacher/forum/${t.id}`} key={t.id} className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', textDecoration: 'none', color: 'inherit', marginBottom: '0.6rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${cat.badge}`}>{cat.label}</span>
                    {t.is_own && <span className="badge badge--gray">Yours</span>}
                  </div>
                  <h3 className="truncate" style={{ color: 'var(--text)' }}>{t.title}</h3>
                  <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
                    by {t.author_name} · {timeAgo(t.updated_at)}
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--pink)' }}>{t.reply_count}</div>
                  <div className="text-muted text-sm">repl{t.reply_count !== 1 ? 'ies' : 'y'}</div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
