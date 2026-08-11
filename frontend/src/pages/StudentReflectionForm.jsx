import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

const ENJOYMENT_OPTIONS = [
  { value: 'loved_it',            label: 'Loved it' },
  { value: 'liked_it',            label: 'Liked it' },
  { value: 'it_was_okay',         label: 'It was okay' },
  { value: 'didnt_like_it_much',  label: "Didn't like it much" },
  { value: 'didnt_enjoy_it',      label: "Didn't enjoy it" },
]

const CHALLENGE_OPTIONS = [
  { value: 'much_too_easy',          label: 'Much too easy' },
  { value: 'a_little_too_easy',      label: 'A little too easy' },
  { value: 'just_right',             label: 'Just right' },
  { value: 'a_little_too_difficult', label: 'A little too difficult' },
  { value: 'much_too_difficult',     label: 'Much too difficult' },
]

const ENJOYED_PARTS_OPTIONS = [
  { value: 'designing_creating', label: 'Designing or creating something' },
  { value: 'solving_problems',   label: 'Solving problems' },
  { value: 'working_with_group', label: 'Working with my group' },
  { value: 'hands_on',           label: 'Doing hands-on activities' },
  { value: 'researching',        label: 'Researching' },
  { value: 'testing_improving',  label: 'Testing and improving ideas' },
  { value: 'presenting',         label: 'Presenting my work' },
]

const SKILLS_OPTIONS = [
  { value: 'problem_solving',    label: 'Problem-solving skills' },
  { value: 'critical_thinking',  label: 'Critical thinking' },
  { value: 'creativity',         label: 'Creativity' },
  { value: 'teamwork',           label: 'Teamwork' },
  { value: 'communication',      label: 'Communication' },
  { value: 'time_management',    label: 'Time management' },
  { value: 'science_knowledge',  label: 'Science knowledge' },
  { value: 'math_skills',        label: 'Math skills' },
  { value: 'technology_skills',  label: 'Technology skills' },
  { value: 'engineering_design', label: 'Engineering/design skills' },
]

const BLANK_FORM = {
  enjoyment: '',
  challenge_level: '',
  enjoyed_parts: [],
  learned_something_rating: '',
  skills_improved: [],
  one_thing_learned: '',
  most_enjoyable_part: '',
  biggest_challenge: '',
  change_one_thing: '',
  want_more_stem_rating: '',
  real_world_connection_rating: '',
  additional_comments: '',
}

function labelFor(options, value) {
  return options.find(o => o.value === value)?.label || value || '—'
}

function RadioGroup({ options, value, onChange, name }) {
  return (
    <div>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.1rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: 'var(--teal)', width: 17, height: 17, flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.92rem' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

function CheckboxGroup({ options, values, onToggle }) {
  return (
    <div>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={values.includes(opt.value)}
            onChange={() => onToggle(opt.value)}
            style={{ accentColor: 'var(--teal)', width: 17, height: 17, flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.92rem' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

function RatingScale({ value, onChange, lowLabel, highLabel, name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <span className="text-muted text-sm">{lowLabel}</span>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <label key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name={name}
              checked={value === n}
              onChange={() => onChange(n)}
              style={{ accentColor: 'var(--teal)', width: 20, height: 20 }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n}</span>
          </label>
        ))}
      </div>
      <span className="text-muted text-sm">{highLabel}</span>
    </div>
  )
}

function RatingRecap({ value, lowLabel, highLabel }) {
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

function RecapField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.35rem' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SubmittedView({ assignment, resp }) {
  const title = assignment?.title || (assignment?.activity_title ? `After: ${assignment.activity_title}` : 'STEM Project Reflection')
  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>STEM Project Reflection</h1>
        <p>{title}</p>
      </div>
      <div className="container" style={{ maxWidth: 680, paddingBottom: '3rem' }}>
        <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem' }}>
            Your reflection has been submitted. Thanks for sharing!
          </div>

          {resp && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <RecapField label="Overall Enjoyment"><p style={{ margin: 0 }}>{labelFor(ENJOYMENT_OPTIONS, resp.enjoyment)}</p></RecapField>
              <RecapField label="Challenge Level"><p style={{ margin: 0 }}>{labelFor(CHALLENGE_OPTIONS, resp.challenge_level)}</p></RecapField>
              <RecapField label="One Thing You Learned"><p style={{ margin: 0 }}>{resp.one_thing_learned}</p></RecapField>
              <RecapField label="Most Enjoyable Part"><p style={{ margin: 0 }}>{resp.most_enjoyable_part}</p></RecapField>
              <RecapField label="Biggest Challenge"><p style={{ margin: 0 }}>{resp.biggest_challenge}</p></RecapField>
              <RecapField label="What You Would Change"><p style={{ margin: 0 }}>{resp.change_one_thing}</p></RecapField>
              {resp.additional_comments && (
                <RecapField label="Anything Else"><p style={{ margin: 0 }}>{resp.additional_comments}</p></RecapField>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem' }}>
            <Link to="/student" className="btn btn--outline btn--sm">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StudentReflectionForm() {
  const { id } = useParams()

  const [assignment, setAssignment] = useState(null)
  const [existing, setExisting]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')
  const [form, setForm]             = useState(BLANK_FORM)

  useEffect(() => {
    Promise.all([
      api.get('student-reflections/student/'),
      api.get(`student-reflections/student/${id}/respond/`),
    ]).then(([list, resp]) => {
      const found = list.data.find(a => a.id === parseInt(id))
      setAssignment(found || null)
      if (resp.data && resp.data.id) setExisting(resp.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const toggleListField = (field, value) => setForm(f => ({
    ...f,
    [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const requiredText = ['one_thing_learned', 'most_enjoyable_part', 'biggest_challenge', 'change_one_thing']
    if (!form.enjoyment || !form.challenge_level) { setError('Please answer all required questions.'); return }
    if (!form.learned_something_rating || !form.want_more_stem_rating || !form.real_world_connection_rating) {
      setError('Please answer all required questions.')
      return
    }
    if (requiredText.some(f => !form[f].trim())) { setError('Please answer all required questions.'); return }

    setSubmitting(true)
    try {
      const { data } = await api.post(`student-reflections/student/${id}/respond/`, form)
      setExisting(data)
      setDone(true)
    } catch (err) {
      setError(err?.response?.data?.error || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="page"><div className="container" style={{ marginTop: 80 }}>Loading...</div></div>

  if (existing || done) return <SubmittedView assignment={assignment} resp={existing} />

  if (!assignment || !assignment.is_open) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 580, marginTop: 80 }}>
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              {!assignment ? 'This reflection was not found or is not assigned to your classroom.' : 'This reflection is closed.'}
            </p>
            <Link to="/student" className="btn btn--outline btn--sm">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const title = assignment.title || (assignment.activity_title ? `After: ${assignment.activity_title}` : 'STEM Project Reflection')

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>STEM Project Reflection</h1>
        <p>{title}</p>
      </div>

      <div className="container" style={{ maxWidth: 680, paddingBottom: '3rem' }}>
        <form onSubmit={handleSubmit}>

          {/* Your Experience */}
          <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
            <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '1rem' }}>Your Experience</h2>

            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>Overall, how much did you enjoy this STEM project?</p>
            <RadioGroup name="enjoyment" options={ENJOYMENT_OPTIONS} value={form.enjoyment} onChange={v => set('enjoyment', v)} />

            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '1.25rem 0 0.5rem' }}>How challenging was this project?</p>
            <RadioGroup name="challenge_level" options={CHALLENGE_OPTIONS} value={form.challenge_level} onChange={v => set('challenge_level', v)} />

            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '1.25rem 0 0.5rem' }}>Which parts of the project did you enjoy the most?</p>
            <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>Select all that apply.</p>
            <CheckboxGroup options={ENJOYED_PARTS_OPTIONS} values={form.enjoyed_parts} onToggle={v => toggleListField('enjoyed_parts', v)} />
          </div>

          {/* What You Learned */}
          <div className="card" style={{ marginTop: '1rem', padding: '1.75rem' }}>
            <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '1rem' }}>What You Learned</h2>

            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>I learned something new during this project.</p>
            <RatingScale
              name="learned_something_rating"
              value={form.learned_something_rating}
              onChange={v => set('learned_something_rating', v)}
              lowLabel="Not"
              highLabel="All the things!"
            />

            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '1.25rem 0 0.5rem' }}>This project helped me improve my...</p>
            <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>Select all that apply.</p>
            <CheckboxGroup options={SKILLS_OPTIONS} values={form.skills_improved} onToggle={v => toggleListField('skills_improved', v)} />
          </div>

          {/* Reflection */}
          <div className="card" style={{ marginTop: '1rem', padding: '1.75rem' }}>
            <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '1rem' }}>Reflection</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">What is one thing you learned from this project?</label>
              <textarea className="form-input" rows={2} value={form.one_thing_learned} onChange={e => set('one_thing_learned', e.target.value)} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">What was the most enjoyable part of this project?</label>
              <textarea className="form-input" rows={3} value={form.most_enjoyable_part} onChange={e => set('most_enjoyable_part', e.target.value)} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">What was the biggest challenge you faced?</label>
              <textarea className="form-input" rows={3} value={form.biggest_challenge} onChange={e => set('biggest_challenge', e.target.value)} />
            </div>
            <div>
              <label className="form-label">If you could change one thing about this project, what would it be?</label>
              <textarea className="form-input" rows={3} value={form.change_one_thing} onChange={e => set('change_one_thing', e.target.value)} />
            </div>
          </div>

          {/* Looking Ahead */}
          <div className="card" style={{ marginTop: '1rem', padding: '1.75rem' }}>
            <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '1rem' }}>Looking Ahead</h2>

            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>I would like to do more STEM projects like this in the future.</p>
            <RatingScale
              name="want_more_stem_rating"
              value={form.want_more_stem_rating}
              onChange={v => set('want_more_stem_rating', v)}
              lowLabel="No — Hard Pass"
              highLabel="Absolutely!"
            />

            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '1.25rem 0 0.5rem' }}>
              This project helped me see how what I learn in school connects to real-world problems.
            </p>
            <RatingScale
              name="real_world_connection_rating"
              value={form.real_world_connection_rating}
              onChange={v => set('real_world_connection_rating', v)}
              lowLabel="Not"
              highLabel="Yes!"
            />

            <div style={{ marginTop: '1.25rem' }}>
              <label className="form-label">Is there anything else you would like your teacher to know?</label>
              <textarea className="form-input" rows={3} value={form.additional_comments} onChange={e => set('additional_comments', e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.75rem 1rem', color: '#c62828', fontSize: '0.88rem', marginTop: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button type="submit" disabled={submitting} className="btn btn--primary">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <Link to="/student" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textDecoration: 'underline' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
