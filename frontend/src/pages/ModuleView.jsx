import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function ModuleView() {
  const { id } = useParams()
  const { isTeacher } = useAuth()
  const [module, setModule] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`modules/${id}/view/`).then(r => setModule(r.data)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="spinner">Loading…</div>
  if (!module) return <div className="container"><p>Module not found.</p></div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>{module.title}</h1>
        {module.description && <p>{module.description}</p>}
        <p style={{ opacity: 0.8, marginTop: '0.5rem', fontSize: '0.9rem' }}>
          {module.activities.length} activit{module.activities.length !== 1 ? 'ies' : 'y'}
          {!isTeacher && ' — complete in order'}
        </p>
      </div>

      <div className="container" style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to={isTeacher ? '/teacher' : '/student'} style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
            ← {isTeacher ? 'Teacher Dashboard' : 'My Classrooms'}
          </Link>
        </div>

        {module.activities.map((act, i) => {
          if (act.is_locked) {
            return (
              <div key={act.id} className="module-row module-row--locked">
                <div className="module-row__num">—</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#2D2D2D', fontSize: '1rem', marginBottom: '0.15rem' }}>{act.title}</div>
                  <div className="text-sm" style={{ color: '#2D2D2D' }}>
                    {act.activity_type?.replace('_', ' ')}
                    {act.grade_levels?.map(g => <span key={g}> · {g}</span>)}
                    {act.duration_minutes > 0 && <span> · {act.duration_minutes} min</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#2D2D2D', marginTop: '0.35rem' }}>
                    Complete the previous activity to unlock this one.
                  </div>
                </div>
              </div>
            )
          }

          if (act.is_complete) {
            return (
              <div key={act.id} className="module-row module-row--complete">
                <div className="module-row__num">Done</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="badge badge--green" style={{ marginBottom: '0.4rem', display: 'inline-flex' }}>Completed</span>
                  <div style={{ fontWeight: 700, color: '#2e7d32', fontSize: '1rem', marginBottom: '0.15rem' }}>{act.title}</div>
                  <div className="text-sm" style={{ color: '#2D2D2D' }}>
                    {act.activity_type?.replace('_', ' ')}
                    {act.grade_levels?.map(g => <span key={g}> · {g}</span>)}
                    {act.duration_minutes > 0 && <span> · {act.duration_minutes} min</span>}
                  </div>
                  {act.description && <div className="text-sm" style={{ color: '#555', marginTop: '0.25rem' }}>{act.description.slice(0, 100)}{act.description.length > 100 ? '…' : ''}</div>}
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link to={`/activity/${act.id}/work`} className="btn btn--ghost btn--sm">Revisit</Link>
                  </div>
                </div>
              </div>
            )
          }

          // Current (unlocked, incomplete)
          return (
            <div key={act.id} className="module-row">
              <div className="module-row__num">{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: '1rem', marginBottom: '0.15rem' }}>{act.title}</div>
                <div className="text-sm text-muted">
                  {act.activity_type?.replace('_', ' ')}
                  {act.grade_levels?.map(g => <span key={g}> · {g}</span>)}
                  {act.duration_minutes > 0 && <span> · {act.duration_minutes} min</span>}
                </div>
                {act.description && <div className="text-sm" style={{ color: '#555', marginTop: '0.25rem' }}>{act.description.slice(0, 120)}{act.description.length > 120 ? '…' : ''}</div>}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <Link to={`/activity/${act.id}/work`} className="btn btn--primary btn--sm">Work on this Activity</Link>
                  {act.instructions_pdf && (
                    <a href={act.instructions_pdf} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">Download PDF</a>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
