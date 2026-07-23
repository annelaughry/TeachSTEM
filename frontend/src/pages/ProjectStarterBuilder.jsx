import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

const BLANK = {
  id: null,
  title: '',
  overview: '',
  competencies: [{ skill: '', description: '' }],
  steps: [{ heading: '', items: [''] }],
  tips: [''],
}

const STATUS_LABELS = {
  draft:     { label: 'Draft',               color: '#2D2D2D' },
  submitted: { label: 'Submitted for Review', color: 'var(--teal-dark)' },
  reviewed:  { label: 'Reviewed',             color: '#2e7d32' },
}

function toForm(entry) {
  return {
    id: entry.id,
    title: entry.title || '',
    overview: entry.overview || '',
    competencies: entry.competencies?.length ? entry.competencies : [{ skill: '', description: '' }],
    steps: entry.steps?.length ? entry.steps.map(s => ({ heading: s.heading || '', items: s.items?.length ? s.items : [''] })) : [{ heading: '', items: [''] }],
    tips: entry.tips?.length ? entry.tips : [''],
  }
}

function cleanPayload(form) {
  return {
    title: form.title.trim(),
    overview: form.overview.trim(),
    competencies: form.competencies
      .map(c => ({ skill: c.skill.trim(), description: c.description.trim() }))
      .filter(c => c.skill || c.description),
    steps: form.steps
      .map(s => ({ heading: s.heading.trim(), items: s.items.map(i => i.trim()).filter(Boolean) }))
      .filter(s => s.heading || s.items.length > 0),
    tips: form.tips.map(t => t.trim()).filter(Boolean),
  }
}

export default function ProjectStarterBuilder() {
  const [form, setForm]             = useState(BLANK)
  const [history, setHistory]       = useState([])
  const [saving, setSaving]         = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveMsg, setSaveMsg]       = useState(null)
  const [error, setError]           = useState(null)
  const [expanded, setExpanded]     = useState(null)

  useEffect(() => {
    api.get('teach-stem/project-starters/').then(r => {
      setHistory(r.data)
    }).catch(() => {})
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Competencies
  const setCompetency = (i, field, value) => setForm(f => {
    const rows = [...f.competencies]
    rows[i] = { ...rows[i], [field]: value }
    return { ...f, competencies: rows }
  })
  const addCompetency = () => setForm(f => ({ ...f, competencies: [...f.competencies, { skill: '', description: '' }] }))
  const removeCompetency = (i) => setForm(f => ({ ...f, competencies: f.competencies.filter((_, idx) => idx !== i) }))

  // Steps
  const setStepHeading = (i, value) => setForm(f => {
    const steps = [...f.steps]
    steps[i] = { ...steps[i], heading: value }
    return { ...f, steps }
  })
  const addStep = () => setForm(f => ({ ...f, steps: [...f.steps, { heading: '', items: [''] }] }))
  const removeStep = (i) => setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
  const setStepItem = (si, ii, value) => setForm(f => {
    const steps = [...f.steps]
    const items = [...steps[si].items]
    items[ii] = value
    steps[si] = { ...steps[si], items }
    return { ...f, steps }
  })
  const addStepItem = (si) => setForm(f => {
    const steps = [...f.steps]
    steps[si] = { ...steps[si], items: [...steps[si].items, ''] }
    return { ...f, steps }
  })
  const removeStepItem = (si, ii) => setForm(f => {
    const steps = [...f.steps]
    steps[si] = { ...steps[si], items: steps[si].items.filter((_, idx) => idx !== ii) }
    return { ...f, steps }
  })

  // Tips
  const setTip = (i, value) => setForm(f => {
    const tips = [...f.tips]
    tips[i] = value
    return { ...f, tips }
  })
  const addTip = () => setForm(f => ({ ...f, tips: [...f.tips, ''] }))
  const removeTip = (i) => setForm(f => ({ ...f, tips: f.tips.filter((_, idx) => idx !== i) }))

  const showMsg = (msg) => {
    setSaveMsg(msg)
    setTimeout(() => setSaveMsg(null), 4000)
  }

  const saveDraft = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload = cleanPayload(form)
      if (form.id) {
        const { data } = await api.put(`teach-stem/project-starters/${form.id}/`, payload)
        setHistory(prev => prev.map(e => e.id === data.id ? data : e))
      } else {
        const { data } = await api.post('teach-stem/project-starters/', payload)
        setHistory(prev => [data, ...prev])
        setForm(f => ({ ...f, id: data.id }))
      }
      showMsg('Draft saved.')
    } catch { setError('Something went wrong. Please try again.') }
    finally { setSaving(false) }
  }

  const submitForReview = async () => {
    setError(null)
    if (!form.title.trim()) {
      setError('Please enter a title before submitting for review.')
      return
    }
    setSubmitting(true)
    try {
      const payload = cleanPayload(form)
      let id = form.id
      if (id) {
        const { data } = await api.put(`teach-stem/project-starters/${id}/`, payload)
        setHistory(prev => prev.map(e => e.id === data.id ? data : e))
      } else {
        const { data: created } = await api.post('teach-stem/project-starters/', payload)
        id = created.id
        setHistory(prev => [created, ...prev])
      }
      const { data: submitted } = await api.post(`teach-stem/project-starters/${id}/submit/`)
      setHistory(prev => prev.map(e => e.id === submitted.id ? submitted : e))
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
      const { data } = await api.post(`teach-stem/project-starters/${id}/submit/`)
      setHistory(prev => prev.map(e => e.id === id ? data : e))
    } catch (err) {
      const msg = err?.response?.data?.error
      setError(msg || 'Something went wrong.')
    }
  }

  const editEntry = (entry) => {
    setForm(toForm(entry))
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const newBlank = () => {
    setForm(BLANK)
    setError(null)
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>Project Starter Builder</h1>
        <p>Draft a custom project guide — overview, competencies, getting-started steps, and tips — then submit it to admin for review.</p>
      </div>

      <div className="container" style={{ maxWidth: 780, paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teach-stem" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Teach STEM Dashboard
          </Link>
        </div>

        {/* Form */}
        <div className="card" style={{ borderTop: '4px solid var(--teal)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h3 style={{ color: 'var(--teal-dark)', marginBottom: '0.25rem' }}>
                {form.id ? 'Editing Draft' : 'New Project Starter'}
              </h3>
              <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
                Fill in as many sections as apply. Save as a draft anytime, or submit for admin review when ready.
              </p>
            </div>
            {form.id && (
              <button type="button" className="btn btn--outline btn--sm" onClick={newBlank}>
                + Start New
              </button>
            )}
          </div>

          {saveMsg && (
            <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', color: '#2e7d32', fontWeight: 700 }}>
              {saveMsg}
            </div>
          )}

          {/* Title & Overview */}
          <SectionHeading>Title</SectionHeading>
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Backyard Biodiversity Survey"
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          <SectionHeading>Project Overview</SectionHeading>
          <div style={{ marginBottom: '1.5rem' }}>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Briefly describe what students will build, investigate, or create."
              value={form.overview}
              onChange={e => set('overview', e.target.value)}
            />
          </div>

          {/* Competencies */}
          <SectionHeading>Project Competencies</SectionHeading>
          <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
            The skills students will practice — e.g. "Coding with Python", "Circuit Design".
          </p>
          {form.competencies.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <div style={{ flex: '0 0 180px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Skill name"
                  value={c.skill}
                  onChange={e => setCompetency(i, 'skill', e.target.value)}
                />
              </div>
              <textarea
                className="form-input"
                rows={2}
                style={{ flex: 1 }}
                placeholder="What will students gain from this?"
                value={c.description}
                onChange={e => setCompetency(i, 'description', e.target.value)}
              />
              {form.competencies.length > 1 && (
                <RemoveButton onClick={() => removeCompetency(i)} />
              )}
            </div>
          ))}
          <AddButton onClick={addCompetency}>+ Add competency</AddButton>

          {/* Getting Started Steps */}
          <div style={{ marginTop: '1.75rem' }}>
            <SectionHeading>Getting Started</SectionHeading>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              Break the project into major steps. Each step can have its own sub-tasks.
            </p>
            {form.steps.map((step, si) => (
              <div key={si} className="card" style={{ background: '#fafafa', marginBottom: '0.75rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ fontWeight: 800, color: 'var(--teal-dark)', flexShrink: 0 }}>{si + 1}.</div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontWeight: 700 }}
                    placeholder="Step heading, e.g. Set Up the Hardware"
                    value={step.heading}
                    onChange={e => setStepHeading(si, e.target.value)}
                  />
                  {form.steps.length > 1 && <RemoveButton onClick={() => removeStep(si)} />}
                </div>
                <div style={{ marginLeft: '1.5rem' }}>
                  {step.items.map((item, ii) => (
                    <div key={ii} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: 1 }}
                        placeholder="Sub-task detail"
                        value={item}
                        onChange={e => setStepItem(si, ii, e.target.value)}
                      />
                      {step.items.length > 1 && <RemoveButton onClick={() => removeStepItem(si, ii)} />}
                    </div>
                  ))}
                  <AddButton onClick={() => addStepItem(si)}>+ Add sub-task</AddButton>
                </div>
              </div>
            ))}
            <AddButton onClick={addStep}>+ Add step</AddButton>
          </div>

          {/* Tips for Success */}
          <div style={{ marginTop: '1.75rem' }}>
            <SectionHeading>Tips for Success</SectionHeading>
            {form.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="A short piece of advice for students or teachers"
                  value={tip}
                  onChange={e => setTip(i, e.target.value)}
                />
                {form.tips.length > 1 && <RemoveButton onClick={() => removeTip(i)} />}
              </div>
            ))}
            <AddButton onClick={addTip}>+ Add tip</AddButton>
          </div>

          {/* Submit for Review notice */}
          <div style={{ background: '#f0faf8', border: '1px solid var(--teal-light)', borderRadius: 8, padding: '0.85rem 1.1rem', marginTop: '1.75rem', marginBottom: '1.25rem', fontSize: '0.88rem', color: 'var(--teal-dark)' }}>
            Submitting for review sends this project starter to an admin, who will provide feedback. A title is required to submit.
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

        {/* Saved starters */}
        {history.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
              Saved Project Starters
            </div>
            {history.map(entry => {
              const statusMeta = STATUS_LABELS[entry.status] || STATUS_LABELS.draft
              return (
                <div key={entry.id} className="card" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {entry.title || 'Untitled starter'}
                      </div>
                      <div className="text-muted text-sm" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.15rem' }}>
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
                      {entry.overview && <EntrySection label="Overview">{entry.overview}</EntrySection>}

                      {entry.competencies?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <EntryLabel>Project Competencies</EntryLabel>
                          <ul style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                            {entry.competencies.map((c, i) => (
                              <li key={i} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.3rem' }}>
                                {c.skill && <strong>{c.skill}: </strong>}{c.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.steps?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <EntryLabel>Getting Started</EntryLabel>
                          <ol style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                            {entry.steps.map((s, i) => (
                              <li key={i} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.4rem' }}>
                                {s.heading && <strong>{s.heading}</strong>}
                                {s.items?.length > 0 && (
                                  <ul style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
                                    {s.items.map((it, ii) => (
                                      <li key={ii} style={{ marginBottom: '0.15rem' }}>{it}</li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {entry.tips?.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <EntryLabel>Tips for Success</EntryLabel>
                          <ul style={{ margin: '0.35rem 0 0 1.2rem', padding: 0 }}>
                            {entry.tips.map((t, i) => (
                              <li key={i} style={{ fontSize: '0.92rem', color: '#333', marginBottom: '0.3rem' }}>{t}</li>
                            ))}
                          </ul>
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

                      {/* Draft actions */}
                      {entry.status === 'draft' && (
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                          <button type="button" className="btn btn--outline btn--sm" onClick={() => editEntry(entry)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn--teal btn--sm" onClick={() => submitExisting(entry.id)}>
                            Submit for Review
                          </button>
                        </div>
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

function AddButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="btn btn--outline btn--sm" style={{ marginBottom: '0.5rem' }}>
      {children}
    </button>
  )
}

function RemoveButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ marginTop: '0.4rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1, padding: '0.2rem', flexShrink: 0 }}
      title="Remove"
    >×</button>
  )
}
