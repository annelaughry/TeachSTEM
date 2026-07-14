import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function ModuleList() {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('modules/').then(r => setModules(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="spinner">Loading…</div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>My Modules</h1>
        <p>Curate sequences of activities for your students.</p>
        <div style={{ marginTop: '1.25rem' }}>
          <Link to="/teacher/module/create" className="btn btn--teal">+ New Module</Link>
        </div>
      </div>

      <div className="container">
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/teacher" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>← Teacher Dashboard</Link>
        </div>

        {modules.length === 0 ? (
          <div className="empty">
            <div className="empty__icon"></div>
            <p>No modules yet. Create one to curate an activity sequence for your students.</p>
            <Link to="/teacher/module/create" className="btn btn--primary">Create your first module</Link>
          </div>
        ) : (
          modules.map(mod => (
            <div key={mod.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="truncate"><Link to={`/teacher/module/${mod.id}`} style={{ color: 'var(--pink)', textDecoration: 'none' }}>{mod.title}</Link></h3>
                {mod.description && <p className="text-muted text-sm" style={{ marginTop: '0.2rem' }}>{mod.description}</p>}
                <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  {mod.activity_count} activit{mod.activity_count !== 1 ? 'ies' : 'y'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <Link to={`/teacher/module/${mod.id}`} className="btn btn--ghost btn--sm">View</Link>
                <Link to={`/teacher/module/${mod.id}/edit`} className="btn btn--outline btn--sm">Edit</Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
