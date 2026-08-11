import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../api'

const ENJOYMENT_LABELS = {
  loved_it: 'Loved it',
  liked_it: 'Liked it',
  it_was_okay: 'It was okay',
  didnt_like_it_much: "Didn't like it much",
  didnt_enjoy_it: "Didn't enjoy it",
}

const CHALLENGE_LABELS = {
  much_too_easy: 'Much too easy',
  a_little_too_easy: 'A little too easy',
  just_right: 'Just right',
  a_little_too_difficult: 'A little too difficult',
  much_too_difficult: 'Much too difficult',
}

const ENJOYED_PARTS_LABELS = {
  designing_creating: 'Designing or creating something',
  solving_problems: 'Solving problems',
  working_with_group: 'Working with my group',
  hands_on: 'Doing hands-on activities',
  researching: 'Researching',
  testing_improving: 'Testing and improving ideas',
  presenting: 'Presenting my work',
}

const SKILLS_LABELS = {
  problem_solving: 'Problem-solving skills',
  critical_thinking: 'Critical thinking',
  creativity: 'Creativity',
  teamwork: 'Teamwork',
  communication: 'Communication',
  time_management: 'Time management',
  science_knowledge: 'Science knowledge',
  math_skills: 'Math skills',
  technology_skills: 'Technology skills',
  engineering_design: 'Engineering/design skills',
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.35rem' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function PillList({ items }) {
  if (!items?.length) return <p className="text-muted text-sm" style={{ margin: 0, fontStyle: 'italic' }}>None selected.</p>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {items.map((it, i) => <span key={i} className="badge badge--teal">{it}</span>)}
    </div>
  )
}

function RatingBar({ value, lowLabel, highLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span className="text-muted text-sm">{lowLabel}</span>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={{
            width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700,
            background: value === n ? 'var(--teal-dark)' : '#f0f0f0',
            color: value === n ? '#fff' : 'var(--text-muted)',
          }}>
            {n}
          </div>
        ))}
      </div>
      <span className="text-muted text-sm">{highLabel}</span>
    </div>
  )
}

function ResponseCard({ resp }) {
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
        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.85rem' }}>
          <Field label="Overall Enjoyment">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{ENJOYMENT_LABELS[resp.enjoyment] || resp.enjoyment || '—'}</p>
          </Field>
          <Field label="Challenge Level">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{CHALLENGE_LABELS[resp.challenge_level] || resp.challenge_level || '—'}</p>
          </Field>
          <Field label="Parts They Enjoyed Most">
            <PillList items={resp.enjoyed_parts?.map(v => ENJOYED_PARTS_LABELS[v] || v)} />
          </Field>
          <Field label="I Learned Something New">
            <RatingBar value={resp.learned_something_rating} lowLabel="Not really" highLabel="All the things!" />
          </Field>
          <Field label="This Project Helped Me Improve My...">
            <PillList items={resp.skills_improved?.map(v => SKILLS_LABELS[v] || v)} />
          </Field>
          <Field label="One Thing They Learned">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.one_thing_learned}</p>
          </Field>
          <Field label="Most Enjoyable Part">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.most_enjoyable_part}</p>
          </Field>
          <Field label="Biggest Challenge">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.biggest_challenge}</p>
          </Field>
          <Field label="What They Would Change">
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.change_one_thing}</p>
          </Field>
          <Field label="Wants to Do More STEM Projects Like This">
            <RatingBar value={resp.want_more_stem_rating} lowLabel="No — hard pass" highLabel="Absolutely!" />
          </Field>
          <Field label="Saw Real-World Connections">
            <RatingBar value={resp.real_world_connection_rating} lowLabel="Not really" highLabel="Yes!" />
          </Field>
          {resp.additional_comments && (
            <Field label="Anything Else">
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{resp.additional_comments}</p>
            </Field>
          )}
        </div>
      )}
    </div>
  )
}

export default function StudentReflectionResponses() {
  const { id } = useParams()
  const [assignment, setAssignment] = useState(null)
  const [responses, setResponses]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([
      api.get('student-reflections/assignments/'),
      api.get(`student-reflections/assignments/${id}/responses/`),
    ]).then(([list, resps]) => {
      const found = list.data.find(a => a.id === parseInt(id))
      setAssignment(found || null)
      setResponses(resps.data)
    }).catch(() => setError('Could not load responses.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page"><div className="container" style={{ marginTop: 80 }}>Loading...</div></div>
  if (error) return <div className="page"><div className="container" style={{ marginTop: 80, color: '#c62828' }}>{error}</div></div>

  const title = assignment?.title || (assignment?.activity_title ? `After: ${assignment.activity_title}` : 'STEM Project Reflection')

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
                Project: {assignment.activity_title}
              </p>
            )}
          </div>
          <Link to="/teach-stem/student-reflections" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'underline' }}>
            Back to Assignments
          </Link>
        </div>

        {responses.length === 0 && (
          <div className="empty"><p style={{ fontStyle: 'italic' }}>No student responses yet.</p></div>
        )}

        {responses.map(r => (
          <ResponseCard key={r.id} resp={r} />
        ))}
      </div>
    </div>
  )
}
