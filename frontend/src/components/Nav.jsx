import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Nav() {
  const { user, logout, isTeacher, isAdmin, isTeachSTEM } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav__brand">
        <div className="nav__logo-box">
          <img src="/logo.png" alt="Young Scientist Academy" className="nav__logo-img" />
        </div>
      </Link>

      <div className="nav__links">
        {!user && (
          <>
            <NavLink to="/" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Library</NavLink>
            <NavLink to="/login" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Log in</NavLink>
          </>
        )}

        {user && isTeacher && (
          <>
            <NavLink to="/" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Lesson Library</NavLink>
            <NavLink to="/teacher" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Classroom Dashboard</NavLink>
            <NavLink to="/teacher/modules" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Modules</NavLink>
            {isTeachSTEM && (
              <NavLink to="/teach-stem" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Teach STEM</NavLink>
            )}
            {isTeachSTEM && (
              <NavLink to="/teacher/activity/create" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Create a Lesson</NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Admin</NavLink>
            )}
          </>
        )}

        {user && !isTeacher && (
          <>
            <NavLink to="/student" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>My Classrooms</NavLink>
            <NavLink to="/join" className={({ isActive }) => 'nav__link' + (isActive ? ' nav__link--active' : '')}>Join Classroom</NavLink>
          </>
        )}

        {user && (
          <button onClick={handleLogout} className="nav__link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Log out
          </button>
        )}
      </div>
    </nav>
  )
}
