import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { SECTIONS as TSTEM_SECTIONS } from '../data/tstemSurvey'
import { SECTIONS as TEACHER_SECTIONS } from '../data/teacherSurvey'

const BLANK_TASK = { title: '', description: '', due_date: '' }

export default function AdminDashboard() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState({})

  // Project topic reviews
  const [projectSubs, setProjectSubs]   = useState([])
  const [feedbacks, setFeedbacks]       = useState({})   // { id: text }
  const [savingFb, setSavingFb]         = useState({})
  const [savedFb, setSavedFb]           = useState({})
  const [expandedSub, setExpandedSub]   = useState(null)

  // Teacher search state
  const [teacherQuery, setTeacherQuery]   = useState('')
  const [teachers, setTeachers]           = useState([])
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [toggling, setToggling]           = useState({})
  const teacherSearchTimeout              = useRef(null)

  // Survey results state
  const [surveyTab, setSurveyTab]           = useState('tstem')
  const [tstemResults, setTstemResults]     = useState(null)
  const [teacherResults, setTeacherResults] = useState(null)
  const [surveyLoading, setSurveyLoading]   = useState(false)
  const [expandedSurvey, setExpandedSurvey] = useState(null)

  // Tasks state
  const [tasks, setTasks]         = useState([])
  const [taskForm, setTaskForm]   = useState(BLANK_TASK)
  const [editingTask, setEditing] = useState(null)   // task id being edited
  const [editForm, setEditForm]   = useState({})
  const [savingTask, setSavingTask] = useState(false)
  const [taskError, setTaskError]   = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('admin/dashboard/'),
      api.get('teach-stem/tasks/'),
      api.get('admin/project-topics/'),
      api.get('admin/survey-results/tstem/'),
    ]).then(([dash, t, ps, tstem]) => {
      setData(dash.data)
      setTasks(t.data)
      setProjectSubs(ps.data)
      setTstemResults(tstem.data)
      if (ps.data.length > 0) setExpandedSub(ps.data[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const action = async (actionName, params) => {
    const key = `${actionName}-${JSON.stringify(params)}`
    setActing(a => ({ ...a, [key]: true }))
    try {
      await api.post('admin/action/', { action: actionName, ...params })
      const { data: fresh } = await api.get('admin/dashboard/')
      setData(fresh)
    } finally {
      setActing(a => ({ ...a, [key]: false }))
    }
  }

  const searchTeachers = (q) => {
    setTeacherQuery(q)
    clearTimeout(teacherSearchTimeout.current)
    teacherSearchTimeout.current = setTimeout(async () => {
      setTeacherLoading(true)
      try {
        const { data } = await api.get('admin/teachers/', { params: { q } })
        setTeachers(data)
      } finally {
        setTeacherLoading(false)
      }
    }, 300)
  }

  const toggleTeachStem = async (teacher) => {
    setToggling(t => ({ ...t, [teacher.id]: true }))
    try {
      const { data } = await api.post(`admin/teachers/${teacher.id}/toggle-teach-stem/`)
      setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, teach_stem_approved: data.teach_stem_approved } : t))
    } finally {
      setToggling(t => ({ ...t, [teacher.id]: false }))
    }
  }

  const loadSurveyResults = async (tab) => {
    setSurveyTab(tab)
    setExpandedSurvey(null)
    if (tab === 'tstem' && tstemResults !== null) return
    if (tab === 'teacher' && teacherResults !== null) return
    setSurveyLoading(true)
    try {
      if (tab === 'tstem') {
        const { data } = await api.get('admin/survey-results/tstem/')
        setTstemResults(data)
      } else {
        const { data } = await api.get('admin/survey-results/teacher/')
        setTeacherResults(data)
      }
    } finally {
      setSurveyLoading(false)
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    setTaskError(null)
    if (!taskForm.title.trim()) { setTaskError('Title is required.'); return }
    setSavingTask(true)
    try {
      const { data: created } = await api.post('teach-stem/tasks/', taskForm)
      setTasks(prev => [...prev, created].sort(byDueDate))
      setTaskForm(BLANK_TASK)
    } catch { setTaskError('Something went wrong.') }
    finally { setSavingTask(false) }
  }

  const saveEdit = async (id) => {
    setSavingTask(true)
    try {
      const { data: updated } = await api.put(`teach-stem/tasks/${id}/`, editForm)
      setTasks(prev => prev.map(t => t.id === id ? updated : t).sort(byDueDate))
      setEditing(null)
    } catch { setTaskError('Something went wrong.') }
    finally { setSavingTask(false) }
  }

  const saveFeedback = async (id) => {
    setSavingFb(p => ({ ...p, [id]: true }))
    try {
      const { data } = await api.post(`admin/project-topics/${id}/feedback/`, { feedback: feedbacks[id] || '' })
      setProjectSubs(prev => prev.map(s => s.id === id ? data : s))
      setSavedFb(p => ({ ...p, [id]: true }))
      setTimeout(() => setSavedFb(p => { const n = { ...p }; delete n[id]; return n }), 2500)
    } finally { setSavingFb(p => ({ ...p, [id]: false })) }
  }

  const deleteTask = async (id, title) => {
    if (!window.confirm(`Delete task "${title}"?`)) return
    await api.delete(`teach-stem/tasks/${id}/`)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) return <div className="spinner">Loading…</div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>Admin Dashboard</h1>
        <p>Review pending teachers and activities.</p>
      </div>

      <div className="container">

        {/* Pending teachers */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">Pending Teacher Approvals</div>
          {data?.pending_teachers.length === 0 ? (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No pending teacher accounts.</p></div>
          ) : (
            data?.pending_teachers.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <h3>{t.name}</h3>
                  <p className="text-muted text-sm">
                    @{t.username}{t.email ? ` · ${t.email}` : ''}
                    {t.is_teach_stem && (
                      <span style={{ marginLeft: '0.5rem', background: 'var(--teal)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: '0.75rem', fontWeight: 700 }}>
                        Teach STEM
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => action('approve_teacher', { user_id: t.id })}
                  className="btn btn--teal btn--sm"
                  disabled={acting[`approve_teacher-${JSON.stringify({ user_id: t.id })}`]}
                >
                  Approve
                </button>
              </div>
            ))
          )}
        </section>

        {/* Teacher search */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">All Teachers</div>
          <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
            Search approved teacher accounts and manage Teach STEM status.
          </p>
          <input
            className="form-input"
            style={{ marginBottom: '0.75rem' }}
            placeholder="Search by name, username, or email…"
            value={teacherQuery}
            onChange={e => searchTeachers(e.target.value)}
          />
          {teacherLoading && <p className="text-muted text-sm">Searching…</p>}
          {!teacherLoading && teacherQuery && teachers.length === 0 && (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No teachers found.</p></div>
          )}
          {teachers.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{t.name}</div>
                <div className="text-muted text-sm">@{t.username}{t.email ? ` · ${t.email}` : ''}</div>
              </div>
              <button
                onClick={() => toggleTeachStem(t)}
                disabled={toggling[t.id]}
                className="btn btn--sm"
                style={{
                  flexShrink: 0,
                  background: t.teach_stem_approved ? 'var(--teal)' : '#f5f5f5',
                  border: `1px solid ${t.teach_stem_approved ? 'var(--teal-dark)' : 'var(--border)'}`,
                  color: t.teach_stem_approved ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                  minWidth: 110,
                }}
              >
                {toggling[t.id] ? '…' : t.teach_stem_approved ? 'Teach STEM' : 'Not Teach STEM'}
              </button>
            </div>
          ))}
          {!teacherQuery && teachers.length === 0 && (
            <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>Type a name or email to search.</p>
          )}
        </section>

        {/* Pending Teach STEM verifications */}
        {data?.pending_teach_stem?.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div className="section-title">Pending Teach STEM Verifications</div>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              These approved teachers self-identified as Teach STEM Program members and are awaiting membership verification.
            </p>
            {data.pending_teach_stem.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--teal)' }}>
                <div>
                  <h3>{t.name}</h3>
                  <p className="text-muted text-sm">@{t.username}{t.email ? ` · ${t.email}` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                  <button
                    onClick={() => { if (window.confirm(`Reject Teach STEM status for ${t.name}?`)) action('reject_teach_stem', { user_id: t.id }) }}
                    className="btn btn--danger btn--sm"
                    disabled={acting[`reject_teach_stem-${JSON.stringify({ user_id: t.id })}`]}
                  >Reject</button>
                  <button
                    onClick={() => action('approve_teach_stem', { user_id: t.id })}
                    className="btn btn--teal btn--sm"
                    disabled={acting[`approve_teach_stem-${JSON.stringify({ user_id: t.id })}`]}
                  >Verify</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Project Topic Reviews */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">Project Topic Submissions</div>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            Teach STEM teachers who submitted project plans for review.
          </p>
          {projectSubs.length === 0 ? (
            <div className="empty" style={{ marginBottom: '1rem' }}>
              <p style={{ fontStyle: 'italic' }}>No submissions yet.</p>
            </div>
          ) : (
            projectSubs.map(sub => (
              <div key={sub.id} className="card" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden', borderLeft: `4px solid ${sub.status === 'reviewed' ? '#2e7d32' : 'var(--teal)'}` }}>
                <button
                  type="button"
                  onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      {sub.classroom_name || 'Unnamed class'}{sub.grade_level ? ` — ${sub.grade_level}` : ''}
                    </div>
                    <div className="text-muted text-sm" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                      <span>{sub.teacher_name}</span>
                      {sub.num_students && <span>{sub.num_students} students</span>}
                      <span style={{ fontWeight: 700, color: sub.status === 'reviewed' ? '#2e7d32' : 'var(--teal-dark)' }}>
                        {sub.status === 'reviewed' ? 'Reviewed' : 'Awaiting Review'}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0 }}>
                    {expandedSub === sub.id ? '▾' : '▸'}
                  </span>
                </button>

                {expandedSub === sub.id && (
                  <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>
                    {sub.standards && <ReviewField label="Standards">{sub.standards}</ReviewField>}
                    {sub.background_concepts && <ReviewField label="Background Concepts">{sub.background_concepts}</ReviewField>}
                    {sub.research_questions?.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <ReviewLabel>Research Questions</ReviewLabel>
                        <ol style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                          {sub.research_questions.map((q, i) => (
                            <li key={i} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.3rem' }}>{q}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <div style={{ marginTop: '1.25rem' }}>
                      <ReviewLabel>Feedback</ReviewLabel>
                      <textarea
                        className="form-input"
                        rows={3}
                        style={{ marginBottom: '0.5rem' }}
                        value={feedbacks[sub.id] ?? sub.admin_feedback ?? ''}
                        onChange={e => setFeedbacks(p => ({ ...p, [sub.id]: e.target.value }))}
                        placeholder="Write feedback for this teacher..."
                      />
                      <button
                        type="button"
                        className="btn btn--teal btn--sm"
                        onClick={() => saveFeedback(sub.id)}
                        disabled={savingFb[sub.id]}
                        style={{ background: savedFb[sub.id] ? '#2e7d32' : undefined }}
                      >
                        {savingFb[sub.id] ? 'Saving...' : savedFb[sub.id] ? 'Saved' : sub.status === 'reviewed' ? 'Update Feedback' : 'Submit Feedback'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        {/* Teach STEM Tasks */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">Teach STEM Tasks</div>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            Tasks posted here appear on every Teach STEM member's dashboard.
          </p>

          {/* Existing tasks */}
          {tasks.length === 0 && (
            <div className="empty" style={{ marginBottom: '1rem' }}>
              <p style={{ fontStyle: 'italic' }}>No tasks yet.</p>
            </div>
          )}
          {tasks.map(task => (
            <div key={task.id} className="card" style={{ marginBottom: '0.75rem', borderLeft: '4px solid var(--teal)' }}>
              {editingTask === task.id ? (
                <div>
                  <input
                    className="form-input"
                    style={{ marginBottom: '0.5rem', fontWeight: 700 }}
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  />
                  <textarea
                    className="form-input"
                    rows={2}
                    style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <input
                    type="date"
                    className="form-input"
                    style={{ marginBottom: '0.75rem', width: 'auto' }}
                    value={editForm.due_date}
                    onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => saveEdit(task.id)} className="btn btn--teal btn--sm" disabled={savingTask}>
                      {savingTask ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(null)} className="btn btn--outline btn--sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.97rem', marginBottom: '0.15rem' }}>{task.title}</div>
                    {task.description && (
                      <p className="text-muted text-sm" style={{ marginBottom: '0.3rem' }}>{task.description}</p>
                    )}
                    {task.due_date && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isOverdue(task.due_date) ? '#c62828' : 'var(--teal-dark)' }}>
                        Due {formatDate(task.due_date)}{isOverdue(task.due_date) ? ' — overdue' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button
                      onClick={() => { setEditing(task.id); setEditForm({ title: task.title, description: task.description, due_date: task.due_date || '' }) }}
                      className="btn btn--outline btn--sm"
                    >Edit</button>
                    <button onClick={() => deleteTask(task.id, task.title)} className="btn btn--danger btn--sm">Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new task form */}
          <div className="card" style={{ background: '#f8fffe', border: '1px dashed var(--teal)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--teal-dark)', marginBottom: '0.75rem' }}>
              Add New Task
            </div>
            <form onSubmit={addTask}>
              <input
                className="form-input"
                style={{ marginBottom: '0.5rem', fontWeight: 600 }}
                placeholder="Task title"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              />
              <textarea
                className="form-input"
                rows={2}
                style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}
                placeholder="Description (optional)"
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label className="form-label">Due Date (optional)</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto' }}
                    value={taskForm.due_date}
                    onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn--teal btn--sm" disabled={savingTask}>
                  {savingTask ? 'Adding...' : 'Add Task'}
                </button>
              </div>
              {taskError && (
                <p style={{ color: '#c62828', fontSize: '0.85rem', marginTop: '0.5rem' }}>{taskError}</p>
              )}
            </form>
          </div>
        </section>

        {/* Survey Results */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="section-title">Survey Results</div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '1.25rem', borderBottom: '2px solid var(--border)' }}>
            {[
              { key: 'tstem', label: 'T-STEM Survey' },
              { key: 'teacher', label: 'Teacher Survey' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => loadSurveyResults(tab.key)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: surveyTab === tab.key ? '2px solid var(--teal)' : '2px solid transparent',
                  marginBottom: -2,
                  cursor: 'pointer',
                  fontWeight: surveyTab === tab.key ? 800 : 500,
                  color: surveyTab === tab.key ? 'var(--teal-dark)' : 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {surveyLoading && <p className="text-muted text-sm">Loading...</p>}

          {!surveyLoading && (() => {
            const results = surveyTab === 'tstem' ? tstemResults : teacherResults
            const sections = surveyTab === 'tstem' ? TSTEM_SECTIONS : TEACHER_SECTIONS
            if (results === null) {
              return null
            }
            if (results.length === 0) {
              return <div className="empty"><p style={{ fontStyle: 'italic' }}>No responses yet.</p></div>
            }
            const completed = results.filter(r => r.completed).length
            return (
              <>
                <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
                  {completed} of {results.length} teacher{results.length !== 1 ? 's' : ''} completed
                </p>
                {results.map(r => (
                  <div key={r.teacher_id} className="card" style={{ marginBottom: '0.5rem', padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedSurvey(expandedSurvey === r.teacher_id ? null : r.teacher_id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.teacher_name}</span>
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: r.completed ? '#e8f5e9' : '#fff3e0',
                        color: r.completed ? '#2e7d32' : '#e65100',
                        border: `1px solid ${r.completed ? '#a5d6a7' : '#ffcc80'}`,
                        flexShrink: 0,
                      }}>
                        {r.completed ? 'Completed' : 'In Progress'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {expandedSurvey === r.teacher_id ? '▾' : '▸'}
                      </span>
                    </button>

                    {expandedSurvey === r.teacher_id && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '1rem' }}>
                        {Object.keys(r.responses || {}).length === 0 ? (
                          <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>No answers recorded yet.</p>
                        ) : (
                          sections.map(sec => {
                            const answered = sec.questions.filter((_, qi) => r.responses[`${sec.id}_q${qi + 1}`] != null)
                            if (!answered.length) return null
                            return (
                              <div key={sec.id} style={{ marginBottom: '1.25rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                  {sec.title}
                                </div>
                                {sec.questions.map((q, qi) => {
                                  const val = r.responses[`${sec.id}_q${qi + 1}`]
                                  if (val == null) return null
                                  return (
                                    <div key={qi} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem', fontSize: '0.88rem', alignItems: 'flex-start' }}>
                                      <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 18 }}>{qi + 1}.</span>
                                      <span style={{ flex: 1, color: '#333' }}>{q}</span>
                                      <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--teal-dark)', fontSize: '0.82rem', background: '#f0fdfa', border: '1px solid var(--teal)', borderRadius: 4, padding: '1px 7px' }}>
                                        {sec.scale[val - 1]}
                                      </span>
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
                ))}
              </>
            )
          })()}
        </section>

        {/* Pending activities */}
        <section>
          <div className="section-title">Pending Activity Reviews</div>
          {data?.pending_activities.length === 0 ? (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No activities awaiting review.</p></div>
          ) : (
            data?.pending_activities.map(act => (
              <div key={act.id} className="card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ marginBottom: '0.2rem' }}>{act.title}</h3>
                    <p className="text-muted text-sm">
                      {act.activity_type?.replace('_', ' ')} · {act.created_by_name}
                      {act.grade_levels?.map(g => <span key={g.id}> · {g.name}</span>)}
                    </p>
                    {act.description && <p className="text-sm" style={{ color: '#555', marginTop: '0.25rem' }}>{act.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => { if (confirm(`Reject "${act.title}"?`)) action('reject_activity', { activity_id: act.id }) }}
                      className="btn btn--danger btn--sm"
                    >Reject</button>
                    <button
                      onClick={() => action('approve_activity', { activity_id: act.id })}
                      className="btn btn--teal btn--sm"
                    >Approve</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                  <Link to={`/activity/${act.id}`} className="btn btn--outline btn--sm" target="_blank" rel="noopener noreferrer">
                    View Full Activity
                  </Link>
                  <Link to={`/activity/${act.id}/work`} className="btn btn--sm" style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', color: 'var(--teal-dark)', fontWeight: 700 }} target="_blank" rel="noopener noreferrer">
                    View as Student
                  </Link>
                </div>
              </div>
            ))
          )}
        </section>

      </div>
    </div>
  )
}

function ReviewLabel({ children }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
      {children}
    </div>
  )
}

function ReviewField({ label, children }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <ReviewLabel>{label}</ReviewLabel>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', color: '#333' }}>{children}</div>
    </div>
  )
}

function byDueDate(a, b) {
  if (!a.due_date && !b.due_date) return 0
  if (!a.due_date) return 1
  if (!b.due_date) return -1
  return a.due_date.localeCompare(b.due_date)
}

function isOverdue(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr + 'T23:59:59') < new Date()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
