import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'

export default function TeachSTEMProfilePage() {
  const [form, setForm]         = useState({
    name: '', school: '', subject_taught: '', num_students: '', years_teaching: '', email: '',
  })
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    api.get('teach-stem/profile/').then(r => {
      const d = r.data
      setForm({
        name:          d.name          || '',
        school:        d.school        || '',
        subject_taught: d.subject_taught || '',
        num_students:  d.num_students  != null ? String(d.num_students) : '',
        years_teaching: d.years_teaching != null ? String(d.years_teaching) : '',
        email:         d.email         || '',
      })
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('teach-stem/profile/', {
        name:           form.name,
        school:         form.school,
        subject_taught: form.subject_taught,
        num_students:   form.num_students   !== '' ? parseInt(form.num_students)   : null,
        years_teaching: form.years_teaching !== '' ? parseInt(form.years_teaching) : null,
        email:          form.email,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner">Loading...</div>

  return (
    <div className="page">
      <div className="hero" style={{ marginTop: 'var(--nav-h)', background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)' }}>
        <h1>My Profile</h1>
        <p>Your Teach STEM member profile.</p>
      </div>

      <div className="container" style={{ maxWidth: 620, paddingBottom: '3rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/teach-stem" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
            ← Teach STEM Dashboard
          </Link>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">School</label>
              <input
                type="text"
                className="form-input"
                value={form.school}
                onChange={e => set('school', e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label">Subject Taught</label>
              <input
                type="text"
                className="form-input"
                value={form.subject_taught}
                onChange={e => set('subject_taught', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label">Number of Students Taught</label>
                <input
                  type="number" min="0"
                  className="form-input"
                  value={form.num_students}
                  onChange={e => set('num_students', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Years Teaching</label>
                <input
                  type="number" min="0"
                  className="form-input"
                  value={form.years_teaching}
                  onChange={e => set('years_teaching', e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: '#c62828', background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            {saved && (
              <div style={{ color: '#2e7d32', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 6, padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 700 }}>
                Profile saved.
              </div>
            )}

            <button type="submit" className="btn btn--teal" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
