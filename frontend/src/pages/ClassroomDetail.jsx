import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../AuthContext'

export default function ClassroomDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [classroom, setClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  // Co-teacher management
  const [teacherQuery, setTeacherQuery] = useState('')
  const [teacherResults, setTeacherResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const searchTimeout = useRef(null)

  useEffect(() => {
    api.get(`classrooms/${id}/`).then(r => setClassroom(r.data)).finally(() => setLoading(false))
  }, [id])

  const searchTeachers = (q) => {
    setTeacherQuery(q)
    clearTimeout(searchTimeout.current)
    if (!q.trim()) { setTeacherResults([]); return }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get('teachers/search/', { params: { q } })
        setTeacherResults(data)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const addTeacher = async (teacherId) => {
    setAddingId(teacherId)
    try {
      const { data } = await api.post(`classrooms/${id}/teachers/add/`, { user_id: teacherId })
      setClassroom(data)
      setTeacherQuery('')
      setTeacherResults([])
    } finally {
      setAddingId(null)
    }
  }

  const removeTeacher = async (teacherId) => {
    setRemovingId(teacherId)
    try {
      const { data } = await api.post(`classrooms/${id}/teachers/remove/`, { user_id: teacherId })
      if (teacherId === user?.id) {
        navigate('/teacher')
        return
      }
      setClassroom(data)
    } finally {
      setRemovingId(null)
    }
  }

  const removeActivity = async (actId) => {
    const next = classroom.assigned_activities.filter(a => a.id !== actId)
    setClassroom(c => ({ ...c, assigned_activities: next }))
    await api.post(`classrooms/${id}/assign-activities/`, { activity_ids: next.map(a => a.id) })
  }

  const removeModule = async (modId) => {
    const next = classroom.assigned_modules.filter(m => m.id !== modId)
    setClassroom(c => ({ ...c, assigned_modules: next }))
    await api.post(`classrooms/${id}/assign-modules/`, { module_ids: next.map(m => m.id) })
  }

  const deleteClassroom = async () => {
    if (!confirm(`Delete ${classroom.name}? This cannot be undone.`)) return
    setDeleting(true)
    await api.delete(`classrooms/${id}/`)
    navigate('/teacher')
  }

  if (loading) return <div className="spinner">Loading…</div>
  if (!classroom) return <div className="container"><p>Classroom not found.</p></div>

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teacher" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Teacher Dashboard
          </Link>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h1>{classroom.name}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            Join code:{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, color: 'var(--pink)', letterSpacing: '0.15em' }}>
              {classroom.code}
            </span>
          </p>
        </div>

        {/* Teachers */}
        <section style={{ marginBottom: '2rem' }}>
          <div className="section-title">Teachers ({classroom.teachers?.length || 0})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {classroom.teachers?.map(t => (
              <div key={t.id} className="card" style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <span>{t.name}{t.id === user?.id ? ' (you)' : ''}</span>
                {classroom.teachers.length > 1 && (
                  <button
                    onClick={() => removeTeacher(t.id)}
                    className="btn btn--danger btn--sm"
                    disabled={removingId === t.id}
                  >
                    {removingId === t.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <input
            className="form-input"
            style={{ marginBottom: '0.5rem' }}
            placeholder="Search teachers by name, username, or email to add a co-teacher…"
            value={teacherQuery}
            onChange={e => searchTeachers(e.target.value)}
          />
          {searching && <p className="text-muted text-sm">Searching…</p>}
          {!searching && teacherQuery && teacherResults.length === 0 && (
            <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>No teachers found.</p>
          )}
          {teacherResults.filter(t => !classroom.teachers?.some(ct => ct.id === t.id)).map(t => (
            <div key={t.id} className="card" style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="text-muted text-sm">@{t.username}{t.email ? ` · ${t.email}` : ''}</div>
              </div>
              <button
                onClick={() => addTeacher(t.id)}
                className="btn btn--teal btn--sm"
                disabled={addingId === t.id}
              >
                {addingId === t.id ? 'Adding…' : 'Add'}
              </button>
            </div>
          ))}
        </section>

        {/* Students */}
        <section style={{ marginBottom: '2rem' }}>
          <div className="section-title">Students ({classroom.students?.length || 0})</div>
          {classroom.students?.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>No students have joined yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {classroom.students?.map(s => (
                <div key={s.id} className="card" style={{ padding: '0.6rem 1rem' }}>
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Assigned Modules */}
        <section style={{ marginBottom: '2rem' }}>
          <div className="section-title">Assigned Modules</div>
          {classroom.assigned_modules?.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>
              No modules assigned. <Link to="/teacher/modules" style={{ color: 'var(--pink)' }}>Browse modules →</Link>
            </p>
          ) : (
            classroom.assigned_modules?.map(mod => (
              <div key={mod.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <Link to={`/teacher/module/${mod.id}`} style={{ fontWeight: 700, color: 'var(--pink)', textDecoration: 'none', fontSize: '1rem' }}>
                    {mod.title}
                  </Link>
                  <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>{mod.activity_count} activit{mod.activity_count !== 1 ? 'ies' : 'y'}</p>
                </div>
                <button onClick={() => removeModule(mod.id)} className="btn btn--danger btn--sm">Remove</button>
              </div>
            ))
          )}
        </section>

        {/* Assigned Activities */}
        <section style={{ marginBottom: '2rem' }}>
          <div className="section-title">Assigned Activities</div>
          {classroom.assigned_activities?.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>
              No activities assigned. <Link to="/" style={{ color: 'var(--pink)' }}>Browse the library →</Link>
            </p>
          ) : (
            classroom.assigned_activities?.map(act => (
              <div key={act.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/activity/${act.id}`} style={{ fontWeight: 700, color: 'var(--pink)', textDecoration: 'none', fontSize: '1rem' }}>
                    {act.title}
                  </Link>
                  <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>
                    {act.activity_type?.replace('_', ' ')}
                    {act.grade_levels?.map(g => <span key={g.id}> · {g.name}</span>)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <Link to={`/teacher/activity/${act.id}/responses`} className="btn btn--ghost btn--sm">Responses</Link>
                  <button onClick={() => removeActivity(act.id)} className="btn btn--danger btn--sm">Remove</button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Delete */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <button onClick={deleteClassroom} className="btn btn--danger" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete this classroom'}
          </button>
        </div>
      </div>
    </div>
  )
}
