import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Nav from './components/Nav'
import Login from './pages/Login'
import RegisterTeacher from './pages/RegisterTeacher'
import RegisterStudent from './pages/RegisterStudent'
import PendingApproval from './pages/PendingApproval'
import Library from './pages/Library'
import ActivityDetail from './pages/ActivityDetail'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import ClassroomDetail from './pages/ClassroomDetail'
import ModuleList from './pages/ModuleList'
import ModuleBuilder from './pages/ModuleBuilder'
import ModuleDetail from './pages/ModuleDetail'
import ModuleView from './pages/ModuleView'
import AdminDashboard from './pages/AdminDashboard'
import JoinClassroom from './pages/JoinClassroom'
import ActivityBuilder from './pages/ActivityBuilder'
import StudentActivity from './pages/StudentActivity'
import TeacherResponses from './pages/TeacherResponses'
import TeachSTEMDashboard from './pages/TeachSTEMDashboard'
import ProjectReflectionSurvey from './pages/ProjectReflectionSurvey'
import TeachSTEMProfilePage from './pages/TeachSTEMProfilePage'
import ProjectTopics from './pages/ProjectTopics'
import ProjectStarterBuilder from './pages/ProjectStarterBuilder'
import TStemSurvey from './pages/TStemSurvey'
import TeacherSurvey from './pages/TeacherSurvey'
import ThreeTwoOneList from './pages/ThreeTwoOneList'
import ThreeTwoOneResponses from './pages/ThreeTwoOneResponses'
import StudentThreeTwoOne from './pages/StudentThreeTwoOne'
import StudentReflectionList from './pages/StudentReflectionList'
import StudentReflectionResponses from './pages/StudentReflectionResponses'
import StudentReflectionForm from './pages/StudentReflectionForm'
import StaffDashboard from './pages/StaffDashboard'
import StaffProfilePage from './pages/StaffProfilePage'
import StaffProjectTopics from './pages/StaffProjectTopics'
import StaffProjectStarterBuilder from './pages/StaffProjectStarterBuilder'
import StaffProjectReflectionSurvey from './pages/StaffProjectReflectionSurvey'
import ForumList from './pages/ForumList'
import ForumThreadDetail from './pages/ForumThreadDetail'

function RequireAuth({ children, role }) {
  const { user, loading, isTeacher, isAdmin, isTeachSTEM, isProgramStaff } = useAuth()
  if (loading) return <div className="spinner">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (role === 'teacher' && !isTeacher) return <Navigate to="/student" replace />
  if (role === 'admin' && !isAdmin) return <Navigate to="/" replace />
  if (role === 'teach_stem' && !isTeachSTEM) return <Navigate to="/teacher" replace />
  if (role === 'program_staff' && !isProgramStaff) return <Navigate to="/teacher" replace />
  return children
}

function AppRoutes() {
  const { user, loading, isTeacher, isAdmin, isStudent } = useAuth()
  if (loading) return <div className="spinner">Loading…</div>

  return (
    <>
      <Nav />
      <Routes>
        {/* Public */}
        <Route path="/login" element={user ? <Navigate to={isTeacher ? '/teacher' : '/student'} /> : <Login />} />
        <Route path="/register" element={<RegisterTeacher />} />
        <Route path="/register/student" element={<RegisterStudent />} />
        <Route path="/pending" element={<PendingApproval />} />
        <Route path="/" element={<Library />} />
        <Route path="/activity/:id" element={<ActivityDetail />} />

        {/* Teacher */}
        <Route path="/teacher" element={<RequireAuth role="teacher"><TeacherDashboard /></RequireAuth>} />
        <Route path="/teacher/classroom/:id" element={<RequireAuth role="teacher"><ClassroomDetail /></RequireAuth>} />
        <Route path="/teacher/modules" element={<RequireAuth role="teacher"><ModuleList /></RequireAuth>} />
        <Route path="/teacher/module/create" element={<RequireAuth role="teacher"><ModuleBuilder /></RequireAuth>} />
        <Route path="/teacher/module/:id/edit" element={<RequireAuth role="teacher"><ModuleBuilder /></RequireAuth>} />
        <Route path="/teacher/module/:id" element={<RequireAuth role="teacher"><ModuleDetail /></RequireAuth>} />
        <Route path="/teach-stem" element={<RequireAuth role="teach_stem"><TeachSTEMDashboard /></RequireAuth>} />
        <Route path="/teach-stem/profile" element={<RequireAuth role="teach_stem"><TeachSTEMProfilePage /></RequireAuth>} />
        <Route path="/teach-stem/project-reflection" element={<RequireAuth role="teach_stem"><ProjectReflectionSurvey /></RequireAuth>} />
        <Route path="/teach-stem/project-topics" element={<RequireAuth role="teach_stem"><ProjectTopics /></RequireAuth>} />
        <Route path="/teach-stem/project-starter" element={<RequireAuth role="teach_stem"><ProjectStarterBuilder /></RequireAuth>} />
        <Route path="/teach-stem/tstem-survey" element={<RequireAuth role="teach_stem"><TStemSurvey /></RequireAuth>} />
        <Route path="/teach-stem/321" element={<RequireAuth role="teach_stem"><ThreeTwoOneList /></RequireAuth>} />
        <Route path="/teach-stem/321/:id" element={<RequireAuth role="teach_stem"><ThreeTwoOneResponses /></RequireAuth>} />
        <Route path="/teach-stem/student-reflections" element={<RequireAuth role="teach_stem"><StudentReflectionList /></RequireAuth>} />
        <Route path="/teach-stem/student-reflections/:id" element={<RequireAuth role="teach_stem"><StudentReflectionResponses /></RequireAuth>} />
        <Route path="/program-staff" element={<RequireAuth role="program_staff"><StaffDashboard /></RequireAuth>} />
        <Route path="/program-staff/profile" element={<RequireAuth role="program_staff"><StaffProfilePage /></RequireAuth>} />
        <Route path="/program-staff/project-reflection" element={<RequireAuth role="program_staff"><StaffProjectReflectionSurvey /></RequireAuth>} />
        <Route path="/program-staff/project-topics" element={<RequireAuth role="program_staff"><StaffProjectTopics /></RequireAuth>} />
        <Route path="/program-staff/project-starter" element={<RequireAuth role="program_staff"><StaffProjectStarterBuilder /></RequireAuth>} />
        <Route path="/teacher/forum" element={<RequireAuth role="teacher"><ForumList /></RequireAuth>} />
        <Route path="/teacher/forum/:id" element={<RequireAuth role="teacher"><ForumThreadDetail /></RequireAuth>} />
        <Route path="/teacher/survey" element={<RequireAuth role="teacher"><TeacherSurvey /></RequireAuth>} />
        <Route path="/teacher/activity/create" element={<RequireAuth role="teach_stem"><ActivityBuilder /></RequireAuth>} />
        <Route path="/teacher/activity/:id/edit" element={<RequireAuth role="teach_stem"><ActivityBuilder /></RequireAuth>} />
        <Route path="/teacher/activity/:id/responses" element={<RequireAuth role="teacher"><TeacherResponses /></RequireAuth>} />

        {/* Student */}
        <Route path="/student" element={<RequireAuth role="student"><StudentDashboard /></RequireAuth>} />
        <Route path="/student/321/:id" element={<RequireAuth><StudentThreeTwoOne /></RequireAuth>} />
        <Route path="/student/reflection/:id" element={<RequireAuth><StudentReflectionForm /></RequireAuth>} />
        <Route path="/module/:id" element={<RequireAuth><ModuleView /></RequireAuth>} />
        <Route path="/activity/:id/work" element={<RequireAuth><StudentActivity /></RequireAuth>} />
        <Route path="/join" element={<RequireAuth><JoinClassroom /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <footer>
        <img src="/logo.png" alt="Young Scientist Academy" style={{ height: 48, width: 'auto', opacity: 0.9 }} />
        <p style={{ marginTop: '0.5rem' }}>Lesson Database</p>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
