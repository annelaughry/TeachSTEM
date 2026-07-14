import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function ModuleBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [allActivities, setAllActivities] = useState([])
  const [sequence, setSequence] = useState([])   // { id, title, activity_type }
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    const reqs = [api.get('activities/')]
    if (isEdit) reqs.push(api.get(`modules/${id}/`))
    Promise.all(reqs).then(([a, m]) => {
      setAllActivities(a.data)
      if (m) {
        setTitle(m.data.title)
        setDescription(m.data.description || '')
        setSequence(m.data.module_activities.map(ma => ({
          id: ma.activity.id,
          title: ma.activity.title,
          activity_type: ma.activity.activity_type,
        })))
      }
    }).finally(() => setLoading(false))
  }, [id])

  const inSequence = new Set(sequence.map(a => a.id))

  const addActivity = (act) => {
    if (inSequence.has(act.id)) return
    setSequence(s => [...s, { id: act.id, title: act.title, activity_type: act.activity_type }])
  }

  const remove = (idx) => setSequence(s => s.filter((_, i) => i !== idx))

  const moveUp = (idx) => {
    if (idx === 0) return
    setSequence(s => { const n = [...s]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })
  }

  const moveDown = (idx) => {
    setSequence(s => { if (idx >= s.length - 1) return s; const n = [...s]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })
  }

  const filtered = allActivities.filter(a =>
    `${a.title} ${a.activity_type} ${a.grade_levels?.map(g => g.name).join(' ')}`.toLowerCase().includes(search.toLowerCase())
  )

  const save = async () => {
    if (!title.trim()) { setError('Module title is required.'); return }
    if (sequence.length === 0) { setError('Add at least one activity.'); return }
    setError(''); setSaving(true)
    try {
      const payload = { title: title.trim(), description, activity_ids: sequence.map(a => a.id) }
      const { data } = isEdit
        ? await api.put(`modules/${id}/`, payload)
        : await api.post('modules/', payload)
      navigate(`/teacher/module/${data.id}`)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner">Loading…</div>

  return (
    <div className="page">
      <div style={{ background: 'var(--pink)', padding: '1rem 1.5rem', marginTop: 'var(--nav-h)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to={isEdit ? `/teacher/module/${id}` : '/teacher/modules'} style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
          ← {isEdit ? 'Back' : 'My Modules'}
        </Link>
        <h2 style={{ color: 'white', margin: 0, flex: 1 }}>{isEdit ? 'Edit Module' : 'New Module'}</h2>
        <button onClick={save} className="btn btn--teal" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Module'}
        </button>
      </div>

      <div className="container container--wide" style={{ paddingTop: '1.5rem' }}>
        {error && <div className="form-error">{error}</div>}

        {/* Title + description */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Module title *</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="e.g. Introduction to the Scientific Method" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Description <span className="optional">(optional)</span></label>
            <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        {/* Two-column builder */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

          {/* Library */}
          <div style={{ flex: '1 1 55%', minWidth: 0 }}>
            <div className="card">
              <h3 style={{ color: 'var(--pink)', marginBottom: '0.75rem' }}>Activity Library</h3>
              <input className="form-input" placeholder="Search by title, type, or grade…" value={search}
                     onChange={e => setSearch(e.target.value)} style={{ marginBottom: '0.75rem' }} />
              <div style={{ maxHeight: 480, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {filtered.length === 0 && <p className="text-muted" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>No activities match.</p>}
                {filtered.map(act => {
                  const added = inSequence.has(act.id)
                  return (
                    <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: added ? '#f0faf0' : '#fafafa', border: `1px solid ${added ? '#c8e6c9' : 'var(--border)'}`, borderRadius: 7, padding: '0.6rem 0.85rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.93rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.title}</div>
                        <div className="text-sm text-muted">
                          {act.activity_type?.replace('_', ' ')}
                          {act.grade_levels?.map(g => <span key={g.id}> · {g.name}</span>)}
                        </div>
                      </div>
                      <button onClick={() => addActivity(act)} disabled={added}
                              className="btn btn--sm"
                              style={{ flexShrink: 0, background: added ? 'transparent' : 'var(--pink)', color: added ? '#2e7d32' : 'white', border: added ? '1px solid #c8e6c9' : 'none', cursor: added ? 'default' : 'pointer' }}>
                        {added ? 'Added' : 'Add →'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sequence */}
          <div style={{ flex: '0 0 320px', width: 320, position: 'sticky', top: 90 }}>
            <div className="card">
              <h3 style={{ color: 'var(--teal)', marginBottom: '0.75rem' }}>Module Sequence</h3>
              {sequence.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '1.5rem 0.5rem', fontStyle: 'italic' }}>
                  No activities added yet.<br />Pick from the library.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {sequence.map((act, i) => (
                    <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa', border: '1px solid var(--border)', borderRadius: 7, padding: '0.5rem 0.65rem' }}>
                      <span style={{ fontWeight: 900, color: 'var(--pink)', minWidth: '1.8rem', textAlign: 'right', fontSize: '0.9rem' }}>{i + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.title}</div>
                        <div className="text-sm text-muted">{act.activity_type?.replace('_', ' ')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                        <button onClick={() => moveUp(i)} className="btn btn--ghost btn--sm" style={{ padding: '2px 6px' }}>↑</button>
                        <button onClick={() => moveDown(i)} className="btn btn--ghost btn--sm" style={{ padding: '2px 6px' }}>↓</button>
                        <button onClick={() => remove(i)} className="btn btn--danger btn--sm" style={{ padding: '2px 6px' }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={save} className="btn btn--primary w-full" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
