import { Link } from 'react-router-dom'

export default function PendingApproval() {
  return (
    <div className="page">
      <div className="container container--narrow">
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <h2 style={{ color: 'var(--pink)', marginBottom: '0.75rem' }}>Pending Approval</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
            Your teacher account has been created and is awaiting admin approval.
            You'll be able to log in once your account is approved.
          </p>
          <Link to="/login" className="btn btn--outline">Back to login</Link>
        </div>
      </div>
    </div>
  )
}
