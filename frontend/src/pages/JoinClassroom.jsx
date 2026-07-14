import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function JoinClassroom() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('classrooms/join/', { code: code.trim().toUpperCase() })
      navigate('/student')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="container container--narrow">
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/student" style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>← My Classrooms</Link>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--teal)' }}>Join a Classroom</h1>
          <p className="text-muted">Enter the code your teacher gave you.</p>
        </div>
        <div className="card">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Classroom code</label>
              <input
                className="form-input"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                style={{ fontFamily: 'monospace', fontSize: '1.3rem', letterSpacing: '0.15em', textAlign: 'center' }}
                autoFocus
                maxLength={8}
              />
            </div>
            <button type="submit" className="btn btn--teal w-full" disabled={loading || !code.trim()}>
              {loading ? 'Joining…' : 'Join Classroom'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
