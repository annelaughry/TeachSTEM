import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const TYPE_COLORS = { challenge: 'badge--pink', guided_activity: 'badge--teal', project: 'badge--yellow' }

export default function Library() {
  const [activities, setActivities] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [filters, setFilters] = useState({ q: '', grade: '', type: '' })

  useEffect(() => {
    api.get('grade-levels/').then(r => setGradeLevels(r.data))
    api.get('activity-types/').then(r => setTypes(r.data))
  }, [])

  const search = async e => {
    e?.preventDefault()
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await api.get('activities/', { params: filters })
      setActivities(data)
    } finally {
      setLoading(false)
    }
  }

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)' }}>
        <h1>Lesson Library</h1>
        <p>Find STEM activities, challenges, and projects for your students</p>
      </div>

      <div className="container">
        <form onSubmit={search}>
          <div className="search-bar">
            <input
              className="form-input"
              placeholder="Search by title, standard, or concept…"
              value={filters.q}
              onChange={set('q')}
              style={{ flex: 2 }}
            />
            <select className="form-select" value={filters.grade} onChange={set('grade')} style={{ flex: 1, minWidth: 140 }}>
              <option value="">All grades</option>
              {gradeLevels.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="form-select" value={filters.type} onChange={set('type')} style={{ flex: 1, minWidth: 140 }}>
              <option value="">All types</option>
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="submit" className="btn btn--primary">Search</button>
          </div>
        </form>

        {!searched && (
          <div className="empty">
            <div className="empty__icon"></div>
            <p>Enter a search term or filter above to find activities.</p>
          </div>
        )}

        {loading && <div className="spinner">Searching…</div>}

        {searched && !loading && activities.length === 0 && (
          <div className="empty">
            <div className="empty__icon"></div>
            <p>No activities match your search. Try different keywords or filters.</p>
          </div>
        )}

        {!loading && activities.map(act => (
          <Link to={`/activity/${act.id}`} key={act.id} className="activity-card">
            <div className="activity-card__body">
              <div className="activity-card__title">{act.title}</div>
              <div className="activity-card__meta">
                <span className={`badge ${TYPE_COLORS[act.activity_type] || 'badge--gray'}`}>
                  {act.activity_type.replace('_', ' ')}
                </span>
                {act.grade_levels.map(g => (
                  <span key={g.id} className="badge badge--gray">{g.name}</span>
                ))}
                {act.duration_minutes > 0 && (
                  <span className="badge badge--gray">{act.duration_minutes} min</span>
                )}
                {act.standards.slice(0, 2).map(s => (
                  <span key={s.id} className="badge badge--teal">{s.code}</span>
                ))}
              </div>
              {act.description && (
                <div className="activity-card__desc">{act.description}</div>
              )}
            </div>
            <span style={{ color: 'var(--pink)', fontSize: '1.2rem', flexShrink: 0 }}>›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
