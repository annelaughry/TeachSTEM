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

export default function StaffDashboard() {
  const [tasks, setTasks]       = useState([])
  const [toggling, setToggling] = useState({})
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    api.get('program-staff/tasks/').then(r => setTasks(r.data)).catch(() => {})
  }, [])

  const markComplete = async (taskId) => {
    setToggling(t => ({ ...t, [taskId]: true }))
    try {
      const { data } = await api.post(`program-staff/tasks/${taskId}/complete/`)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: data.completed } : t))
    } finally {
      setToggling(t => ({ ...t, [taskId]: false }))
    }
  }

  const pending   = tasks.filter(t => !t.completed)
  const completed = tasks.filter(t => t.completed)

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--yellow) 0%, var(--yellow-dark) 100%)' }}>
        <h1>Staff Dashboard</h1>
        <p>Tools and resources for Staff Program members.</p>
      </div>

      <div className="container" style={{ maxWidth: 780, paddingBottom: '3rem' }}>

        {/* Profile */}
        <div style={{ marginTop: '2rem', marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--yellow-dark)', marginBottom: '0.25rem' }}>Profile</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>Your Staff member information.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/program-staff/profile"
            title="My Profile"
            description="Update your name, school, subject/role, and experience."
            color="var(--yellow-dark)"
          />
        </div>

        {/* Tasks */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--yellow-dark)', marginBottom: '0.25rem' }}>Tasks</h2>
            <p className="text-muted" style={{ marginBottom: 0 }}>Items to complete as a Staff member.</p>
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
              <div key={task.id} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '0.65rem', borderLeft: `4px solid ${overdue ? '#c62828' : 'var(--yellow)'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.97rem', marginBottom: task.description ? '0.2rem' : 0 }}>{task.title}</div>
                  {task.description && (
                    <p className="text-muted text-sm" style={{ marginBottom: '0.3rem' }}>{task.description}</p>
                  )}
                  {task.due_date && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: overdue ? '#c62828' : 'var(--yellow-dark)' }}>
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
          <h2 style={{ color: 'var(--yellow-dark)', marginBottom: '0.25rem' }}>Project Planning Resources</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Tools to help you plan and structure your projects.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <DashCard
            to="/program-staff/project-topics"
            title="Project Topics"
            description="Document project details, standards, and the background concepts needed before starting a project."
            color="var(--yellow)"
          />
          <DashCard
            to="/program-staff/project-starter"
            title="Project Starter Builder"
            description="Build a custom project guide with an overview, competencies, getting-started steps, and tips — then submit it to admin for review."
            color="var(--yellow-dark)"
          />
        </div>

        {/* Feedback */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ color: 'var(--yellow-dark)', marginBottom: '0.25rem' }}>Feedback</h2>
          <p className="text-muted" style={{ marginBottom: 0 }}>
            Share your experience with Young Scientist Academy projects and programs.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          <DashCard
            to="/program-staff/project-reflection"
            title="Staff Project Reflection"
            description="Reflect on a project you completed — success and engagement ratings, evidence of learning, supporting work, and your plans going forward."
            color="var(--yellow)"
          />
        </div>

      </div>
    </div>
  )
}
