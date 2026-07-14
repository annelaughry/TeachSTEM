import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

// ── Video recorder sub-component ────────────────────────────────────────────

function VideoRecorder({ promptId, existingUrl, onSaved }) {
  const [mode, setMode] = useState('idle')   // 'idle' | 'recording' | 'preview' | 'saved'
  const [blob, setBlob] = useState(null)
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  const preview = useRef(null)
  const playback = useRef(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const stream = useRef(null)

  const start = async () => {
    setErr('')
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      if (preview.current) { preview.current.srcObject = stream.current; preview.current.play() }
      chunks.current = []
      recorder.current = new MediaRecorder(stream.current)
      recorder.current.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
      recorder.current.onstop = () => {
        const b = new Blob(chunks.current, { type: 'video/webm' })
        setBlob(b)
        setMode('preview')
        stream.current.getTracks().forEach(t => t.stop())
        if (playback.current) playback.current.src = URL.createObjectURL(b)
      }
      recorder.current.start()
      setMode('recording')
    } catch {
      setErr('Camera/microphone access denied. Please allow access in your browser settings.')
    }
  }

  const stop = () => { recorder.current?.stop(); setMode('idle') }

  const upload = async () => {
    if (!blob) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('response_video', blob, `response_${promptId}.webm`)
      await api.post(`responses/${promptId}/save/`, fd)
      setMode('saved')
      onSaved?.()
    } catch {
      setErr('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const reset = () => { setBlob(null); setMode('idle'); setErr('') }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {err && <div className="form-error" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>{err}</div>}

      {existingUrl && mode === 'idle' && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--teal-dark)', fontWeight: 800, marginBottom: '0.3rem' }}>Your current response:</div>
          <video controls src={existingUrl} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, border: '2px solid var(--teal)', display: 'block' }} />
        </div>
      )}

      {mode === 'recording' && (
        <div>
          <video ref={preview} muted playsInline style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '2px solid var(--pink)', background: '#111', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={stop} className="btn btn--danger btn--sm">Stop</button>
            <span style={{ color: 'var(--pink)', fontWeight: 800, fontSize: '0.9rem', animation: 'pulse 1s infinite' }}>● Recording…</span>
          </div>
        </div>
      )}

      {mode === 'preview' && blob && (
        <div>
          <video ref={playback} controls style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '2px solid var(--teal)', display: 'block' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={reset} className="btn btn--ghost btn--sm">Re-record</button>
            <button type="button" onClick={upload} className="btn btn--teal btn--sm" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Save Video'}
            </button>
          </div>
        </div>
      )}

      {mode === 'saved' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#2e7d32', fontWeight: 800 }}>Video saved!</span>
          <button type="button" onClick={reset} className="btn btn--ghost btn--sm">Re-record</button>
        </div>
      )}

      {(mode === 'idle') && (
        <button type="button" onClick={start} className="btn btn--primary btn--sm">
          {existingUrl ? 'Re-record' : 'Start Recording'}
        </button>
      )}
    </div>
  )
}

// ── Data table sub-component ─────────────────────────────────────────────────

function DataTable({ tableHeaders, initialData, onChange }) {
  const cols = tableHeaders.length || 2
  const initRows = () => {
    if (initialData?.rows?.length) return initialData.rows.map(r => Array.isArray(r) ? r : Object.values(r))
    return [Array(cols).fill('')]
  }
  const [rows, setRows] = useState(initRows)

  useEffect(() => {
    onChange({ headers: tableHeaders, rows })
  }, [rows])

  const setCell = (r, c, val) => setRows(prev => {
    const next = prev.map(row => [...row])
    if (!next[r]) next[r] = Array(cols).fill('')
    next[r][c] = val
    return next
  })

  const addRow = () => setRows(prev => [...prev, Array(cols).fill('')])
  const removeRow = r => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== r) : prev)

  return (
    <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: cols * 120 }}>
        <thead>
          <tr>
            {(tableHeaders.length ? tableHeaders : Array(cols).fill('')).map((h, ci) => (
              <th key={ci} style={{ padding: '0.4rem 0.6rem', background: 'var(--teal)', color: '#fff', border: '1px solid var(--teal-dark)', fontSize: '0.82rem', textAlign: 'left', fontWeight: 800 }}>
                {h || `Column ${ci + 1}`}
              </th>
            ))}
            <th style={{ width: 32, background: 'var(--teal-dark)', border: '1px solid var(--teal-dark)' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {Array(cols).fill(null).map((_, ci) => (
                <td key={ci} style={{ border: '1px solid var(--border)', padding: 0 }}>
                  <input style={{ width: '100%', border: 'none', padding: '0.35rem 0.5rem', fontSize: '0.9rem', fontFamily: 'inherit', background: 'transparent' }}
                    value={row?.[ci] ?? ''} onChange={e => setCell(ri, ci, e.target.value)} />
                </td>
              ))}
              <td style={{ border: '1px solid var(--border)', textAlign: 'center' }}>
                <button type="button" onClick={() => removeRow(ri)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontWeight: 700, padding: '0 0.35rem' }}
                  onMouseEnter={e => e.target.style.color = '#c00'} onMouseLeave={e => e.target.style.color = '#ccc'}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={addRow}
        style={{ marginTop: '0.4rem', padding: '0.25rem 0.75rem', background: '#f5f5f5', border: '1px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        + Add Row
      </button>
    </div>
  )
}

// ── Main StudentActivity component ───────────────────────────────────────────

export default function StudentActivity() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isTeacher } = useAuth()

  const [activity, setActivity]       = useState(null)
  const [responses, setResponses]     = useState({})   // { promptId: responseObj }
  const [textDrafts, setTextDrafts]   = useState({})   // { promptId: string }
  const [tableDrafts, setTableDrafts] = useState({})   // { promptId: {headers,rows} }
  const [sectionIdx, setSectionIdx]   = useState(0)
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    Promise.all([
      api.get(`activities/${id}/`),
      api.get(`activities/${id}/responses/`),
    ]).then(([actR, respR]) => {
      setActivity(actR.data)
      const respMap = respR.data
      setResponses(respMap)
      const texts = {}, tables = {}
      Object.entries(respMap).forEach(([pid, r]) => {
        if (r.response_text !== undefined) texts[pid] = r.response_text || ''
        if (r.response_table)              tables[pid] = r.response_table
      })
      setTextDrafts(texts)
      setTableDrafts(tables)
    }).catch(() => setError('Could not load this activity.')).finally(() => setLoading(false))
  }, [id])

  const studentSections = (activity?.sections || []).filter(sec =>
    sec.prompts.some(p => p.prompt_type === 'student' || p.prompt_type === 'instruction')
  )

  const total = studentSections.length
  const current = studentSections[sectionIdx]

  const saveSection = async () => {
    if (!current) return
    const studentPrompts = current.prompts.filter(p => p.prompt_type === 'student')
    await Promise.all(studentPrompts.map(async p => {
      if (p.response_type === 'text') {
        await api.post(`responses/${p.id}/save/`, { response_text: textDrafts[p.id] ?? '' })
      } else if (p.response_type === 'table') {
        const tbl = tableDrafts[p.id] || { headers: p.table_headers || [], rows: [] }
        await api.post(`responses/${p.id}/save/`, { response_table: JSON.stringify(tbl) })
      }
      // videos are saved immediately by VideoRecorder
    }))
  }

  const goNext = async () => {
    setSaving(true); setError('')
    try {
      await saveSection()
      setSectionIdx(i => i + 1)
      window.scrollTo(0, 0)
    } catch { setError('Failed to save. Please check your connection and try again.') }
    finally { setSaving(false) }
  }

  const finish = async () => {
    setSaving(true); setError('')
    try {
      await saveSection()
      navigate(isTeacher ? `/activity/${id}` : '/student')
    } catch { setError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="spinner">Loading…</div>
  if (error && !activity) return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div className="form-error">{error}</div>
      <Link to="/student" className="btn btn--outline" style={{ marginTop: '1rem' }}>← Back</Link>
    </div>
  )
  if (!activity) return null

  const progressPct = total > 0 ? Math.round(((sectionIdx + 1) / total) * 100) : 100

  return (
    <div className="page">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)', padding: '1.5rem', marginTop: 'var(--nav-h)', color: '#fff' }}>
        <div className="container">
          <div style={{ marginBottom: '0.35rem' }}>
            <Link to={isTeacher ? '/teacher' : '/student'} style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}>
              ← {isTeacher ? 'Teacher Dashboard' : 'My Classrooms'}
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.55rem' }}>{activity.title}</h1>
          {activity.description && (
            <p style={{ opacity: 0.85, marginTop: '0.2rem', marginBottom: 0, fontSize: '0.92rem' }}>{activity.description}</p>
          )}
          {activity.handout_files?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {activity.handout_files.map(f => (
                <a key={f.id} href={f.file} target="_blank" rel="noopener noreferrer"
                  title={f.description || undefined}
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '0.3rem 0.75rem', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
                  {f.label || 'Download File'}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {total > 1 && (
        <div style={{ background: 'var(--teal-light)', padding: '0.6rem 1.5rem' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem', fontWeight: 800, color: 'var(--teal-dark)' }}>
              <span>Section {sectionIdx + 1} of {total}</span>
              <span>{progressPct}% complete</span>
            </div>
            <div style={{ background: 'rgba(60,196,196,0.25)', borderRadius: 99, height: 6 }}>
              <div style={{ background: 'var(--teal)', height: 6, borderRadius: 99, width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ maxWidth: 760, paddingBottom: '3rem' }}>
        {current ? (
          <>
            {current.title && (
              <h2 style={{ color: 'var(--text)', marginTop: '1.75rem', marginBottom: '0.25rem', fontSize: '1.25rem' }}>
                {current.title}
              </h2>
            )}

            {/* Section resource links */}
            {current.links?.length > 0 && (
              <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Resources</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {current.links.map(lnk => (
                    <a key={lnk.id} href={lnk.url} target="_blank" rel="noopener noreferrer"
                      style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', borderRadius: 8, padding: '0.35rem 0.8rem', color: 'var(--teal-dark)', textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem' }}>
                      {lnk.label || lnk.url}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Prompts */}
            {current.prompts.map(prompt => {
              if (prompt.prompt_type === 'teacher') return null

              if (prompt.prompt_type === 'instruction') {
                return (
                  <div key={prompt.id} style={{ background: '#f0fbf7', border: '2px solid var(--teal)', borderRadius: 10, padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
                    <div style={{ fontWeight: 800, color: 'var(--teal-dark)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                      Instructions
                    </div>
                    <div style={{ color: '#1a5f5f', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{prompt.text}</div>
                  </div>
                )
              }

              // Student prompt
              const existing = responses[prompt.id]
              return (
                <div key={prompt.id} style={{ background: '#fff8f9', border: '2px solid var(--pink)', borderRadius: 10, padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
                  {prompt.text && (
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem', lineHeight: 1.65, margin: '0 0 0.75rem' }}>{prompt.text}</p>
                  )}

                  {existing?.feedback_text && (
                    <div style={{ background: 'var(--teal-light)', border: '1px solid var(--teal)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.88rem' }}>
                      <strong style={{ color: 'var(--teal-dark)' }}>Teacher feedback:</strong>{' '}{existing.feedback_text}
                    </div>
                  )}

                  {prompt.response_type === 'text' && (
                    <textarea className="form-input" rows={4} style={{ background: '#fff' }}
                      value={textDrafts[prompt.id] ?? existing?.response_text ?? ''}
                      onChange={e => setTextDrafts(prev => ({ ...prev, [prompt.id]: e.target.value }))}
                      placeholder="Write your response here…" />
                  )}

                  {prompt.response_type === 'video' && (
                    <VideoRecorder
                      promptId={prompt.id}
                      existingUrl={existing?.response_video || null}
                      onSaved={() => {}}
                    />
                  )}

                  {prompt.response_type === 'table' && (
                    <DataTable
                      tableHeaders={prompt.table_headers || []}
                      initialData={tableDrafts[prompt.id] || existing?.response_table || null}
                      onChange={data => setTableDrafts(prev => ({ ...prev, [prompt.id]: data }))}
                    />
                  )}
                </div>
              )
            })}

            {error && <div className="form-error" style={{ marginTop: '1rem' }}>{error}</div>}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', gap: '0.75rem' }}>
              <div>
                {sectionIdx > 0 && (
                  <button type="button" onClick={() => { setSectionIdx(i => i - 1); window.scrollTo(0, 0) }}
                    className="btn btn--ghost" disabled={saving}>← Previous</button>
                )}
              </div>
              <div>
                {sectionIdx < total - 1 ? (
                  <button type="button" onClick={goNext} className="btn btn--primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save & Continue →'}
                  </button>
                ) : (
                  <button type="button" onClick={finish} className="btn btn--teal" disabled={saving}>
                    {saving ? 'Saving…' : 'Finish Activity'}
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* No student sections — or finished all */
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <h2 style={{ color: 'var(--teal)' }}>Activity Complete!</h2>
            <p className="text-muted">Your responses have been submitted.</p>
            <Link to={isTeacher ? '/teacher' : '/student'} className="btn btn--primary" style={{ marginTop: '1.25rem' }}>
              ← {isTeacher ? 'Teacher Dashboard' : 'My Classrooms'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
