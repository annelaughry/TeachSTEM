import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const BLANK = {
  classroom_name: '',
  grade_level: '',
  num_students: '',
  standards: '',
  background_concepts: '',
  research_questions: ['', '', ''],
}

const STATUS_LABELS = {
  draft:     { label: 'Draft',               color: '#2D2D2D' },
  submitted: { label: 'Submitted for Review', color: 'var(--teal-dark)' },
  reviewed:  { label: 'Reviewed',             color: '#2e7d32' },
}

export default function ProjectTopics() {
  const [form, setForm]             = useState(BLANK)
  const [history, setHistory]       = useState([])
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savedId, setSavedId]       = useState(null)
  const [saveMsg, setSaveMsg]       = useState(null)
  const [error, setError]           = useState(null)
  const [expanded, setExpanded]     = useState(null)
  const [feedbackOpen, setFeedbackOpen] = useState({})

  useEffect(() => {
    api.get('teach-stem/project-topics/').then(r => {
      setHistory(r.data)
      if (r.data.length > 0) setExpanded(r.data[0].id)
    }).catch(() => {})
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const setQuestion = (i, value) => {
    setForm(f => {
      const qs = [...f.research_questions]
      qs[i] = value
      return { ...f, research_questions: qs }
    })
  }

  const addQuestion = () => setForm(f => ({ ...f, research_questions: [...f.research_questions, ''] }))

  const removeQuestion = (i) => {
    setForm(f => {
      const qs = f.research_questions.filter((_, idx) => idx !== i)
      return { ...f, research_questions: qs }
    })
  }

  const validate = (requireQuestions) => {
    if (requireQuestions) {
      const filled = form.research_questions.filter(q => q.trim())
      if (filled.length < 3) {
        setError('Please enter at least 3 research questions before submitting for review.')
        return false
      }
    }
    return true
  }

  const saveDraft = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload = { ...form, research_questions: form.research_questions.filter(q => q.trim()) }
      const { data } = await api.post('teach-stem/project-topics/', payload)
      setHistory(prev => [data, ...prev])
      setExpanded(data.id)
      setSavedId(data.id)
      setForm(BLANK)
      showMsg('Draft saved.')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setSaving(false) }
  }

  const submitForReview = async () => {
    setError(null)
    if (!validate(true)) return
    setSubmitting(true)
    try {
      // Save first, then submit
      const payload = { ...form, research_questions: form.research_questions.filter(q => q.trim()) }
      const { data: created } = await api.post('teach-stem/project-topics/', payload)
      const { data: submitted } = await api.post(`teach-stem/project-topics/${created.id}/submit/`)
      setHistory(prev => [submitted, ...prev])
      setExpanded(submitted.id)
      setForm(BLANK)
      showMsg('Submitted for review.')
    } catch (err) {
      const msg = err?.response?.data?.error
      setError(msg || 'Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  const submitExisting = async (id) => {
    setError(null)
    try {
      const { data } = await api.post(`teach-stem/project-topics/${id}/submit/`)
      setHistory(prev => prev.map(e => e.id === id ? data : e))
    } catch (err) {
      const msg = err?.response?.data?.error
      setError(msg || 'Something went wrong.')
    }
  }

  const showMsg = (msg) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>Project Topics</h1>
        <p>Plan your project by documenting class details, standards, and prerequisite concepts.</p>
      </div>

      <div className="container" style={{ maxWidth: 740, paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teach-stem" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Teach STEM Dashboard
          </Link>
        </div>

        {/* Form */}
        <div className="card" style={{ borderTop: '4px solid var(--teal)', marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>New Project Plan</h3>
          <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
            Complete all sections, then save as a draft or submit directly for admin review.
          </p>

          {saveMsg && (
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', color: '#2e7d32', fontWeight: 700 }}>
              {saveMsg}
            </div>
          )}

          {/* Class Details */}
          <SectionHeading>Class Details</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div>
              <label className="form-label">Class</label>
              <input type="text" className="form-input" value={form.classroom_name} onChange={e => set('classroom_name', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Grade Level</label>
              <input type="text" className="form-input" value={form.grade_level} onChange={e => set('grade_level', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Number of Students</label>
              <input type="text" className="form-input" value={form.num_students} onChange={e => set('num_students', e.target.value)} />
            </div>
          </div>

          {/* Standards */}
          <SectionHeading>Standards</SectionHeading>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Standards this project will cover</label>
            <textarea className="form-input" rows={4} value={form.standards} onChange={e => set('standards', e.target.value)} />
            <p className="text-muted text-sm" style={{ marginTop: '0.3rem' }}>List each standard on its own line or separate with commas.</p>
          </div>

          {/* Background Concepts */}
          <SectionHeading>Background Concepts</SectionHeading>
          <div style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Curriculum concepts students need before starting this project</label>
            <textarea className="form-input" rows={5} value={form.background_concepts} onChange={e => set('background_concepts', e.target.value)} />
            <p className="text-muted text-sm" style={{ marginTop: '0.3rem' }}>Describe the prerequisite knowledge and skills from the curriculum.</p>
          </div>

          {/* Research Questions */}
          <SectionHeading>Research Questions</SectionHeading>
          <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
            Brainstorm potential research questions for the final project. A minimum of 3 is required to submit for review.
          </p>
          <div style={{ marginBottom: '0.5rem' }}>
            {form.research_questions.map((q, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ paddingTop: '0.55rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
                  {i + 1}.
                </div>
                <textarea
                  className="form-input"
                  rows={2}
                  style={{ flex: 1 }}
                  value={q}
                  onChange={e => setQuestion(i, e.target.value)}
                />
                {form.research_questions.length > 3 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    style={{ marginTop: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem', flexShrink: 0 }}
                    title="Remove"
                  >×</button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addQuestion}
            className="btn btn--outline btn--sm"
            style={{ marginBottom: '1.75rem' }}
          >
            + Add another question
          </button>

          {/* Submit for Review notice */}
          <div style={{ background: '#f0faf8', border: '1px solid var(--teal-light)', borderRadius: 8, padding: '0.85rem 1.1rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: 'var(--teal-dark)' }}>
            Submitting for review sends this plan to an admin, who will provide feedback. You must have at least 3 research questions to submit.
          </div>

          {error && (
            <div style={{ color: '#c62828', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--outline" onClick={saveDraft} disabled={saving || submitting}>
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="button" className="btn btn--teal" onClick={submitForReview} disabled={saving || submitting}>
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>

        {/* Saved plans */}
        {history.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
              Saved Plans
            </div>
            {history.map(entry => {
              const statusMeta = STATUS_LABELS[entry.status] || STATUS_LABELS.draft
              return (
                <div key={entry.id} className="card" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                  {/* Header row */}
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {entry.classroom_name || 'Unnamed class'}
                        {entry.grade_level ? ` — ${entry.grade_level}` : ''}
                      </div>
                      <div className="text-muted text-sm" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.15rem' }}>
                        {entry.num_students && <span>{entry.num_students} students</span>}
                        <span>{new Date(entry.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span style={{ fontWeight: 800, color: statusMeta.color }}>{statusMeta.label}</span>
                      </div>
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', flexShrink: 0 }}>
                      {expanded === entry.id ? '▾' : '▸'}
                    </span>
                  </button>

                  {expanded === entry.id && (
                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)' }}>

                      {entry.standards && (
                        <EntrySection label="Standards">{entry.standards}</EntrySection>
                      )}
                      {entry.background_concepts && (
                        <EntrySection label="Background Concepts">{entry.background_concepts}</EntrySection>
                      )}
                      {entry.research_questions?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <EntryLabel>Research Questions</EntryLabel>
                          <ol style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                            {entry.research_questions.map((q, i) => (
                              <li key={i} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.3rem' }}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Admin feedback */}
                      {entry.admin_feedback && (
                        <div style={{ marginTop: '1.25rem', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '0.85rem 1rem' }}>
                          <EntryLabel style={{ color: '#2e7d32' }}>Admin Feedback</EntryLabel>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', color: '#1b5e20', marginTop: '0.3rem' }}>{entry.admin_feedback}</div>
                          {entry.reviewed_by_name && (
                            <div className="text-muted text-sm" style={{ marginTop: '0.4rem' }}>
                              Reviewed by {entry.reviewed_by_name}
                              {entry.reviewed_at ? ` on ${new Date(entry.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Submit draft for review */}
                      {entry.status === 'draft' && (
                        <button
                          type="button"
                          className="btn btn--teal btn--sm"
                          style={{ marginTop: '1rem' }}
                          onClick={() => submitExisting(entry.id)}
                        >
                          Submit for Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
      {children}
    </div>
  )
}

function EntryLabel({ children, style }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', ...style }}>
      {children}
    </div>
  )
}

function EntrySection({ label, children }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <EntryLabel>{label}</EntryLabel>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', color: '#333' }}>{children}</div>
    </div>
  )
}
