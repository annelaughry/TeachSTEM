import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'

export default function RegisterStudent() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', password: '', classroom_code: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('auth/register/student/', form)
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      navigate('/student')
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
          <h1 style={{ color: 'var(--teal)' }}>Student Sign Up</h1>
          <p className="text-muted">Create your account and join your classroom.</p>
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
            <div className="form-group">
              <label className="form-label">Classroom code <span className="optional">(optional — can join later)</span></label>
              <input className="form-input" value={form.classroom_code} onChange={set('classroom_code')}
                     placeholder="e.g. A1B2C3" style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }} />
            </div>
            <button type="submit" className="btn btn--teal w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
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
