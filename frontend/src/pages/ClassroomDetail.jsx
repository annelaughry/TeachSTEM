import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ClassroomDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [classroom, setClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get(`classrooms/${id}/`).then(r => setClassroom(r.data)).finally(() => setLoading(false))
  }, [id])

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
