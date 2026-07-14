import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [classrooms, setClassrooms]       = useState([])
  const [assignments321, setAssignments321] = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('student/classrooms/'),
      api.get('321/student/'),
    ]).then(([c, a]) => {
      setClassrooms(c.data)
      setAssignments321(a.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner">Loading…</div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>Welcome, {user?.first_name || user?.username}!</h1>
        <p>Here are the activities and modules your teacher has assigned.</p>
        <div style={{ marginTop: '1.25rem' }}>
          <Link to="/join" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>
            + Join a Classroom
          </Link>
        </div>
      </div>

      <div className="container">

        {/* 3-2-1 Exit Tickets */}
        {assignments321.length > 0 && (
          <section style={{ marginBottom: '2rem', marginTop: '1rem' }}>
            <div className="section-title" style={{ color: 'var(--teal-dark)', marginBottom: '0.75rem' }}>Exit Tickets</div>
            {assignments321.map(a => (
              <div key={a.id} className="card" style={{ marginBottom: '0.65rem', borderLeft: `4px solid ${a.student_responded ? '#ccc' : 'var(--teal)'}`, opacity: a.student_responded ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.97rem', marginBottom: '0.15rem' }}>
                      {a.title || (a.activity_title ? `After: ${a.activity_title}` : '3-2-1 Exit Ticket')}
                    </div>
                    {a.classroom_names?.length > 0 && (
                      <p className="text-muted text-sm" style={{ marginBottom: 0 }}>{a.classroom_names.join(', ')}</p>
                    )}
                  </div>
                  {a.student_responded ? (
                    <Link to={`/student/321/${a.id}`} className="btn btn--outline btn--sm" style={{ flexShrink: 0 }}>
                      View Response
                    </Link>
                  ) : (
                    <Link to={`/student/321/${a.id}`} className="btn btn--primary btn--sm" style={{ flexShrink: 0 }}>
                      Complete
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {classrooms.length === 0 && (
          <div className="empty">
            <div className="empty__icon"></div>
            <p>You haven't joined any classrooms yet.</p>
            <Link to="/join" className="btn btn--primary">Join a Classroom</Link>
          </div>
        )}

        {classrooms.map(cl => (
          <section key={cl.id} style={{ marginBottom: '2.5rem' }}>
            <div className="section-title">{cl.name}</div>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              Teacher: {cl.teacher}
            </p>

            {cl.assigned_modules.length === 0 && cl.assigned_activities.length === 0 && (
              <p className="text-muted" style={{ fontStyle: 'italic' }}>No activities assigned yet.</p>
            )}

            {/* Modules */}
            {cl.assigned_modules.map(mod => (
              <div key={mod.id} className="card card--highlight" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--pink)' }}>{mod.title}</h3>
                    {mod.description && <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>{mod.description}</p>}
                    <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {mod.activities.length} activit{mod.activities.length !== 1 ? 'ies' : 'y'} — complete in order
                    </p>
                  </div>
                  <Link to={`/module/${mod.id}`} className="btn btn--primary btn--sm">View Module</Link>
                </div>

                {/* Preview first few activities */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {mod.activities.slice(0, 3).map((act, i) => (
                    <div key={act.id} className={`module-row ${act.is_complete ? 'module-row--complete' : act.is_locked ? 'module-row--locked' : ''}`}
                         style={{ boxShadow: 'none', margin: 0 }}>
                      <div className="module-row__num">
                        {act.is_complete ? 'Done' : act.is_locked ? '—' : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: act.is_locked ? '#bbb' : act.is_complete ? '#2e7d32' : 'var(--text)' }}>
                          {act.title}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{act.activity_type}</div>
                      </div>
                    </div>
                  ))}
                  {mod.activities.length > 3 && (
                    <p className="text-sm text-muted" style={{ paddingLeft: '3rem' }}>+ {mod.activities.length - 3} more…</p>
                  )}
                </div>
              </div>
            ))}

            {/* Individual activities */}
            {cl.assigned_activities.length > 0 && (
              <>
                {cl.assigned_modules.length > 0 && (
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Individual Activities
                  </p>
                )}
                {cl.assigned_activities.map(act => (
                  <div key={act.id} className="card" style={{ marginBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ color: 'var(--pink)', marginBottom: '0.25rem' }}>{act.title}</h3>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                          <span className="badge badge--pink">{act.activity_type?.replace('_', ' ')}</span>
                          {act.grade_levels?.map(g => <span key={g.id} className="badge badge--gray">{g.name}</span>)}
                          {act.duration_minutes > 0 && <span className="badge badge--gray">{act.duration_minutes} min</span>}
                        </div>
                        {act.description && <p className="text-muted text-sm">{act.description}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
                        <Link to={`/activity/${act.id}/work`} className="btn btn--primary btn--sm">Start</Link>
                        {act.instructions_pdf && (
                          <a href={act.instructions_pdf} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">PDF</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
