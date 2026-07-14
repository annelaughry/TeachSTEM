import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

export default function TeacherResponses() {
  const { id } = useParams()
  const [data, setData]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [classroomId, setClassroomId] = useState(null)
  const [feedbacks, setFeedbacks]   = useState({})
  const [saved, setSaved]           = useState({})
  const [saving, setSaving]         = useState({})
  const [expanded, setExpanded]     = useState({})
  const [scoreDrafts, setScoreDrafts]   = useState({})  // { studentId-sectionId: string }
  const [savingScore, setSavingScore]   = useState({})
  const [savedScore, setSavedScore]     = useState({})

  const load = useCallback((clId) => {
    setLoading(true)
    const url = clId
      ? `activities/${id}/teacher-responses/?classroom=${clId}`
      : `activities/${id}/teacher-responses/`
    api.get(url).then(r => {
      setData(r.data)
      if (!clId && r.data.active_classroom_id) setClassroomId(r.data.active_classroom_id)
      // Seed feedback drafts
      const fb = {}
      r.data.students.forEach(s => {
        Object.values(s.responses).forEach(resp => {
          if (resp.feedback?.text) fb[resp.id] = resp.feedback.text
        })
      })
      setFeedbacks(fb)
      // Seed score drafts
      const sc = {}
      r.data.students.forEach(s => {
        Object.entries(s.section_scores || {}).forEach(([secId, pts]) => {
          sc[`${s.id}-${secId}`] = pts ?? ''
        })
      })
      setScoreDrafts(sc)
      if (r.data.students.length > 0) setExpanded({ [r.data.students[0].id]: true })
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load(null) }, [load])

  const switchClassroom = (clId) => {
    setClassroomId(clId)
    load(clId)
  }

  const saveFeedback = async (responseId) => {
    setSaving(p => ({ ...p, [responseId]: true }))
    try {
      await api.post(`responses/${responseId}/feedback/`, { text: feedbacks[responseId] || '' })
      setSaved(p => ({ ...p, [responseId]: true }))
      setTimeout(() => setSaved(p => { const n = { ...p }; delete n[responseId]; return n }), 2000)
    } finally {
      setSaving(p => ({ ...p, [responseId]: false }))
    }
  }

  const saveScore = async (sectionId, studentId) => {
    const key = `${studentId}-${sectionId}`
    setSavingScore(p => ({ ...p, [key]: true }))
    try {
      await api.post(
        `scores/section/${sectionId}/student/${studentId}/classroom/${data.active_classroom_id}/`,
        { points_earned: scoreDrafts[key] ?? '' }
      )
      setSavedScore(p => ({ ...p, [key]: true }))
      setTimeout(() => setSavedScore(p => { const n = { ...p }; delete n[key]; return n }), 2000)
    } finally {
      setSavingScore(p => ({ ...p, [key]: false }))
    }
  }

  const toggleStudent = sid => setExpanded(p => ({ ...p, [sid]: !p[sid] }))

  if (loading) return <div className="spinner">Loading...</div>
  if (!data)   return <div className="container" style={{ paddingTop: '2rem' }}><p>Not found.</p></div>

  const { activity, students } = data
  const anyPoints = Object.values(data.section_points || {}).some(v => v > 0)

  const studentSections = activity.sections.filter(sec =>
    sec.prompts.some(p => p.prompt_type === 'student')
  )

  return (
    <div className="page">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--pink) 0%, var(--pink-dark) 100%)', padding: '1.75rem 1.5rem', marginTop: 'var(--nav-h)', color: '#fff' }}>
        <div className="container">
          <div style={{ marginBottom: '0.4rem' }}>
            <Link to="/teacher" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}>
              Back to Dashboard
            </Link>
          </div>
          <h1 style={{ margin: '0 0 0.25rem' }}>Student Responses</h1>
          <p style={{ opacity: 0.9, margin: 0, fontSize: '1rem' }}>{activity.title}</p>
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.88rem', opacity: 0.85, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{students.length} student{students.length !== 1 ? 's' : ''}</span>
            {anyPoints && <span>Points configured</span>}
            {data.classrooms.length > 1 && (
              <select
                value={classroomId || ''}
                onChange={e => switchClassroom(parseInt(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '0.2rem 0.5rem', fontFamily: 'inherit', fontSize: '0.88rem', cursor: 'pointer' }}
              >
                {data.classrooms.map(c => (
                  <option key={c.id} value={c.id} style={{ color: 'var(--text)', background: '#fff' }}>{c.name}</option>
                ))}
              </select>
            )}
            {data.classrooms.length === 1 && (
              <span>{data.classrooms[0].name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: '3rem' }}>
        {students.length === 0 ? (
          <div className="empty" style={{ marginTop: '2.5rem' }}>
            <p>No students have access to this activity yet.</p>
            <p className="text-sm text-muted">Assign this activity or a module containing it to a classroom.</p>
          </div>
        ) : (
          students.map(student => {
            const isOpen = expanded[student.id]

            // Total points for this student
            const totalEarned = studentSections.reduce((sum, sec) => {
              const key = `${student.id}-${sec.id}`
              const val = parseInt(scoreDrafts[key] ?? student.section_scores?.[sec.id] ?? '')
              return sum + (isNaN(val) ? 0 : val)
            }, 0)
            const totalMax = studentSections.reduce((sum, sec) => {
              return sum + (parseInt(data.section_points?.[sec.id]) || 0)
            }, 0)

            return (
              <div key={student.id} className="card" style={{ marginTop: '1.25rem', padding: 0, overflow: 'hidden' }}>
                {/* Accordion header */}
                <button type="button" onClick={() => toggleStudent(student.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: Object.keys(student.responses).length > 0 ? 'var(--pink)' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0 }}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.97rem', color: 'var(--text)' }}>{student.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span>@{student.username}</span>
                      {anyPoints && totalMax > 0 && (
                        <span style={{ fontWeight: 700, color: 'var(--teal-dark)' }}>
                          {totalEarned} / {totalMax} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{isOpen ? '▾' : '▸'}</span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                    {studentSections.length === 0 ? (
                      <p className="text-muted text-sm" style={{ marginTop: '0.75rem', fontStyle: 'italic' }}>
                        This activity has no student prompts.
                      </p>
                    ) : (
                      studentSections.map((sec, secIdx) => {
                        const maxPts = parseInt(data.section_points?.[sec.id]) || 0
                        const scoreKey = `${student.id}-${sec.id}`
                        const sectionPrompts = sec.prompts.filter(p => p.prompt_type === 'student')

                        return (
                          <div key={sec.id} style={{ marginTop: '1.5rem' }}>
                            {/* Section header row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--pink-light)', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: 'var(--pink)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {sec.title || `Section ${secIdx + 1}`}
                                </div>
                              </div>
                              {maxPts > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                  <input
                                    type="number" min="0" max={maxPts}
                                    value={scoreDrafts[scoreKey] ?? ''}
                                    onChange={e => setScoreDrafts(p => ({ ...p, [scoreKey]: e.target.value }))}
                                    placeholder="—"
                                    style={{ width: 58, padding: '0.2rem 0.35rem', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center', fontFamily: 'inherit', fontSize: '0.9rem' }}
                                  />
                                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>/ {maxPts} pts</span>
                                  <button
                                    type="button"
                                    onClick={() => saveScore(sec.id, student.id)}
                                    disabled={savingScore[scoreKey]}
                                    className="btn btn--sm"
                                    style={{ background: savedScore[scoreKey] ? '#2e7d32' : 'var(--teal)', color: '#fff', border: 'none', fontWeight: 700, transition: 'background 0.2s' }}
                                  >
                                    {savingScore[scoreKey] ? '...' : savedScore[scoreKey] ? 'Saved' : 'Save'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Prompts in this section */}
                            {sectionPrompts.map(prompt => {
                              const resp = student.responses[prompt.id]
                              return (
                                <div key={prompt.id} style={{ marginBottom: '1.1rem' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--pink)', fontSize: '0.88rem', marginBottom: '0.45rem' }}>
                                    {prompt.text || <em style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({prompt.response_type} response)</em>}
                                  </div>

                                  {resp ? (
                                    <>
                                      {prompt.response_type === 'text' && (
                                        <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#333', minHeight: 40 }}>
                                          {resp.response_text || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Empty response.</span>}
                                        </div>
                                      )}

                                      {prompt.response_type === 'video' && (
                                        resp.response_video
                                          ? <video controls src={resp.response_video} style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, border: '2px solid var(--teal)', display: 'block' }} />
                                          : <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.88rem' }}>No video uploaded.</p>
                                      )}

                                      {prompt.response_type === 'table' && (
                                        resp.response_table ? (
                                          <div style={{ overflowX: 'auto' }}>
                                            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                                              {resp.response_table.headers?.length > 0 && (
                                                <thead>
                                                  <tr>
                                                    {resp.response_table.headers.map((h, i) => (
                                                      <th key={i} style={{ padding: '0.35rem 0.6rem', background: 'var(--teal)', color: '#fff', border: '1px solid var(--teal-dark)', fontSize: '0.8rem', textAlign: 'left', fontWeight: 800 }}>{h}</th>
                                                    ))}
                                                  </tr>
                                                </thead>
                                              )}
                                              <tbody>
                                                {(resp.response_table.rows || []).map((row, ri) => (
                                                  <tr key={ri}>
                                                    {(Array.isArray(row) ? row : Object.values(row)).map((cell, ci) => (
                                                      <td key={ci} style={{ padding: '0.3rem 0.55rem', border: '1px solid var(--border)', fontSize: '0.88rem' }}>{cell}</td>
                                                    ))}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.88rem' }}>No table submitted.</p>
                                      )}

                                      {/* Feedback */}
                                      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                        <textarea className="form-input" rows={2}
                                          style={{ fontSize: '0.85rem', flex: 1, background: '#fffde7', borderColor: '#f7a826' }}
                                          value={feedbacks[resp.id] ?? resp.feedback?.text ?? ''}
                                          onChange={e => setFeedbacks(p => ({ ...p, [resp.id]: e.target.value }))}
                                          placeholder="Leave feedback for this student..." />
                                        <button type="button" onClick={() => saveFeedback(resp.id)}
                                          className="btn btn--sm" disabled={saving[resp.id]}
                                          style={{ background: saved[resp.id] ? '#2e7d32' : 'var(--yellow)', border: 'none', color: '#fff', fontWeight: 800, flexShrink: 0, transition: 'background 0.2s' }}>
                                          {saving[resp.id] ? '...' : saved[resp.id] ? 'Saved' : 'Save'}
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.85rem', padding: '0.3rem 0' }}>
                                      No response yet.
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
