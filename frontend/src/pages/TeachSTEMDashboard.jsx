import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

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

export default function TeachSTEMDashboard() {
  const [tasks, setTasks]                       = useState([])
  const [toggling, setToggling]                 = useState({})
  const [showDone, setShowDone]                 = useState(false)
  const [assignedActivities, setAssignedActivities] = useState([])

  useEffect(() => {
    api.get('teach-stem/tasks/').then(r => setTasks(r.data)).catch(() => {})
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
                  <div style={{ fontWeight: 800, fontSize: '0.97rem', marginBottom: task.description ? '0.2rem' : 0 }}>{task.title}</div>
                  {task.description && (
                    <p className="text-muted text-sm" style={{ marginBottom: '0.3rem' }}>{task.description}</p>
                  )}
                  {task.due_date && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: overdue ? '#c62828' : 'var(--teal-dark)' }}>
                      Due {formatDate(task.due_date)}{overdue ? ' — overdue' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => markComplete(task.id)}
                  disabled={toggling[task.id]}
                  className="btn btn--outline btn--sm"
                  style={{ flexShrink: 0 }}
                >
                  {toggling[task.id] ? '...' : 'Mark Complete'}
                </button>
              </div>
            )
          })}

          {showDone && completed.map(task => (
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

        {/* Formative Assessment */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>Formative Assessment</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Quick assessments to check for student understanding after activities.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/teach-stem/321"
            title="3-2-1 Exit Tickets"
            description="Assign a 3-2-1 reflection after any activity — three things learned, two questions, one most interesting thing."
            color="var(--teal)"
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
            to="/teach-stem/lesson-feedback"
            title="Lesson Feedback Survey"
            description="Report on a lesson you completed — what engaged students, what you adapted, and where students struggled."
            color="var(--teal)"
          />
        </div>

      </div>
    </div>
  )
}
