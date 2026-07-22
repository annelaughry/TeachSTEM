import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ThreeTwoOneList() {
  const { user } = useAuth()
  const isAdmin = user?.is_staff || user?.is_superuser

  const [assignments, setAssignments] = useState([])
  const [classrooms, setClassrooms]   = useState([])
  const [activities, setActivities]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [creating, setCreating]       = useState(false)
  const [createError, setCreateError] = useState('')

  const [form, setForm] = useState({
    title: '',
    activity: '',
    classrooms: [],
    response_type: 'written',
  })

  useEffect(() => {
    Promise.all([
      api.get('321/assignments/'),
      api.get('classrooms/'),
      api.get('activities/'),
    ]).then(([a, c, act]) => {
      setAssignments(a.data)
      setClassrooms(c.data)
      setActivities(act.data.filter(a => a.status === 'approved'))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleClassroom = (id) => {
    setForm(f => ({
      ...f,
      classrooms: f.classrooms.includes(id)
        ? f.classrooms.filter(c => c !== id)
        : [...f.classrooms, id],
    }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    if (form.classrooms.length === 0) {
      setCreateError('Select at least one classroom.')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('321/assignments/', {
        title: form.title,
        activity: form.activity || null,
        classrooms: form.classrooms,
        response_type: form.response_type,
      })
      setAssignments(prev => [data, ...prev])
      setForm({ title: '', activity: '', classrooms: [], response_type: 'written' })
    } catch {
      setCreateError('Failed to create assignment.')
    } finally {
      setCreating(false)
    }
  }

  const changeResponseType = async (assignment, newType) => {
    try {
      const { data } = await api.patch(`321/assignments/${assignment.id}/`, { response_type: newType })
      setAssignments(prev => prev.map(a => a.id === data.id ? data : a))
    } catch {}
  }

  const toggleOpen = async (assignment) => {
    try {
      const { data } = await api.patch(`321/assignments/${assignment.id}/`, {
        is_open: !assignment.is_open,
      })
      setAssignments(prev => prev.map(a => a.id === data.id ? data : a))
    } catch {}
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return
    try {
      await api.delete(`321/assignments/${id}/`)
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  if (loading) return <div className="page"><div className="container" style={{ marginTop: 80 }}>Loading...</div></div>

  const myClassrooms = isAdmin ? classrooms : classrooms.filter(c => c.teacher === user?.id || true)

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>3-2-1 Formative Assessments</h1>
        <p>Create quick exit tickets for students after activities.</p>
      </div>

      <div className="container" style={{ maxWidth: 860, paddingBottom: '3rem' }}>

        {/* Create form */}
        <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '1.25rem', fontSize: '1.05rem' }}>New Assignment</h2>
          <form onSubmit={handleCreate}>
            <div className="grid-2" style={{ marginBottom: '1rem' }}>
              <div>
                <label className="label">Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="input"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Activity <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <select
                  className="input"
                  value={form.activity}
                  onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
                >
                  <option value="">-- Not linked to an activity --</option>
                  {activities.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Response Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['written', 'video'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, response_type: type }))}
                    style={{
                      padding: '0.4rem 1.1rem',
                      borderRadius: 20,
                      border: `2px solid ${form.response_type === type ? 'var(--teal-dark)' : 'var(--border)'}`,
                      background: form.response_type === type ? 'var(--teal-dark)' : '#fff',
                      color: form.response_type === type ? '#fff' : 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      transition: 'all 0.12s',
                    }}
                  >
                    {type === 'written' ? 'Written' : 'Short Video'}
                  </button>
                ))}
              </div>
              <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '0.35rem', marginBottom: 0 }}>
                {form.response_type === 'video'
                  ? 'Students upload a short video response covering all three parts.'
                  : 'Students type their responses in text fields.'}
              </p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Assign to Classrooms <span style={{ color: '#c62828', fontWeight: 600 }}>*</span></label>
              {classrooms.length === 0 ? (
                <p className="text-muted text-sm">No classrooms found. <Link to="/teacher">Create one first.</Link></p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {classrooms.map(c => {
                    const selected = form.classrooms.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClassroom(c.id)}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: 20,
                          border: `2px solid ${selected ? 'var(--teal-dark)' : 'var(--border)'}`,
                          background: selected ? 'var(--teal-dark)' : '#fff',
                          color: selected ? '#fff' : 'var(--text)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          transition: 'all 0.12s',
                        }}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {createError && (
              <p style={{ color: '#c62828', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{createError}</p>
            )}

            <button type="submit" disabled={creating} className="btn btn--primary">
              {creating ? 'Creating...' : 'Create Assignment'}
            </button>
          </form>
        </div>

        {/* Assignment list */}
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '1rem', fontSize: '1.05rem' }}>
            {isAdmin ? 'All Assignments' : 'Your Assignments'}
          </h2>

          {assignments.length === 0 && (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No assignments yet.</p></div>
          )}

          {assignments.map(a => (
            <div key={a.id} className="card" style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${a.is_open ? 'var(--teal)' : '#ccc'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.2rem' }}>
                    {a.title || (a.activity_title ? `After: ${a.activity_title}` : '3-2-1 Assessment')}
                  </div>
                  {a.activity_title && (
                    <p className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>Activity: {a.activity_title}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: a.is_open ? 'var(--teal-dark)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {a.is_open ? 'Open' : 'Closed'}
                    </span>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.55rem',
                      borderRadius: 10, border: '1px solid var(--border)',
                      color: a.response_type === 'video' ? '#5e35b1' : 'var(--teal-dark)',
                      background: a.response_type === 'video' ? '#f3e5f5' : '#e0f7fa',
                    }}>
                      {a.response_type === 'video' ? 'Video' : 'Written'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {a.response_count} {a.response_count === 1 ? 'response' : 'responses'}
                    </span>
                    {a.classroom_names.length > 0 && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {a.classroom_names.join(', ')}
                      </span>
                    )}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatDate(a.created_at)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                  <Link
                    to={`/teach-stem/321/${a.id}`}
                    className="btn btn--outline btn--sm"
                  >
                    View Responses
                  </Link>
                  <button
                    onClick={() => changeResponseType(a, a.response_type === 'written' ? 'video' : 'written')}
                    className="btn btn--outline btn--sm"
                    style={{ fontSize: '0.8rem' }}
                    title={`Switch to ${a.response_type === 'written' ? 'video' : 'written'} response`}
                  >
                    {a.response_type === 'written' ? 'Switch to Video' : 'Switch to Written'}
                  </button>
                  <button
                    onClick={() => toggleOpen(a)}
                    className="btn btn--outline btn--sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    {a.is_open ? 'Close' : 'Reopen'}
                  </button>
                  {(isAdmin || a.created_by === user?.id) && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="btn btn--outline btn--sm"
                      style={{ color: '#c62828', borderColor: '#c62828', fontSize: '0.8rem' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/teach-stem" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'underline' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
