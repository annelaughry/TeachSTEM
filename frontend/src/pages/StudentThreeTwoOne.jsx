import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../api'

function SubmittedView({ assignment, resp }) {
  const title = assignment?.title || (assignment?.activity_title ? `After: ${assignment.activity_title}` : '3-2-1 Exit Ticket')
  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>3-2-1 Exit Ticket</h1>
        <p>{title}</p>
      </div>
      <div className="container" style={{ maxWidth: 680, paddingBottom: '3rem' }}>
        <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem' }}>
            Your response has been submitted.
          </div>

          {resp && assignment?.response_type === 'video' && resp.response_video && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.75rem' }}>
                Your Video Response
              </div>
              <video
                src={resp.response_video}
                controls
                style={{ width: '100%', maxHeight: 400, borderRadius: 6, background: '#000' }}
              />
            </div>
          )}

          {resp && assignment?.response_type !== 'video' && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.4rem' }}>3 Things You Learned</div>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <li>{resp.learned_1}</li>
                  <li>{resp.learned_2}</li>
                  <li>{resp.learned_3}</li>
                </ol>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.4rem' }}>2 Questions You Have</div>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <li>{resp.question_1}</li>
                  <li>{resp.question_2}</li>
                </ol>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--teal-dark)', marginBottom: '0.4rem' }}>1 Most Interesting Thing</div>
                <p style={{ margin: 0 }}>{resp.most_interesting}</p>
              </div>
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

export default function StudentThreeTwoOne() {
  const { id } = useParams()
  const fileRef = useRef(null)

  const [assignment, setAssignment] = useState(null)
  const [existing, setExisting]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const [error, setError]           = useState('')
  const [videoFile, setVideoFile]   = useState(null)

  const [form, setForm] = useState({
    learned_1: '',
    learned_2: '',
    learned_3: '',
    question_1: '',
    question_2: '',
    most_interesting: '',
  })

  useEffect(() => {
    Promise.all([
      api.get('321/student/'),
      api.get(`321/student/${id}/respond/`),
    ]).then(([list, resp]) => {
      const found = list.data.find(a => a.id === parseInt(id))
      setAssignment(found || null)
      if (resp.data && resp.data.id) setExisting(resp.data)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (assignment.response_type === 'video') {
      if (!videoFile) { setError('Please select a video file.'); return }
      setSubmitting(true)
      try {
        const fd = new FormData()
        fd.append('response_video', videoFile)
        const { data } = await api.post(`321/student/${id}/respond/`, fd)
        setExisting(data)
        setDone(true)
      } catch (err) {
        setError(err?.response?.data?.error || 'Submission failed. Please try again.')
      } finally {
        setSubmitting(false)
      }
    } else {
      const allFilled = Object.values(form).every(v => v.trim())
      if (!allFilled) { setError('Please fill in all fields.'); return }
      setSubmitting(true)
      try {
        const { data } = await api.post(`321/student/${id}/respond/`, form)
        setExisting(data)
        setDone(true)
      } catch (err) {
        setError(err?.response?.data?.error || 'Submission failed. Please try again.')
      } finally {
        setSubmitting(false)
      }
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
              {!assignment ? 'This assignment was not found or is not assigned to your classroom.' : 'This assignment is closed.'}
            </p>
            <Link to="/student" className="btn btn--outline btn--sm">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const title = assignment.title || (assignment.activity_title ? `After: ${assignment.activity_title}` : '3-2-1 Exit Ticket')
  const isVideo = assignment.response_type === 'video'

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>3-2-1 Exit Ticket</h1>
        <p>{title}</p>
      </div>

      <div className="container" style={{ maxWidth: 680, paddingBottom: '3rem' }}>
        <form onSubmit={handleSubmit}>

          {isVideo ? (
            <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
              <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '0.5rem' }}>Video Response</h2>
              <p className="text-muted text-sm" style={{ marginBottom: '1.25rem' }}>
                Record a short video covering: three things you learned, two questions you have, and one thing you found most interesting. Then upload it below.
              </p>

              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: videoFile ? '#f0fdf4' : '#fafafa',
                  transition: 'background 0.15s',
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={e => setVideoFile(e.target.files[0] || null)}
                />
                {videoFile ? (
                  <div>
                    <p style={{ fontWeight: 700, color: '#2e7d32', marginBottom: '0.25rem' }}>{videoFile.name}</p>
                    <p className="text-muted text-sm">{(videoFile.size / 1024 / 1024).toFixed(1)} MB — click to change</p>
                    {videoFile.type.startsWith('video/') && (
                      <video
                        src={URL.createObjectURL(videoFile)}
                        controls
                        style={{ marginTop: '0.75rem', width: '100%', maxHeight: 300, borderRadius: 6, background: '#000' }}
                      />
                    )}
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Click to select a video</p>
                    <p className="text-muted text-sm">MP4, MOV, WebM — any format your device records</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginTop: '2rem', padding: '1.75rem' }}>
                <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '0.25rem' }}>3 Things You Learned</h2>
                <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>Write three things you learned from this activity.</p>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ marginBottom: '0.75rem' }}>
                    <label className="label">Thing {n}</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={form[`learned_${n}`]}
                      onChange={set(`learned_${n}`)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginTop: '1rem', padding: '1.75rem' }}>
                <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '0.25rem' }}>2 Questions You Have</h2>
                <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>Write two questions that came up for you during this activity.</p>
                {[1, 2].map(n => (
                  <div key={n} style={{ marginBottom: '0.75rem' }}>
                    <label className="label">Question {n}</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={form[`question_${n}`]}
                      onChange={set(`question_${n}`)}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginTop: '1rem', padding: '1.75rem' }}>
                <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.05rem', marginBottom: '0.25rem' }}>1 Most Interesting Thing</h2>
                <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>What was the most interesting thing you discovered?</p>
                <textarea
                  className="input"
                  rows={3}
                  value={form.most_interesting}
                  onChange={set('most_interesting')}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </>
          )}

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
