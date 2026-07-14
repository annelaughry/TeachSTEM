import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const BLANK_FORM = {
  activity_name: '',
  student_count: '',
  grade_level_name: '',
  classroom_name: '',
  most_engaging: '',
  adaptations: '',
  struggled_section: '',
}

export default function LessonFeedbackSurvey() {
  const [form, setForm]           = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.student_count || parseInt(form.student_count) < 1) {
      setError('Please enter a valid student count.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('teach-stem/lesson-feedback/', {
        activity_name: form.activity_name,
        student_count: parseInt(form.student_count),
        grade_level_name: form.grade_level_name,
        classroom_name: form.classroom_name,
        most_engaging: form.most_engaging,
        adaptations: form.adaptations,
        struggled_section: form.struggled_section,
      })
      setForm(BLANK_FORM)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>Lesson Feedback Survey</h1>
        <p>Share how a lesson went in your classroom.</p>
      </div>

      <div className="container" style={{ maxWidth: 680, paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teach-stem" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Teach STEM Dashboard
          </Link>
        </div>

        {submitted ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--teal-dark)', marginBottom: '0.5rem' }}>
              Feedback submitted
            </div>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Thank you for sharing your experience.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setSubmitted(false)} className="btn btn--teal">Submit another</button>
              <Link to="/teach-stem" className="btn btn--outline">Back to Dashboard</Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                Lesson Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label className="form-label">Lesson</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.activity_name}
                    onChange={e => set('activity_name', e.target.value)}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="form-label">Number of Students *</label>
                  <input
                    type="number" min="1"
                    className="form-input"
                    value={form.student_count}
                    onChange={e => set('student_count', e.target.value)}
                    placeholder=""
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Grade Level</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.grade_level_name}
                    onChange={e => set('grade_level_name', e.target.value)}
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="form-label">Classroom</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.classroom_name}
                    onChange={e => set('classroom_name', e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.75rem' }}>
                Reflection
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">What aspects of the activity were the most engaging for students?</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.most_engaging}
                  onChange={e => set('most_engaging', e.target.value)}
                  placeholder=""
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Did you adapt or change the lesson? If so, how?</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.adaptations}
                  onChange={e => set('adaptations', e.target.value)}
                  placeholder=""
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">What section did students struggle with the most?</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.struggled_section}
                  onChange={e => set('struggled_section', e.target.value)}
                  placeholder=""
                />
              </div>

              {error && (
                <div style={{ color: '#c62828', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn--teal" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
