import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { login, isTeacher } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.username, form.password)
      if (user.is_pending) {
        navigate('/pending')
      } else if (user.is_staff || user.is_superuser || user.is_teacher) {
        navigate('/teacher')
      } else {
        navigate('/student')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="container container--narrow">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--pink)', fontSize: '2rem' }}>Welcome back</h1>
          <p className="text-muted">Young Scientist Academy — Lesson Database</p>
        </div>

        <div className="card">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn--primary w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link to="/register" style={{ color: 'var(--pink)', fontWeight: 700, textDecoration: 'none' }}>
            Register as a teacher →
          </Link>
          <Link to="/register/student" style={{ color: 'var(--teal)', fontWeight: 700, textDecoration: 'none' }}>
            Register as a student →
          </Link>
        </div>
      </div>
    </div>
  )
}
