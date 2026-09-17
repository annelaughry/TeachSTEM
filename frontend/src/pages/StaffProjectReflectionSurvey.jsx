import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const SUCCESS_OPTIONS = [
  { value: 'very_successful',     label: 'Very Successful' },
  { value: 'successful',          label: 'Successful' },
  { value: 'somewhat_successful', label: 'Somewhat Successful' },
  { value: 'not_very_successful', label: 'Not Very Successful' },
  { value: 'unsuccessful',        label: 'Unsuccessful' },
]

const ENGAGEMENT_OPTIONS = [
  { value: 'highly_engaged',    label: 'Highly engaged throughout' },
  { value: 'mostly_engaged',    label: 'Mostly engaged' },
  { value: 'mixed',             label: 'Mixed engagement' },
  { value: 'mostly_disengaged', label: 'Mostly disengaged' },
  { value: 'not_engaged',       label: 'Not engaged' },
]

const FUTURE_PLAN_OPTIONS = [
  { value: 'teach_again_no_changes', label: 'I plan to do it again without major changes.' },
  { value: 'revise_and_teach_again', label: 'I plan to revise and do it again.' },
  { value: 'expand_project',         label: 'I plan to expand the project.' },
  { value: 'collaborate',            label: 'I plan to collaborate with someone else.' },
  { value: 'not_use_again',          label: 'I do not plan to use this project again.' },
]

const BLANK_FORM = {
  project_name: '',
  success_rating: '',
  engagement: '',
  evidence_of_learning: '',
  improvements: '',
  future_plans: [],
  additional_comments: '',
}

export default function StaffProjectReflectionSurvey() {
  const [form, setForm]             = useState(BLANK_FORM)
  const [studentWorkFiles, setStudentWorkFiles]     = useState([])
  const [supportingFiles, setSupportingFiles]       = useState([])
  const studentWorkInputRef = useRef(null)
  const supportingInputRef  = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const toggleFuturePlan = (value) => setForm(f => ({
    ...f,
    future_plans: f.future_plans.includes(value)
      ? f.future_plans.filter(v => v !== value)
      : [...f.future_plans, value],
  }))

  const pickFiles = (e, setFn) => {
    const picked = Array.from(e.target.files)
    setFn(prev => [...prev, ...picked])
    e.target.value = ''
  }
  const removeFile = (idx, setFn) => setFn(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.project_name.trim()) {
      setError('Please tell us which project you implemented.')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('project_name', form.project_name)
      fd.append('success_rating', form.success_rating)
      fd.append('engagement', form.engagement)
      fd.append('evidence_of_learning', form.evidence_of_learning)
      fd.append('improvements', form.improvements)
      fd.append('future_plans', JSON.stringify(form.future_plans))
      fd.append('additional_comments', form.additional_comments)
      studentWorkFiles.forEach(f => fd.append('student_work_files', f))
      supportingFiles.forEach(f => fd.append('supporting_material_files', f))

      await api.post('program-staff/project-reflections/', fd)
      setForm(BLANK_FORM)
      setStudentWorkFiles([])
      setSupportingFiles([])
      setSubmitted(true)
    } catch (err) {
      const msg = err?.response?.data?.error
      setError(msg || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--yellow) 0%, var(--yellow-dark) 100%)' }}>
        <h1>Staff Project Reflection</h1>
        <p>Thank you for completing this project! Your feedback helps improve future experiences.</p>
      </div>

      <div className="container" style={{ maxWidth: 700, paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/program-staff" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Staff Dashboard
          </Link>
        </div>

        {submitted ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--yellow-dark)', marginBottom: '0.5rem' }}>
              Reflection submitted
            </div>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Thank you for sharing your experience.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setSubmitted(false)} className="btn btn--yellow">Submit another</button>
              <Link to="/program-staff" className="btn btn--outline">Back to Dashboard</Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <form onSubmit={handleSubmit}>

              {/* Project */}
              <SectionHeading>Which project did you implement? *</SectionHeading>
              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  value={form.project_name}
                  onChange={e => set('project_name', e.target.value)}
                  required
                />
              </div>

              {/* Success rating */}
              <SectionHeading>Overall, how successful was this project? *</SectionHeading>
              <RadioGroup
                name="success_rating"
                options={SUCCESS_OPTIONS}
                value={form.success_rating}
                onChange={v => set('success_rating', v)}
              />

              {/* Engagement */}
              <SectionHeading>Which of the following best describes engagement during the project? *</SectionHeading>
              <RadioGroup
                name="engagement"
                options={ENGAGEMENT_OPTIONS}
                value={form.engagement}
                onChange={v => set('engagement', v)}
              />

              {/* Evidence of learning */}
              <SectionHeading>What evidence did you observe that the learning goals were met? *</SectionHeading>
              <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
                Examples: quality of discussions, final products, collaboration, assessments, problem solving, etc.
              </p>
              <div style={{ marginBottom: '1.5rem' }}>
                <textarea
                  className="form-input"
                  rows={4}
                  value={form.evidence_of_learning}
                  onChange={e => set('evidence_of_learning', e.target.value)}
                />
              </div>

              {/* Improvements */}
              <SectionHeading>If you did this project again, what would you change or improve? *</SectionHeading>
              <div style={{ marginBottom: '1.5rem' }}>
                <textarea
                  className="form-input"
                  rows={4}
                  value={form.improvements}
                  onChange={e => set('improvements', e.target.value)}
                />
              </div>

              {/* Student work examples */}
              <SectionHeading>Please upload examples of work from this project</SectionHeading>
              <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
                Names should be removed whenever possible. Photos, PDFs, docs, slides, or videos are all fine.
              </p>
              <FileUploader
                files={studentWorkFiles}
                inputRef={studentWorkInputRef}
                onPick={e => pickFiles(e, setStudentWorkFiles)}
                onRemove={idx => removeFile(idx, setStudentWorkFiles)}
                buttonLabel="+ Upload work examples"
              />

              {/* Supporting materials */}
              <SectionHeading>Please upload any supporting materials you created or modified</SectionHeading>
              <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
                Examples: plans, rubrics, handouts, presentations, or assessments.
              </p>
              <FileUploader
                files={supportingFiles}
                inputRef={supportingInputRef}
                onPick={e => pickFiles(e, setSupportingFiles)}
                onRemove={idx => removeFile(idx, setSupportingFiles)}
                buttonLabel="+ Upload supporting materials"
              />

              {/* Future plans */}
              <SectionHeading>What are your plans for this project in the future? *</SectionHeading>
              <div style={{ marginBottom: '1.75rem' }}>
                {FUTURE_PLAN_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.5rem 0.1rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.future_plans.includes(opt.value)}
                      onChange={() => toggleFuturePlan(opt.value)}
                      style={{ accentColor: 'var(--yellow)', width: 17, height: 17, marginTop: '0.15rem', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: '0.92rem' }}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {/* Anything else */}
              <SectionHeading>Is there anything else you would like to share? *</SectionHeading>
              <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>
                Resources you need, professional development ideas, challenges, successes, or recommendations.
              </p>
              <div style={{ marginBottom: '1.5rem' }}>
                <textarea
                  className="form-input"
                  rows={4}
                  value={form.additional_comments}
                  onChange={e => set('additional_comments', e.target.value)}
                />
              </div>

              {error && (
                <div style={{ color: '#c62828', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn btn--yellow" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Reflection'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.6rem' }}>
      {children}
    </div>
  )
}

function RadioGroup({ name, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.1rem', cursor: 'pointer' }}>
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: 'var(--yellow)', width: 17, height: 17, flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.92rem' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

function FileUploader({ files, inputRef, onPick, onRemove, buttonLabel }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {files.length > 0 && (
        <div style={{ marginBottom: '0.6rem' }}>
          {files.map((f, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.7rem', marginBottom: '0.35rem' }}>
              <span style={{ flex: 1, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button
                type="button"
                onClick={() => onRemove(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1, padding: '0.1rem 0.2rem', flexShrink: 0 }}
                title="Remove"
              >×</button>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={onPick} />
      <button type="button" onClick={() => inputRef.current?.click()} className="btn btn--outline btn--sm">
        {buttonLabel}
      </button>
    </div>
  )
}
