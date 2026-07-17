import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import { SECTIONS } from '../data/teacherSurvey'

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.3rem',
  cursor: 'pointer',
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  textAlign: 'center',
  lineHeight: 1.2,
  flex: 1,
  minWidth: 0,
}

function ScaleRow({ qKey, questionText, number, scale, value, onChange }) {
  return (
    <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ marginBottom: '0.65rem', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.45 }}>
        <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{number}.</span>
        {questionText}
      </div>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {scale.map((label, i) => {
          const val = i + 1
          const checked = value === val
          return (
            <label key={i} style={labelStyle}>
              <input
                type="radio"
                name={qKey}
                value={val}
                checked={checked}
                onChange={() => onChange(qKey, val)}
                style={{ accentColor: 'var(--teal)', width: 18, height: 18, flexShrink: 0 }}
              />
              {label}
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default function TeacherSurvey() {
  const [step, setStep]             = useState(0)
  const [responses, setResponses]   = useState({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)

  useEffect(() => {
    api.get('teacher-survey/')
      .then(r => {
        setResponses(r.data.responses || {})
        if (r.data.completed) setAlreadyDone(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const section = SECTIONS[step]

  const sectionAnswered = () => {
    return section.questions.every((_, qi) => {
      const key = `${section.id}_q${qi + 1}`
      return responses[key] != null
    })
  }

  const handleChange = (key, val) => {
    setSaved(false)
    setResponses(prev => ({ ...prev, [key]: val }))
  }

  const save = async (opts = {}) => {
    setSaving(true)
    setError('')
    try {
      await api.post('teacher-survey/', {
        responses,
        completed: opts.completed || false,
      })
      setSaved(true)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const goNext = async () => {
    await save()
    setStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goPrev = () => {
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await api.post('teacher-survey/', { responses, completed: true })
      setDone(true)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalQ = SECTIONS.reduce((sum, s) => sum + s.questions.length, 0)
  const answeredQ = Object.keys(responses).length

  if (loading) return <div className="page"><div className="container" style={{ marginTop: 80, textAlign: 'center' }}>Loading...</div></div>

  if (done) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 680, marginTop: 80, paddingBottom: '3rem' }}>
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
            <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.75rem' }}>Survey Complete</h2>
            <p style={{ marginBottom: '1.5rem' }}>Thank you for completing the Teacher Survey. Your responses have been recorded.</p>
            <Link to="/teacher" className="btn btn--primary">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  if (alreadyDone) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 680, marginTop: 80, paddingBottom: '3rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '0.85rem 1rem', marginBottom: '1.5rem', color: '#2e7d32', fontSize: '0.9rem', fontWeight: 600 }}>
              You have already completed this survey.
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>You can review and update your responses below. Submitting again will overwrite your previous answers.</p>
            <button onClick={() => setAlreadyDone(false)} className="btn btn--primary" style={{ marginRight: '0.75rem' }}>Review Responses</button>
            <Link to="/teacher" className="btn btn--outline">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const isLast = step === SECTIONS.length - 1

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)', paddingBottom: '1.5rem' }}>
        <h1>Teacher Survey</h1>
        <p style={{ marginBottom: '0.5rem' }}>Friday Institute for Educational Innovation</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.85rem', opacity: 0.9 }}>
          <span>Section {step + 1} of {SECTIONS.length}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span>{answeredQ} of {totalQ} questions answered</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)' }}>
        <div style={{ height: '100%', background: 'var(--teal)', width: `${(step / SECTIONS.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      {/* Section tabs */}
      <div style={{ background: '#f8f9fa', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { save(); setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{
                padding: '0.6rem 0.85rem',
                background: 'none',
                border: 'none',
                borderBottom: i === step ? '3px solid var(--teal)' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: i === step ? 800 : 500,
                color: i === step ? 'var(--teal-dark)' : 'var(--text-muted)',
                fontSize: '0.78rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="container" style={{ maxWidth: 780, paddingTop: '2rem', paddingBottom: '4rem' }}>

        <div className="card" style={{ padding: '2rem' }}>
          <h2 style={{ color: 'var(--teal-dark)', marginBottom: '0.5rem', fontSize: '1.15rem' }}>
            Section {step + 1}: {section.title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: section.prompt ? '0.5rem' : '1.5rem' }}>
            {section.directions}
          </p>
          {section.prompt && (
            <p style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '0.92rem' }}>
              {section.prompt}
            </p>
          )}

          {/* Scale legend */}
          <div style={{ background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 6, padding: '0.65rem 1rem', marginBottom: '1.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
            {section.scale.map((label, i) => (
              <span key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--teal-dark)', marginRight: '0.25rem' }}>{i + 1}</strong>
                {label}
              </span>
            ))}
          </div>

          {section.questions.map((q, qi) => {
            const key = `${section.id}_q${qi + 1}`
            return (
              <ScaleRow
                key={key}
                qKey={key}
                questionText={q}
                number={qi + 1}
                scale={section.scale}
                value={responses[key] ?? null}
                onChange={handleChange}
              />
            )
          })}
        </div>

        {error && (
          <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.75rem 1rem', color: '#c62828', fontSize: '0.88rem', marginTop: '1rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {step > 0 && (
              <button onClick={goPrev} className="btn btn--outline">Previous</button>
            )}
            <button onClick={() => save()} disabled={saving} className="btn btn--outline" style={{ fontSize: '0.85rem' }}>
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Progress'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/teacher" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>Exit to Dashboard</Link>
            {!isLast && (
              <button onClick={goNext} disabled={saving} className="btn btn--primary">
                {saving ? 'Saving...' : 'Next Section'}
              </button>
            )}
            {isLast && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !sectionAnswered()}
                className="btn btn--primary"
                title={!sectionAnswered() ? 'Please answer all questions in this section before submitting.' : ''}
              >
                {submitting ? 'Submitting...' : 'Submit Survey'}
              </button>
            )}
          </div>
        </div>

        {isLast && !sectionAnswered() && (
          <p style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Answer all questions in this section to enable submission.
          </p>
        )}
      </div>
    </div>
  )
}
