import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

let _gk = 0
const nextKey = () => ++_gk
const mkPrompt = (overrides = {}) => ({ _k: nextKey(), text: '', prompt_type: 'student', response_type: 'text', table_headers: [], video_url: '', ...overrides })
const mkLink = () => ({ _k: nextKey(), url: '', label: '' })
const mkSection = () => ({ _k: nextKey(), title: '', prompts: [mkPrompt()], links: [] })

const PROMPT_META = {
  student:     { label: 'Student Prompt',        bg: '#fff8f9', border: '#f2385a', tag: '#fde8ed', tagTxt: '#c71a3a' },
  instruction: { label: 'Student Instructions',  bg: '#f0fbf7', border: '#3cc4c4', tag: '#e0f7f7', tagTxt: '#1a7c7c' },
  teacher:     { label: 'Teacher Note',          bg: '#fffde7', border: '#f7a826', tag: '#fef5e7', tagTxt: '#a06b00' },
  video_embed: { label: 'Video',                 bg: '#f5f0ff', border: '#7c3aed', tag: '#ede9fe', tagTxt: '#5b21b6' },
}

export default function ActivityBuilder() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.is_staff || user?.is_superuser

  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [materials, setMaterials]   = useState('')
  const [actType, setActType]       = useState('challenge')
  const [duration, setDuration]     = useState('')
  const [gradeIds, setGradeIds]     = useState([])
  const [sections, setSections]     = useState([mkSection()])
  const [videoUrl, setVideoUrl]           = useState('')
  const [isRestricted, setIsRestricted]   = useState(false)
  const [restrictedTeacherIds, setRestrictedTeacherIds] = useState([])
  const [teachStemTeachers, setTeachStemTeachers] = useState([])
  const [existingFiles, setExistingFiles] = useState([])  // [{id, file, label}] from API
  const [newFiles, setNewFiles]     = useState([])        // [{file: File, label: string}]
  const fileInputRef                = useRef(null)
  const [actStatus, setActStatus]   = useState('draft')
  const [sourceTitle, setSourceTitle] = useState(null)
  const [gradeLevels, setGradeLevels] = useState([])
  const [activityTypes, setActTypes] = useState([])
  const [errors, setErrors]         = useState([])
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    api.get('grade-levels/').then(r => setGradeLevels(r.data))
    api.get('activity-types/').then(r => setActTypes(r.data))
    if (isAdmin) api.get('admin/teach-stem-teachers/').then(r => setTeachStemTeachers(r.data)).catch(() => {})
    if (!isEdit) return
    api.get(`activities/${id}/`).then(r => {
      const a = r.data
      setTitle(a.title)
      setDescription(a.description || '')
      setMaterials(a.materials || '')
      setActType(a.activity_type || 'challenge')
      setDuration(a.duration_minutes || '')
      setGradeIds(a.grade_levels.map(g => g.id))
      setVideoUrl(a.video_url || '')
      setIsRestricted(a.is_restricted || false)
      setRestrictedTeacherIds(a.restricted_teacher_ids || [])
      setExistingFiles(a.handout_files || [])
      setActStatus(a.status)
      setSourceTitle(a.source_activity_title || null)
      if (a.sections?.length) {
        setSections(a.sections.map(sec => ({
          _k: nextKey(),
          title: sec.title || '',
          prompts: sec.prompts.length
            ? sec.prompts.map(p => ({ _k: nextKey(), text: p.text || '', prompt_type: p.prompt_type || 'student', response_type: p.response_type || 'text', table_headers: p.table_headers || [], video_url: p.video_url || '' }))
            : [mkPrompt()],
          links: sec.links.map(l => ({ _k: nextKey(), url: l.url, label: l.label || '' })),
        })))
      }
    })
  }, [id])

  // ── Section helpers ──────────────────────────────────────────────────────────
  const addSection   = () => setSections(prev => [...prev, mkSection()])
  const removeSection = idx => setSections(prev => prev.filter((_, i) => i !== idx))
  const moveSection  = (idx, dir) => setSections(prev => {
    const next = [...prev]; const t = idx + dir
    if (t < 0 || t >= next.length) return prev;
    [next[idx], next[t]] = [next[t], next[idx]]; return next
  })
  const updateSection = (idx, field, val) => setSections(prev => {
    const next = [...prev]; next[idx] = { ...next[idx], [field]: val }; return next
  })

  // ── Prompt helpers ───────────────────────────────────────────────────────────
  const addPrompt = (sIdx, type = 'student') => setSections(prev => {
    const next = [...prev]
    next[sIdx] = { ...next[sIdx], prompts: [...next[sIdx].prompts, mkPrompt({ prompt_type: type })] }
    return next
  })
  const removePrompt = (sIdx, pIdx) => setSections(prev => {
    const next = [...prev]
    next[sIdx] = { ...next[sIdx], prompts: next[sIdx].prompts.filter((_, i) => i !== pIdx) }
    return next
  })
  const movePrompt = (sIdx, pIdx, dir) => setSections(prev => {
    const next = [...prev]; const ps = [...next[sIdx].prompts]; const t = pIdx + dir
    if (t < 0 || t >= ps.length) return prev;
    [ps[pIdx], ps[t]] = [ps[t], ps[pIdx]]
    next[sIdx] = { ...next[sIdx], prompts: ps }; return next
  })
  const updatePrompt = (sIdx, pIdx, field, val) => setSections(prev => {
    const next = [...prev]; const ps = [...next[sIdx].prompts]
    ps[pIdx] = { ...ps[pIdx], [field]: val }
    next[sIdx] = { ...next[sIdx], prompts: ps }; return next
  })

  // ── Link helpers ─────────────────────────────────────────────────────────────
  const addLink    = sIdx => setSections(prev => { const next = [...prev]; next[sIdx] = { ...next[sIdx], links: [...next[sIdx].links, mkLink()] }; return next })
  const removeLink = (sIdx, lIdx) => setSections(prev => { const next = [...prev]; next[sIdx] = { ...next[sIdx], links: next[sIdx].links.filter((_, i) => i !== lIdx) }; return next })
  const updateLink = (sIdx, lIdx, field, val) => setSections(prev => {
    const next = [...prev]; const ls = [...next[sIdx].links]
    ls[lIdx] = { ...ls[lIdx], [field]: val }
    next[sIdx] = { ...next[sIdx], links: ls }; return next
  })

  // ── Table header helpers ─────────────────────────────────────────────────────
  const addHeader    = (sIdx, pIdx) => updatePrompt(sIdx, pIdx, 'table_headers', [...sections[sIdx].prompts[pIdx].table_headers, ''])
  const updateHeader = (sIdx, pIdx, hIdx, val) => {
    const hs = [...sections[sIdx].prompts[pIdx].table_headers]; hs[hIdx] = val
    updatePrompt(sIdx, pIdx, 'table_headers', hs)
  }
  const removeHeader = (sIdx, pIdx, hIdx) =>
    updatePrompt(sIdx, pIdx, 'table_headers', sections[sIdx].prompts[pIdx].table_headers.filter((_, i) => i !== hIdx))

  const toggleGrade = gid => setGradeIds(prev => prev.includes(gid) ? prev.filter(x => x !== gid) : [...prev, gid])

  const handleFileSelect = e => {
    const picked = Array.from(e.target.files).map(f => ({
      file: f,
      label: f.name.replace(/\.[^/.]+$/, ''),
      description: '',
    }))
    setNewFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }
  const updateNewLabel       = (idx, label)       => setNewFiles(prev => { const n = [...prev]; n[idx] = { ...n[idx], label };       return n })
  const updateNewDescription = (idx, description) => setNewFiles(prev => { const n = [...prev]; n[idx] = { ...n[idx], description }; return n })
  const removeNew      = idx => setNewFiles(prev => prev.filter((_, i) => i !== idx))
  const removeExisting = id  => setExistingFiles(prev => prev.filter(f => f.id !== id))

  const buildFd = () => {
    const fd = new FormData()
    fd.append('title', title.trim())
    fd.append('description', description)
    fd.append('materials', materials)
    fd.append('activity_type', actType)
    fd.append('duration_minutes', duration || 0)
    gradeIds.forEach(gid => fd.append('grade_levels', gid))
    fd.append('sections_json', JSON.stringify(sections.map(sec => ({
      title: sec.title,
      prompts: sec.prompts.map(p => ({ text: p.text, prompt_type: p.prompt_type, response_type: p.response_type, table_headers: p.table_headers, video_url: p.video_url || '' })),
      links: sec.links.map(l => ({ url: l.url, label: l.label })),
    }))))
    fd.append('video_url', videoUrl)
    fd.append('is_restricted', isRestricted ? 'true' : 'false')
    fd.append('restricted_teacher_ids', JSON.stringify(restrictedTeacherIds))
    fd.append('keep_file_ids', JSON.stringify(existingFiles.map(f => f.id)))
    newFiles.forEach(f => {
      fd.append('handout_files', f.file)
      fd.append('handout_labels', f.label)
      fd.append('handout_descriptions', f.description)
    })
    return fd
  }

  const save = async (submitForReview = false) => {
    if (!title.trim()) { setErrors(['Title is required.']); return }
    setErrors([]); setSaving(true)
    try {
      const fd = buildFd()
      let resp
      if (isEdit) {
        resp = await api.patch(`activities/${id}/edit/`, fd)
      } else {
        resp = await api.post('activities/create/', fd)
      }
      const actId = resp.data.id
      if (submitForReview) {
        await api.post(`activities/${actId}/submit/`)
        navigate('/teacher')
      } else {
        navigate(`/teacher/activity/${actId}/edit`)
      }
    } catch (err) {
      setErrors([err.response?.data?.error || 'Something went wrong. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  const isLocked = isEdit && actStatus === 'pending'

  return (
    <div className="page">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--pink) 0%, var(--pink-dark) 100%)', padding: '1.75rem 1.5rem', marginTop: 'var(--nav-h)', color: '#fff' }}>
        <div className="container">
          <div style={{ marginBottom: '0.4rem' }}>
            <Link to="/teacher" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}>← Teacher Dashboard</Link>
          </div>
          <h1 style={{ margin: 0 }}>{isEdit ? 'Edit Activity' : 'Create New Activity'}</h1>
          {sourceTitle && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.45rem 0.9rem', marginTop: '0.6rem', fontSize: '0.9rem' }}>
              This is your own copy of <strong>{sourceTitle}</strong>. Add, remove, or edit sections freely — the original in the library won't change.
            </div>
          )}
          {actStatus === 'rejected' && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.45rem 0.9rem', marginTop: '0.6rem', fontSize: '0.9rem' }}>
              This activity was rejected. Make edits and resubmit.
            </div>
          )}
          {isLocked && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.45rem 0.9rem', marginTop: '0.6rem', fontSize: '0.9rem' }}>
              This activity is pending review. You cannot edit it until a decision is made.
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ maxWidth: 860, paddingBottom: '3rem' }}>
        {errors.length > 0 && (
          <div className="form-error" style={{ marginTop: '1.5rem' }}>
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {/* Basic Info */}
        <div className="card" style={{ marginTop: '1.5rem', opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
          <h2 style={{ color: 'var(--pink)', marginBottom: '1.25rem', paddingBottom: '0.6rem', borderBottom: '2px solid var(--pink-light)' }}>
            Basic Information
          </h2>
          <div className="form-group">
            <label className="form-label">Title <span style={{ color: 'var(--pink)' }}>*</span></label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity title" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Activity Type</label>
              <select className="form-input" value={actType} onChange={e => setActType(e.target.value)}>
                {activityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input className="form-input" type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 45" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Grade Levels</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem' }}>
              {gradeLevels.map(g => (
                <button key={g.id} type="button" onClick={() => toggleGrade(g.id)}
                  style={{ padding: '0.3rem 0.85rem', borderRadius: 20, border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.15s',
                    background: gradeIds.includes(g.id) ? 'var(--pink)' : '#fff',
                    borderColor: gradeIds.includes(g.id) ? 'var(--pink)' : 'var(--border)',
                    color: gradeIds.includes(g.id) ? '#fff' : 'var(--text)' }}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief summary of the activity…" />
          </div>
          <div className="form-group">
            <label className="form-label">Materials Needed</label>
            <textarea className="form-input" rows={2} value={materials} onChange={e => setMaterials(e.target.value)} placeholder="List materials students will need…" />
          </div>
          <div className="form-group">
            <label className="form-label">Intro Video</label>
            <input className="form-input" type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="YouTube or Vimeo URL — shown to students before they begin" />
          </div>

          {isAdmin && (
            <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={isRestricted} onChange={e => setIsRestricted(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--pink)', flexShrink: 0 }} />
                <span className="form-label" style={{ margin: 0 }}>Restrict from library — assign to specific Teach STEM teachers only</span>
              </label>
              {isRestricted && (
                <div style={{ marginTop: '0.85rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Select teachers who can access this activity:
                  </div>
                  {teachStemTeachers.length === 0 ? (
                    <p className="text-muted text-sm">No approved Teach STEM teachers found.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {teachStemTeachers.map(t => {
                        const selected = restrictedTeacherIds.includes(t.id)
                        return (
                          <button key={t.id} type="button"
                            onClick={() => setRestrictedTeacherIds(prev =>
                              selected ? prev.filter(x => x !== t.id) : [...prev, t.id]
                            )}
                            style={{ padding: '0.3rem 0.85rem', borderRadius: 20, border: '2px solid', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.15s',
                              background: selected ? 'var(--pink)' : '#fff',
                              borderColor: selected ? 'var(--pink)' : 'var(--border)',
                              color: selected ? '#fff' : 'var(--text)' }}>
                            {t.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Files & Handouts */}
        <div className="card" style={{ marginTop: '1.25rem', opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
          <h2 style={{ color: 'var(--pink)', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '2px solid var(--pink-light)' }}>
            Files &amp; Handouts
          </h2>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            Upload worksheets, data sheets, or any files students should download for this activity.
          </p>

          {/* Existing files (edit mode) */}
          {existingFiles.map(f => (
            <div key={f.id} style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <a href={f.file} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: 'var(--teal)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.label || f.file.split('/').pop()}
                </a>
                <button type="button" onClick={() => removeExisting(f.id)}
                  style={{ background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 6, padding: '0.2rem 0.5rem', color: '#c00', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                  Remove
                </button>
              </div>
              {f.description && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.83rem', color: 'var(--text-muted)', paddingLeft: '1.7rem' }}>{f.description}</div>
              )}
            </div>
          ))}

          {/* New files pending upload */}
          {newFiles.map((f, idx) => (
            <div key={idx} style={{ background: '#f0fbf7', border: '1px solid var(--teal)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <input className="form-input" style={{ flex: 1, fontSize: '0.88rem' }}
                  value={f.label} onChange={e => updateNewLabel(idx, e.target.value)}
                  placeholder="File name (shown to students)" />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</span>
                <button type="button" onClick={() => removeNew(idx)}
                  style={{ background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 6, padding: '0.2rem 0.5rem', color: '#c00', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                  ×
                </button>
              </div>
              <textarea className="form-input" rows={2} style={{ fontSize: '0.85rem', marginLeft: '1.7rem', width: 'calc(100% - 1.7rem)' }}
                value={f.description} onChange={e => updateNewDescription(idx, e.target.value)}
                placeholder="Description — what is this file for? (optional)" />
            </div>
          ))}

          <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,image/*"
            style={{ display: 'none' }} onChange={handleFileSelect} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: '#fafafa', border: '2px dashed var(--border)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            + Upload Files
          </button>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>PDF, Word, Excel, PowerPoint, images — multiple files allowed</div>
        </div>

        {/* Sections */}
        <div style={{ opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
          {sections.map((sec, sIdx) => (
            <div key={sec._k} className="card" style={{ marginTop: '1.25rem', borderTop: '4px solid var(--pink)' }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Section {sIdx + 1}
                  </label>
                  <input className="form-input" style={{ marginTop: '0.2rem', fontWeight: 700 }}
                    value={sec.title} onChange={e => updateSection(sIdx, 'title', e.target.value)}
                    placeholder="Section title (optional)" />
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', marginTop: '1.4rem' }}>
                  <button type="button" onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0}
                    style={{ padding: '0.3rem 0.5rem', background: '#f5f5f5', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', opacity: sIdx === 0 ? 0.35 : 1 }}>▲</button>
                  <button type="button" onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1}
                    style={{ padding: '0.3rem 0.5rem', background: '#f5f5f5', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', opacity: sIdx === sections.length - 1 ? 0.35 : 1 }}>▼</button>
                  {sections.length > 1 && (
                    <button type="button" onClick={() => { if (window.confirm('Remove this section?')) removeSection(sIdx) }}
                      style={{ padding: '0.3rem 0.5rem', background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 6, cursor: 'pointer', color: '#c00' }}>×</button>
                  )}
                </div>
              </div>

              {/* Resource links */}
              {sec.links.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Resource Links</div>
                  {sec.links.map((link, lIdx) => (
                    <div key={link._k} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem', alignItems: 'center' }}>
                      <input className="form-input" style={{ flex: 2 }} value={link.url}
                        onChange={e => updateLink(sIdx, lIdx, 'url', e.target.value)} placeholder="https://…" />
                      <input className="form-input" style={{ flex: 1 }} value={link.label}
                        onChange={e => updateLink(sIdx, lIdx, 'label', e.target.value)} placeholder="Label" />
                      <button type="button" onClick={() => removeLink(sIdx, lIdx)}
                        style={{ padding: '0.3rem 0.5rem', background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 6, cursor: 'pointer', color: '#c00', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Prompts */}
              {sec.prompts.map((prompt, pIdx) => {
                const m = PROMPT_META[prompt.prompt_type] || PROMPT_META.student
                return (
                  <div key={prompt._k} style={{ background: m.bg, border: `2px solid ${m.border}`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
                    {/* Prompt toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ background: m.tag, color: m.tagTxt, borderRadius: 12, padding: '0.15rem 0.65rem', fontSize: '0.75rem', fontWeight: 800 }}>
                        {m.label}
                      </span>
                      {prompt.prompt_type !== 'video_embed' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {['student', 'instruction', 'teacher'].map(type => (
                            <button key={type} type="button" onClick={() => updatePrompt(sIdx, pIdx, 'prompt_type', type)}
                              style={{ padding: '0.15rem 0.5rem', borderRadius: 8, border: `1.5px solid ${PROMPT_META[type].border}`, fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
                                background: prompt.prompt_type === type ? PROMPT_META[type].border : '#fff',
                                color: prompt.prompt_type === type ? '#fff' : PROMPT_META[type].tagTxt }}>
                              {type === 'student' ? 'Student' : type === 'instruction' ? 'Instruction' : 'Teacher'}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => movePrompt(sIdx, pIdx, -1)} disabled={pIdx === 0}
                          style={{ padding: '0.2rem 0.4rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: '0.72rem', opacity: pIdx === 0 ? 0.3 : 1 }}>▲</button>
                        <button type="button" onClick={() => movePrompt(sIdx, pIdx, 1)} disabled={pIdx === sec.prompts.length - 1}
                          style={{ padding: '0.2rem 0.4rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: '0.72rem', opacity: pIdx === sec.prompts.length - 1 ? 0.3 : 1 }}>▼</button>
                        {sec.prompts.length > 1 && (
                          <button type="button" onClick={() => removePrompt(sIdx, pIdx)}
                            style={{ padding: '0.2rem 0.4rem', background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 5, cursor: 'pointer', color: '#c00', fontSize: '0.72rem' }}>×</button>
                        )}
                      </div>
                    </div>

                    {prompt.prompt_type === 'video_embed' ? (
                      <>
                        <input className="form-input" type="url" style={{ background: '#fff', marginBottom: '0.45rem' }}
                          value={prompt.video_url || ''}
                          onChange={e => updatePrompt(sIdx, pIdx, 'video_url', e.target.value)}
                          placeholder="YouTube or Vimeo URL" />
                        <input className="form-input" style={{ background: '#fff', fontSize: '0.88rem' }}
                          value={prompt.text}
                          onChange={e => updatePrompt(sIdx, pIdx, 'text', e.target.value)}
                          placeholder="Caption (optional)" />
                      </>
                    ) : (
                      <>
                        <textarea className="form-input" style={{ background: '#fff', minHeight: 72 }}
                          value={prompt.text} onChange={e => updatePrompt(sIdx, pIdx, 'text', e.target.value)}
                          placeholder={
                            prompt.prompt_type === 'student' ? 'Write the student prompt…' :
                            prompt.prompt_type === 'instruction' ? 'Write instructions for students…' :
                            'Write a teacher-only note…'
                          } />

                        {/* Response type (student prompts only) */}
                        {prompt.prompt_type === 'student' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <div style={{ fontSize: '0.73rem', fontWeight: 800, color: m.tagTxt, marginBottom: '0.3rem' }}>Response type:</div>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {[['text','Written Response'],['video','Video Recording'],['table','Data Table']].map(([val, lbl]) => (
                                <button key={val} type="button" onClick={() => updatePrompt(sIdx, pIdx, 'response_type', val)}
                                  style={{ padding: '0.25rem 0.65rem', borderRadius: 8, border: `2px solid ${m.border}`, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                    background: prompt.response_type === val ? m.border : '#fff',
                                    color: prompt.response_type === val ? '#fff' : m.tagTxt }}>
                                  {lbl}
                                </button>
                              ))}
                            </div>

                            {/* Table columns config */}
                            {prompt.response_type === 'table' && (
                              <div style={{ marginTop: '0.55rem', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.8rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Column Headers</div>
                                {prompt.table_headers.map((h, hIdx) => (
                                  <div key={hIdx} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.3rem' }}>
                                    <input className="form-input" style={{ fontSize: '0.85rem' }} value={h}
                                      onChange={e => updateHeader(sIdx, pIdx, hIdx, e.target.value)}
                                      placeholder={`Column ${hIdx + 1}`} />
                                    <button type="button" onClick={() => removeHeader(sIdx, pIdx, hIdx)}
                                      style={{ padding: '0.25rem 0.45rem', background: '#fff5f5', border: '1px solid #ffaaaa', borderRadius: 5, cursor: 'pointer', color: '#c00' }}>×</button>
                                  </div>
                                ))}
                                <button type="button" onClick={() => addHeader(sIdx, pIdx)}
                                  style={{ padding: '0.25rem 0.7rem', background: '#f5f5f5', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                                  + Add Column
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}

              {/* Add buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => addPrompt(sIdx, 'student')} className="btn btn--outline btn--sm">+ Student Prompt</button>
                <button type="button" onClick={() => addPrompt(sIdx, 'instruction')} className="btn btn--sm"
                  style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', color: 'var(--teal-dark)', fontWeight: 700 }}>
                  + Instructions
                </button>
                <button type="button" onClick={() => addPrompt(sIdx, 'teacher')} className="btn btn--sm"
                  style={{ background: 'var(--yellow-light)', border: '1px solid var(--yellow)', color: 'var(--yellow-dark)', fontWeight: 700 }}>
                  + Teacher Note
                </button>
                <button type="button" onClick={() => addPrompt(sIdx, 'video_embed')} className="btn btn--sm"
                  style={{ background: '#f5f0ff', border: '1px solid #7c3aed', color: '#5b21b6', fontWeight: 700 }}>
                  + Video
                </button>
                <button type="button" onClick={() => addLink(sIdx)} className="btn btn--sm"
                  style={{ background: '#f5f5f5', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700 }}>
                  + Link
                </button>
              </div>
            </div>
          ))}

          <button type="button" onClick={addSection}
            style={{ display: 'block', width: '100%', padding: '0.75rem', background: '#fafafa', border: '2px dashed var(--border)', borderRadius: 10, cursor: 'pointer', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.95rem' }}>
            + Add Section
          </button>
        </div>

        {/* Action bar */}
        {!isLocked && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.75rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <Link to="/teacher" className="btn btn--ghost">Cancel</Link>
            <button type="button" onClick={() => save(false)} className="btn btn--outline" disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" onClick={() => save(true)} className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : actStatus === 'rejected' ? 'Resubmit for Review' : 'Submit for Review'}
            </button>
          </div>
        )}
        {isLocked && (
          <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
            <Link to="/teacher" className="btn btn--ghost">← Back to Dashboard</Link>
          </div>
        )}
      </div>
    </div>
  )
}
