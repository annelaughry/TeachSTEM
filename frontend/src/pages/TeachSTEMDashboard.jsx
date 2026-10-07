import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { MonthCalendar, GoogleCalendarEmbed, EventDetails, todayKey } from '../components/TeachSTEMCalendar'

function DashCard({ to, title, description, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div
        className="card"
        style={{ borderTop: `4px solid ${color}`, height: '100%', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.12)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
      >
        <div style={{ fontWeight: 900, fontSize: '1rem', color, marginBottom: '0.4rem' }}>{title}</div>
        <p className="text-muted text-sm" style={{ marginBottom: 0 }}>{description}</p>
      </div>
    </Link>
  )
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

function PollChoices({ task, onVote, submitLabel, onCancel }) {
  const [choice, setChoice] = useState(task.my_vote)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try { await onVote(task.id, choice) }
    catch { setError('Could not save your answer. Please try again.') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {task.poll_options.map(o => (
        <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.3rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`poll-${task.id}`}
            checked={choice === o.id}
            onChange={() => setChoice(o.id)}
          />
          {o.text}
        </label>
      ))}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
        <button onClick={submit} disabled={!choice || saving} className="btn btn--teal btn--sm">
          {saving ? 'Saving...' : submitLabel}
        </button>
        {onCancel && <button onClick={onCancel} className="btn btn--outline btn--sm">Cancel</button>}
      </div>
      {error && <p style={{ color: '#c62828', fontSize: '0.85rem', marginTop: '0.4rem', marginBottom: 0 }}>{error}</p>}
    </div>
  )
}

export default function TeachSTEMDashboard() {
  const [tasks, setTasks]                       = useState([])
  const [toggling, setToggling]                 = useState({})
  const [showDone, setShowDone]                 = useState(false)
  const [assignedActivities, setAssignedActivities] = useState([])
  const [changingVote, setChangingVote]         = useState(null)   // poll task id being re-answered
  const [calendar, setCalendar]                 = useState({ events: [], google_calendar_embed_url: '' })
  const [calendarView, setCalendarView]         = useState('events')   // 'events' | 'google'

  useEffect(() => {
    api.get('teach-stem/tasks/').then(r => setTasks(r.data)).catch(() => {})
    api.get('teach-stem/calendar/').then(r => {
      setCalendar(r.data)
      if (r.data.events.length === 0 && r.data.google_calendar_embed_url) setCalendarView('google')
    }).catch(() => {})
    api.get('teach-stem/assigned-activities/').then(r => setAssignedActivities(r.data)).catch(() => {})
  }, [])

  const markComplete = async (taskId) => {
    setToggling(t => ({ ...t, [taskId]: true }))
    try {
      const { data } = await api.post(`teach-stem/tasks/${taskId}/complete/`)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: data.completed } : t))
    } finally {
      setToggling(t => ({ ...t, [taskId]: false }))
    }
  }

  const vote = async (taskId, optionId) => {
    const { data } = await api.post(`teach-stem/tasks/${taskId}/vote/`, { option: optionId })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: data.completed, my_vote: data.my_vote } : t))
    setChangingVote(null)
  }

  const today = todayKey()
  const upcomingEvents = calendar.events.filter(e => (e.end_date || e.date) >= today).slice(0, 3)
  const hasGoogle = Boolean(calendar.google_calendar_embed_url)

  const pending   = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>Teach STEM Dashboard</h1>
        <p>Tools and resources for Teach STEM Program members.</p>
      </div>

      <div className="container" style={{ maxWidth: 780, paddingBottom: '3rem' }}>

        {/* Profile */}
        <div style={{ marginTop: '2rem', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Profile</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>Your Teach STEM member information.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/teach-stem/profile"
            title="My Profile"
            description="Update your name, school, subject, and teaching experience."
            color="var(--teal-dark)"
          />
        </div>

        {/* Tasks */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Tasks</h2>
            <p className="text-muted" style={{ marginBottom: 0 }}>Items to complete as a Teach STEM member.</p>
          </div>
          {completed.length > 0 && (
            <button
              onClick={() => setShowDone(s => !s)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'underline', padding: 0, flexShrink: 0 }}
            >
              {showDone ? 'Hide' : 'Show'} completed ({completed.length})
            </button>
          )}
        </div>
        <div style={{ marginBottom: '2rem' }}>
          {pending.length === 0 && !showDone && (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No pending tasks.</p></div>
          )}
          {pending.map(task => {
            const overdue = isOverdue(task.due_date)
            return (
              <div key={task.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.65rem', borderLeft: `4px solid ${overdue ? '#c62828' : 'var(--teal)'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.97rem', marginBottom: task.description ? '0.2rem' : 0 }}>
                    {task.is_poll && <span className="badge badge--teal" style={{ marginRight: '0.4rem' }}>Poll</span>}
                    {task.title}
                  </div>
                  {task.description && (
                    <p className="text-muted text-sm" style={{ marginBottom: '0.3rem' }}>{task.description}</p>
                  )}
                  {task.due_date && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: overdue ? '#c62828' : 'var(--teal-dark)' }}>
                      Due {formatDate(task.due_date)}{overdue ? ' — overdue' : ''}
                    </span>
                  )}
                  {task.is_poll && <PollChoices task={task} onVote={vote} submitLabel="Submit Answer" />}
                </div>
                {!task.is_poll && (
                  <button
                    onClick={() => markComplete(task.id)}
                    disabled={toggling[task.id]}
                    className="btn btn--outline btn--sm"
                    style={{ flexShrink: 0 }}
                  >
                    {toggling[task.id] ? '...' : 'Mark Complete'}
                  </button>
                )}
              </div>
            )
          })}

          {showDone && completed.map(task => task.is_poll ? (
            <div key={task.id} className="card" style={{ marginBottom: '0.65rem', borderLeft: '4px solid #ccc', opacity: changingVote === task.id ? 1 : 0.65 }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.97rem', color: 'var(--text-muted)' }}>{task.title}</div>
                  {changingVote !== task.id && (
                    <p className="text-muted text-sm" style={{ marginBottom: 0 }}>
                      Your answer: {task.poll_options.find(o => o.id === task.my_vote)?.text}
                    </p>
                  )}
                </div>
                {changingVote !== task.id && (
                  <button
                    onClick={() => setChangingVote(task.id)}
                    className="btn btn--outline btn--sm"
                    style={{ flexShrink: 0, fontSize: '0.78rem' }}
                  >Change Answer</button>
                )}
              </div>
              {changingVote === task.id && (
                <PollChoices task={task} onVote={vote} submitLabel="Save Answer" onCancel={() => setChangingVote(null)} />
              )}
            </div>
          ) : (
            <div key={task.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.65rem', borderLeft: '4px solid #ccc', opacity: 0.65 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.97rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>{task.title}</div>
                {task.description && (
                  <p className="text-muted text-sm" style={{ marginBottom: 0 }}>{task.description}</p>
                )}
              </div>
              <button
                onClick={() => markComplete(task.id)}
                disabled={toggling[task.id]}
                className="btn btn--outline btn--sm"
                style={{ flexShrink: 0, fontSize: '0.78rem' }}
              >
                {toggling[task.id] ? '...' : 'Undo'}
              </button>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Calendar</h2>
            <p className="text-muted" style={{ marginBottom: 0 }}>Upcoming Teach STEM events and dates.</p>
          </div>
          {hasGoogle && calendar.events.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setCalendarView('events')}
                className={`btn btn--sm ${calendarView === 'events' ? 'btn--teal' : 'btn--outline'}`}
              >Program Events</button>
              <button
                onClick={() => setCalendarView('google')}
                className={`btn btn--sm ${calendarView === 'google' ? 'btn--teal' : 'btn--outline'}`}
              >Google Calendar</button>
            </div>
          )}
        </div>
        <div style={{ marginBottom: '2rem' }}>
          {calendarView === 'google' && hasGoogle ? (
            <GoogleCalendarEmbed url={calendar.google_calendar_embed_url} />
          ) : calendar.events.length === 0 ? (
            <div className="empty"><p style={{ fontStyle: 'italic' }}>No events scheduled yet.</p></div>
          ) : (
            <>
              {upcomingEvents.length > 0 && (
                <div className="card" style={{ marginBottom: '0.75rem', borderLeft: '4px solid var(--teal)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                    Coming up
                  </div>
                  {upcomingEvents.map(e => (
                    <div key={e.id} style={{ marginBottom: '0.7rem' }}><EventDetails event={e} /></div>
                  ))}
                </div>
              )}
              <MonthCalendar events={calendar.events} />
            </>
          )}
        </div>

        {/* Project Planning Resources */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Project Planning Resources</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Tools to help you plan and structure your classroom projects.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/teach-stem/project-topics"
            title="Project Topics"
            description="Document class details, standards, and the background concepts students will need before starting a project."
            color="var(--teal)"
          />
          <DashCard
            to="/teach-stem/project-starter"
            title="Project Starter Builder"
            description="Build a custom project guide with an overview, competencies, getting-started steps, and tips — then submit it to admin for review."
            color="var(--teal-dark)"
          />
        </div>

        {/* Student Feedback */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Student Feedback</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Quick check-ins and reflections to hear from students after activities and projects.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/teach-stem/321"
            title="3-2-1 Exit Tickets"
            description="Assign a 3-2-1 reflection after any activity — three things learned, two questions, one most interesting thing."
            color="var(--teal)"
          />
          <DashCard
            to="/teach-stem/student-reflections"
            title="STEM Project Reflection"
            description="Assign a full reflection survey after a STEM project — enjoyment, challenge level, skills gained, and open-ended reflection."
            color="var(--teal-dark)"
          />
        </div>

        {/* Teacher Surveys */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Teacher Surveys</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Research surveys to help us understand your teaching experience and beliefs.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/teach-stem/tstem-survey"
            title="T-STEM Science Teacher Survey"
            description="A Friday Institute survey measuring your science teaching efficacy, instructional practices, 21st century learning attitudes, and STEM career awareness."
            color="var(--teal-dark)"
          />
          <DashCard
            to="/teacher/survey"
            title="Teacher Survey"
            description="A survey measuring your teaching efficacy, instructional practices, 21st century learning attitudes, and career awareness — adapted for all subject areas."
            color="var(--teal)"
          />
        </div>

        {/* Assigned Activities */}
        {assignedActivities.length > 0 && (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Assigned Activities</h2>
              <p className="text-muted" style={{ marginBottom: 0 }}>
                Activities assigned to you by Young Scientist Academy — not in the public library.
              </p>
            </div>
            <div style={{ marginBottom: '2rem' }}>
              {assignedActivities.map(act => (
                <Link key={act.id} to={`/activity/${act.id}`} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.6rem', borderLeft: '4px solid var(--teal)', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.97rem', color: 'var(--text)' }}>{act.title}</div>
                      {act.description && (
                        <p className="text-muted text-sm" style={{ marginBottom: 0, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      {act.grade_levels.map(g => (
                        <span key={g.id} className="badge badge--gray">{g.name}</span>
                      ))}
                      {act.duration_minutes > 0 && (
                        <span className="badge badge--gray">{act.duration_minutes} min</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Feedback */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Feedback</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Share your experience with Young Scientist Academy lessons and programs.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          <DashCard
            to="/teach-stem/project-reflection"
            title="Teacher STEM Project Reflection"
            description="Reflect on a STEM project you completed — success and engagement ratings, evidence of learning, student work, and your plans going forward."
            color="var(--teal)"
          />
        </div>

      </div>
    </div>
  )
}
