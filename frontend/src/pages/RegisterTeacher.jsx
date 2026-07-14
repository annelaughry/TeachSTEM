import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function RegisterTeacher() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', password: '' })
  const [isTeachSTEM, setIsTeachSTEM] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('auth/register/teacher/', { ...form, is_teach_stem: isTeachSTEM })
      navigate('/pending')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="container container--narrow">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--pink)' }}>Teacher Registration</h1>
          <p className="text-muted">Your account will be reviewed before you can log in.</p>
        </div>
        <div className="card">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">First name</label>
                <input className="form-input" value={form.first_name} onChange={set('first_name')} autoFocus />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Last name</label>
                <input className="form-input" value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={form.username} onChange={set('username')} autoComplete="username" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </div>
            <div style={{ margin: '0.25rem 0 1.25rem', padding: '1rem', background: 'var(--teal-light)', border: '2px solid var(--teal)', borderRadius: 10 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isTeachSTEM}
                  onChange={e => setIsTeachSTEM(e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--teal-dark)', fontSize: '0.95rem' }}>
                    I am a member of the Teach STEM Program
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--teal-dark)', marginTop: '0.2rem', opacity: 0.85 }}>
                    Teach STEM membership will be verified separately by an admin after your account is approved.
                  </div>
                </div>
              </label>
            </div>

            <button type="submit" className="btn btn--primary w-full" disabled={loading}>
              {loading ? 'Registering…' : 'Create account'}
            </button>
          </form>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  )
}
