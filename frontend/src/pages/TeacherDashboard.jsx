import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

const STATUS_BADGE = {
  draft:    { cls: 'badge--gray',   label: 'Draft' },
  pending:  { cls: 'badge--orange', label: 'Pending Review' },
  approved: { cls: 'badge--green',  label: 'In Library' },
  rejected: { cls: 'badge--red',    label: 'Rejected' },
}

export default function TeacherDashboard() {
  const { user, isTeachSTEM } = useAuth()
  const navigate = useNavigate()
  const [classrooms, setClassrooms] = useState([])
  const [activities, setActivities] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [newClassroom, setNewClassroom] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('classrooms/'),
      api.get('activities/mine/'),
      api.get('modules/'),
    ]).then(([c, a, m]) => {
      setClassrooms(c.data)
      setActivities(a.data)
      setModules(m.data)
    }).finally(() => setLoading(false))
  }, [])

  const createClassroom = async e => {
    e.preventDefault()
    if (!newClassroom.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post('classrooms/', { name: newClassroom.trim() })
      setClassrooms(c => [data, ...c])
      setNewClassroom('')
    } finally {
      setCreating(false)
    }
  }

  const submitActivity = async (activityId) => {
    await api.post(`activities/${activityId}/submit/`)
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: 'pending' } : a))
  }

  const deleteActivity = async (activityId, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    await api.delete(`activities/${activityId}/delete/`)
    setActivities(prev => prev.filter(a => a.id !== activityId))
  }

  if (loading) return <div className="spinner">Loading…</div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>Welcome, {user?.first_name || user?.username}!</h1>
        <p>Manage your classrooms, activities, and modules.</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {isTeachSTEM && (
            <Link to="/teacher/activity/create" className="btn btn--primary" style={{ background: '#fff', color: 'var(--pink)', fontWeight: 800 }}>+ New Activity</Link>
          )}
          <Link to="/teacher/module/create" className="btn btn--teal">+ New Module</Link>
          <Link to="/teacher/modules" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>My Modules</Link>
          <Link to="/join" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>Join a Classroom</Link>
        </div>
      </div>

      <div className="container">

        {/* My Activities */}
        {activities.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div className="section-title">My Activities</div>
            {activities.map(act => {
              const s = STATUS_BADGE[act.status] || STATUS_BADGE.draft
              return (
                <div key={act.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="truncate" style={{ color: 'var(--text)' }}>{act.title}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                      {act.source_activity_title && <span className="badge badge--teal">Copy</span>}
                      {act.grade_levels.map(g => <span key={g.id} className="badge badge--gray">{g.name}</span>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    {(act.status === 'draft' || act.status === 'rejected') && (
                      <>
                        <Link to={`/activity/${act.id}`} className="btn btn--ghost btn--sm">View</Link>
                        <Link to={`/teacher/activity/${act.id}/edit`} className="btn btn--outline btn--sm">Edit</Link>
                        {act.status === 'draft' && (
                          <>
                            <button onClick={() => submitActivity(act.id)} className="btn btn--primary btn--sm">Submit</button>
                            <button onClick={() => deleteActivity(act.id, act.title)} className="btn btn--danger btn--sm">Delete</button>
                          </>
                        )}
                      </>
                    )}
                    {act.status === 'approved' && (
                      <>
                        <Link to={`/activity/${act.id}`} className="btn btn--ghost btn--sm">View</Link>
                        <Link to={`/teacher/activity/${act.id}/responses`} className="btn btn--outline btn--sm">Responses</Link>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Classrooms */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">Your Classrooms</div>

          <form onSubmit={createClassroom} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
            <input className="form-input" placeholder="New classroom name…" value={newClassroom}
                   onChange={e => setNewClassroom(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? '…' : '+ Create'}
            </button>
          </form>

          {classrooms.length === 0 && (
            <div className="empty"><p>No classrooms yet. Create one above.</p></div>
          )}

          {classrooms.map(cl => (
            <Link to={`/teacher/classroom/${cl.id}`} key={cl.id} className="card"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <h3>{cl.name}</h3>
                <p className="text-muted text-sm">
                  Join code: <strong style={{ fontFamily: 'monospace', color: 'var(--pink)', letterSpacing: '0.1em' }}>{cl.code}</strong>
                  &nbsp;·&nbsp; {cl.students_count} student{cl.students_count !== 1 ? 's' : ''}
                  &nbsp;·&nbsp; {cl.activities_count} activit{cl.activities_count !== 1 ? 'ies' : 'y'}
                  {cl.modules_count > 0 && <>&nbsp;·&nbsp; {cl.modules_count} module{cl.modules_count !== 1 ? 's' : ''}</>}
                </p>
              </div>
              <span style={{ color: 'var(--pink)', fontSize: '1.3rem' }}>›</span>
            </Link>
          ))}
        </section>

        {/* Modules */}
        {modules.length > 0 && (
          <section>
            <div className="section-title">My Modules</div>
            {modules.map(mod => (
              <Link to={`/teacher/module/${mod.id}`} key={mod.id} className="card"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                <div>
                  <h3>{mod.title}</h3>
                  <p className="text-muted text-sm">{mod.activity_count} activit{mod.activity_count !== 1 ? 'ies' : 'y'}</p>
                </div>
                <span style={{ color: 'var(--pink)', fontSize: '1.3rem' }}>›</span>
              </Link>
            ))}
          </section>
        )}

      </div>
    </div>
  )
}
