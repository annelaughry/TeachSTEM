import { useState, useEffect } from 'react'

function toEmbedUrl(url) {
  if (!url) return null
  if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/')) return url
  const ytWatch = url.match(/[?&]v=([^&]+)/)
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`
  const ytShort = url.match(/youtu\.be\/([^?&]+)/)
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return null
}
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function ActivityDetail() {
  const { id } = useParams()
  const { user, isTeacher } = useAuth()
  const [activity, setActivity]     = useState(null)
  const [classrooms, setClassrooms] = useState([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [assigning, setAssigning]   = useState({})       // { classroomId: bool }
  const [pointsConfig, setPointsConfig] = useState({})   // { classroomId: { sectionId: value } }
  const [savingPoints, setSavingPoints] = useState({})
  const [savedPoints, setSavedPoints]   = useState({})

  useEffect(() => {
    const reqs = [api.get(`activities/${id}/`)]
    if (user && isTeacher) reqs.push(api.get('classrooms/'))
    Promise.all(reqs).then(([a, c]) => {
      setActivity(a.data)
      if (c) {
        setClassrooms(c.data)
        c.data.forEach(cl => {
          if (cl.assigned_activity_ids?.includes(parseInt(id))) {
            api.get(`classrooms/${cl.id}/activity/${id}/points/`).then(r => {
              setPointsConfig(prev => ({ ...prev, [cl.id]: r.data }))
            })
          }
        })
      }
    }).finally(() => setLoading(false))
  }, [id, user])

  const toggleAssign = async (classroomId, isCurrentlyAssigned, currentIds) => {
    setAssigning(prev => ({ ...prev, [classroomId]: true }))
    const newIds = isCurrentlyAssigned
      ? currentIds.filter(aid => aid !== parseInt(id))
      : [...currentIds, parseInt(id)]
    setClassrooms(prev => prev.map(c =>
      c.id === classroomId ? { ...c, assigned_activity_ids: newIds } : c
    ))
    try {
      await api.post(`classrooms/${classroomId}/assign-activities/`, { activity_ids: newIds })
      if (!isCurrentlyAssigned) {
        api.get(`classrooms/${classroomId}/activity/${id}/points/`).then(r => {
          setPointsConfig(prev => ({ ...prev, [classroomId]: r.data }))
        })
      }
    } finally {
      setAssigning(prev => ({ ...prev, [classroomId]: false }))
    }
  }

  const updatePointDraft = (classroomId, sectionId, value) => {
    setPointsConfig(prev => ({
      ...prev,
      [classroomId]: { ...(prev[classroomId] || {}), [sectionId]: value },
    }))
  }

  const savePoints = async (classroomId) => {
    setSavingPoints(prev => ({ ...prev, [classroomId]: true }))
    try {
      await api.post(`classrooms/${classroomId}/activity/${id}/points/`, pointsConfig[classroomId] || {})
      setSavedPoints(prev => ({ ...prev, [classroomId]: true }))
      setTimeout(() => setSavedPoints(prev => { const n = { ...prev }; delete n[classroomId]; return n }), 2000)
    } finally {
      setSavingPoints(prev => ({ ...prev, [classroomId]: false }))
    }
  }

  if (loading) return <div className="spinner">Loading…</div>
  if (!activity) return <div className="container"><p>Activity not found.</p></div>

  const assignedClassrooms = classrooms.filter(cl => cl.assigned_activity_ids?.includes(parseInt(id)))

  return (
    <div className="page">
      {/* Assign to Class modal */}
      {showModal && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', width: '100%', maxWidth: 440, overflow: 'hidden' }}>
            <div style={{ background: 'var(--pink)', padding: '1.1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.05rem' }}>Assign to Classroom</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.82rem', marginTop: '0.1rem' }}>{activity.title}</div>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 6, padding: '0.3rem 0.55rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}>
                ×
              </button>
            </div>

            <div style={{ padding: '1rem 1.5rem 1.5rem' }}>
              {classrooms.length === 0 ? (
                <p className="text-muted" style={{ fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                  You have no classrooms yet. <Link to="/teacher" style={{ color: 'var(--pink)' }}>Create one first.</Link>
                </p>
              ) : (
                classrooms.map(cl => {
                  const isAssigned = cl.assigned_activity_ids?.includes(parseInt(id))
                  return (
                    <label
                      key={cl.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem', borderRadius: 8, cursor: assigning[cl.id] ? 'default' : 'pointer', marginBottom: '0.4rem', background: isAssigned ? 'var(--pink-pale)' : '#fafafa', border: `1px solid ${isAssigned ? 'var(--pink-light)' : 'var(--border)'}`, transition: 'background 0.15s' }}
                    >
                      <input
                        type="checkbox"
                        checked={!!isAssigned}
                        disabled={assigning[cl.id]}
                        onChange={() => toggleAssign(cl.id, !!isAssigned, cl.assigned_activity_ids || [])}
                        style={{ accentColor: 'var(--pink)', width: 17, height: 17, flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cl.name}</div>
                        <div className="text-muted text-sm">{cl.students_count} student{cl.students_count !== 1 ? 's' : ''}</div>
                      </div>
                      {isAssigned && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--pink)', background: 'var(--pink-light)', borderRadius: 20, padding: '0.15rem 0.6rem' }}>
                          Assigned
                        </span>
                      )}
                      {assigning[cl.id] && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saving...</span>
                      )}
                    </label>
                  )
                })
              )}
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button onClick={() => setShowModal(false)} className="btn btn--primary">Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ maxWidth: 780 }}>
        {/* Back nav */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Lesson Library
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>{activity.title}</h1>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <span className="badge badge--pink">{activity.activity_type?.replace('_', ' ')}</span>
            {activity.grade_levels.map(g => <span key={g.id} className="badge badge--gray">{g.name}</span>)}
            {activity.duration_minutes > 0 && <span className="badge badge--gray">{activity.duration_minutes} min</span>}
            {activity.standards.map(s => <span key={s.id} className="badge badge--teal">{s.code}</span>)}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {isTeacher && (
              <>
                <Link to={`/activity/${id}/work`} className="btn btn--primary">View as Student</Link>
                <Link to={`/teacher/activity/${id}/responses`} className="btn btn--outline">View Responses</Link>
                {classrooms.length > 0 && (
                  <button onClick={() => setShowModal(true)} className="btn btn--teal">
                    Assign to Class
                  </button>
                )}
              </>
            )}
            {!isTeacher && user && (
              <Link to={`/activity/${id}/work`} className="btn btn--primary">Work on Activity</Link>
            )}
            {activity.handout_files?.map(f => (
              <a key={f.id} href={f.file} target="_blank" rel="noopener noreferrer" className="btn btn--ghost" title={f.description || undefined}>
                {f.label || 'Download File'}
              </a>
            ))}
          </div>
        </div>

        {/* Section points — only for already-assigned classrooms */}
        {isTeacher && assignedClassrooms.length > 0 && activity.sections?.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: 'var(--pink)', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--pink-light)' }}>
              Section Points
            </h3>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              Set how many points each section is worth per classroom.
            </p>
            {assignedClassrooms.map(cl => {
              const clPoints = pointsConfig[cl.id] || {}
              return (
                <div key={cl.id} style={{ marginBottom: '1rem', padding: '0.85rem 1rem', background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.6rem', color: 'var(--text)' }}>{cl.name}</div>
                  {activity.sections.map((sec, i) => (
                    <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                      <span style={{ flex: 1, fontSize: '0.9rem' }}>{sec.title || `Section ${i + 1}`}</span>
                      <input
                        type="number" min="0" max="9999"
                        value={clPoints[sec.id] ?? ''}
                        onChange={e => updatePointDraft(cl.id, sec.id, e.target.value)}
                        placeholder="0"
                        style={{ width: 64, padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'inherit', fontSize: '0.9rem' }}
                      />
                      <span className="text-muted text-sm" style={{ width: 24 }}>pts</span>
                    </div>
                  ))}
                  <button
                    onClick={() => savePoints(cl.id)}
                    className="btn btn--teal btn--sm"
                    style={{ marginTop: '0.5rem' }}
                    disabled={savingPoints[cl.id]}
                  >
                    {savingPoints[cl.id] ? 'Saving...' : savedPoints[cl.id] ? 'Saved' : 'Save Points'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Intro video */}
        {toEmbedUrl(activity.video_url) && (
          <div style={{ marginBottom: '1.25rem', borderRadius: 12, overflow: 'hidden', background: '#111', aspectRatio: '16/9' }}>
            <iframe
              src={toEmbedUrl(activity.video_url)}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Activity video"
            />
          </div>
        )}

        {/* Overview */}
        {(activity.description || activity.materials) && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            {activity.description && <p style={{ marginBottom: activity.materials ? '0.75rem' : 0 }}>{activity.description}</p>}
            {activity.materials && (
              <div>
                <strong>Materials:</strong>
                <ul style={{ marginTop: '0.4rem', paddingLeft: '1.4rem' }}>
                  {activity.materials.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        {activity.sections.map(sec => (
          <div key={sec.id} className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--pink-light)' }}>
            <h3 style={{ color: 'var(--pink)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--pink-light)' }}>
              {sec.title}
            </h3>
            {sec.links.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                {sec.links.map(lnk => (
                  <a key={lnk.id} href={lnk.url} target="_blank" rel="noopener noreferrer"
                     style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#e8f4fd', border: '1px solid #bee3f8', borderRadius: 7, padding: '0.5rem 0.8rem', marginBottom: '0.35rem', color: '#1a5276', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
                    {lnk.label || lnk.url}
                  </a>
                ))}
              </div>
            )}
            {sec.prompts.map(p => (
              <div key={p.id} style={{ marginBottom: '0.85rem' }}>
                {p.prompt_type === 'teacher' ? (
                  <div style={{ background: 'var(--yellow-light)', borderLeft: '3px solid var(--yellow)', borderRadius: '0 7px 7px 0', padding: '0.65rem 0.9rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--yellow-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Teacher Note</div>
                    <div style={{ color: '#555', whiteSpace: 'pre-wrap' }}>{p.text}</div>
                  </div>
                ) : p.prompt_type === 'instruction' ? (
                  <div style={{ background: 'var(--teal-light)', borderLeft: '3px solid var(--teal)', borderRadius: '0 7px 7px 0', padding: '0.65rem 0.9rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Student Instructions</div>
                    <div style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{p.text}</div>
                  </div>
                ) : (
                  <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 7, padding: '0.75rem 1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--pink)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      Student Prompt
                      {p.response_type === 'video' && <span className="badge badge--teal">Video</span>}
                      {p.response_type === 'table' && <span className="badge badge--green">Data Table</span>}
                    </div>
                    <div style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{p.text}</div>
                    {p.response_type === 'table' && p.table_headers?.length > 0 && (
                      <div className="text-sm text-muted" style={{ marginTop: '0.3rem' }}>Columns: {p.table_headers.join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  )
}
