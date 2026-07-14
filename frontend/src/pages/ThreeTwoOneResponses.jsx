import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ResponseCard({ resp, isVideo }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: '0.65rem', borderLeft: '4px solid var(--teal)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <span style={{ fontWeight: 800, fontSize: '0.97rem' }}>{resp.student_name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>{formatDate(resp.submitted_at)}</span>
        </div>
        <span style={{ fontSize: '0.82rem', color: 'var(--teal-dark)', fontWeight: 700, userSelect: 'none' }}>
          {open ? 'Collapse' : 'View'}
        </span>
      </div>

      {open && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
          {isVideo ? (
            resp.response_video ? (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.5rem' }}>
                  Video Response
                </div>
                <video
                  src={resp.response_video}
                  controls
                  style={{ width: '100%', maxHeight: 400, borderRadius: 6, background: '#000' }}
                />
              </div>
            ) : (
              <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>No video on file.</p>
            )
          ) : (
            <>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.35rem' }}>
                  3 Things Learned
                </div>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li style={{ fontSize: '0.9rem' }}>{resp.learned_1}</li>
                  <li style={{ fontSize: '0.9rem' }}>{resp.learned_2}</li>
                  <li style={{ fontSize: '0.9rem' }}>{resp.learned_3}</li>
                </ol>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.35rem' }}>
                  2 Questions
                </div>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li style={{ fontSize: '0.9rem' }}>{resp.question_1}</li>
                  <li style={{ fontSize: '0.9rem' }}>{resp.question_2}</li>
                </ol>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.35rem' }}>
                  1 Most Interesting Thing
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.most_interesting}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ThreeTwoOneResponses() {
  const { id } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [responses, setResponses]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([
      api.get('321/assignments/'),
      api.get(`321/assignments/${id}/responses/`),
    ]).then(([list, resps]) => {
      const found = list.data.find(a => a.id === parseInt(id))
      setAssignment(found || null)
      setResponses(resps.data)
    }).catch(() => setError('Could not load responses.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page"><div className="container" style={{ marginTop: 80 }}>Loading...</div></div>
  if (error) return <div className="page"><div className="container" style={{ marginTop: 80, color: '#c62828' }}>{error}</div></div>

  const title = assignment?.title || (assignment?.activity_title ? `After: ${assignment.activity_title}` : '3-2-1 Assessment')

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>{title}</h1>
        <p>{responses.length} {responses.length === 1 ? 'response' : 'responses'} &mdash; {assignment?.is_open ? 'Open' : 'Closed'}</p>
      </div>

      <div className="container" style={{ maxWidth: 780, paddingBottom: '3rem' }}>
        <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            {assignment?.classroom_names?.length > 0 && (
              <p className="text-muted text-sm" style={{ marginBottom: 0 }}>
                Classrooms: {assignment.classroom_names.join(', ')}
              </p>
            )}
            {assignment?.activity_title && (
              <p className="text-muted text-sm" style={{ marginBottom: 0 }}>
                Activity: {assignment.activity_title}
              </p>
            )}
          </div>
          <Link to="/teach-stem/321" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'underline' }}>
            Back to Assignments
          </Link>
        </div>

        {responses.length === 0 && (
          <div className="empty"><p style={{ fontStyle: 'italic' }}>No student responses yet.</p></div>
        )}

        {responses.map(r => (
          <ResponseCard key={r.id} resp={r} isVideo={assignment?.response_type === 'video'} />
        ))}
      </div>
    </div>
  )
}
