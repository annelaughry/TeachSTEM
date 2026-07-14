import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function ModuleDetail() {
  const { id } = useParams()
  const [module, setModule] = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [assignedIds, setAssignedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([api.get(`modules/${id}/`), api.get('classrooms/')]).then(([m, c]) => {
      setModule(m.data)
      setClassrooms(c.data)
      // Determine which classrooms have this module — we'll detect by checking assignment
    }).finally(() => setLoading(false))
  }, [id])

  const toggleClassroom = async (classroomId) => {
    const next = new Set(assignedIds)
    if (next.has(classroomId)) next.delete(classroomId)
    else next.add(classroomId)
    setAssignedIds(next)
  }

  const saveAssignments = async () => {
    setSaving(true)
    await Promise.all(classrooms.map(cl =>
      api.post(`classrooms/${cl.id}/assign-modules/`, {
        module_ids: assignedIds.has(cl.id)
          ? [...(cl.assigned_modules_ids || []), parseInt(id)]
          : (cl.assigned_modules_ids || []).filter(mid => mid !== parseInt(id))
      })
    ))
    setSaving(false)
  }

  if (loading) return <div className="spinner">Loading…</div>
  if (!module) return <div className="container"><p>Module not found.</p></div>

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teacher/modules" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>← My Modules</Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--text)', marginBottom: '0.3rem' }}>{module.title}</h1>
            {module.description && <p className="text-muted">{module.description}</p>}
            <p className="text-sm text-muted" style={{ marginTop: '0.3rem' }}>
              {module.module_activities.length} activit{module.module_activities.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
          <Link to={`/teacher/module/${id}/edit`} className="btn btn--outline">Edit Module</Link>
        </div>

        {/* Activity sequence */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--pink)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--pink-light)' }}>
            Activities in this Module
          </h3>
          {module.module_activities.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>No activities. <Link to={`/teacher/module/${id}/edit`} style={{ color: 'var(--pink)' }}>Edit to add some.</Link></p>
          ) : (
            module.module_activities.map((ma, i) => (
              <div key={ma.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '0.6rem' }}>
                <div style={{ fontWeight: 900, color: 'var(--pink)', fontSize: '1.1rem', minWidth: '2rem', textAlign: 'right' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/activity/${ma.activity.id}`} style={{ fontWeight: 700, color: 'var(--pink)', textDecoration: 'none', fontSize: '0.97rem' }}>{ma.activity.title}</Link>
                  <div className="text-sm text-muted" style={{ marginTop: '0.15rem' }}>
                    {ma.activity.activity_type?.replace('_', ' ')}
                    {ma.activity.grade_levels?.map(g => <span key={g.id}> · {g.name}</span>)}
                    {ma.activity.duration_minutes > 0 && <span> · {ma.activity.duration_minutes} min</span>}
                  </div>
                  {ma.activity.description && (
                    <div className="text-sm" style={{ color: '#666', marginTop: '0.2rem' }}>{ma.activity.description.slice(0, 120)}{ma.activity.description.length > 120 ? '…' : ''}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Classroom assignment */}
        <div className="card">
          <h3 style={{ color: 'var(--pink)', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--pink-light)' }}>
            Assign to Classrooms
          </h3>
          {classrooms.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic' }}>
              <Link to="/teacher" style={{ color: 'var(--pink)' }}>Create a classroom</Link> to assign this module.
            </p>
          ) : (
            <>
              <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>Select which classrooms should have access to this module.</p>
              {classrooms.map(cl => (
                <label key={cl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '0.6rem', fontWeight: 600 }}>
                  <input type="checkbox" checked={assignedIds.has(cl.id)} onChange={() => toggleClassroom(cl.id)}
                         style={{ accentColor: 'var(--pink)', width: 16, height: 16 }} />
                  <span>{cl.name}</span>
                  {assignedIds.has(cl.id) && <span className="badge badge--green">assigned</span>}
                </label>
              ))}
              <button onClick={saveAssignments} className="btn btn--primary btn--sm" disabled={saving} style={{ marginTop: '0.5rem' }}>
                {saving ? 'Saving…' : 'Save Assignments'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
