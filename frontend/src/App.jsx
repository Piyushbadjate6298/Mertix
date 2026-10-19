import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import WhatsAppButton from "./components/WhatsAppButton";
import Home from "./pages/public/Home";
import Exams from "./pages/public/Exams";
import ExamDetails from "./pages/public/ExamDetails";
import Auth from "./pages/auth/Auth";
import Exam from "./pages/exam/Exam";
import {
  StudentDashboard,
  Results,
  Rewards,
  Support,
} from "./pages/student/Student";
import {
  TeacherDashboard,
  PaperBuilder,
  QuestionBank,
} from "./pages/teacher/Teacher";
import {
  AdminDashboard,
  ManageExams,
  ManageStudents,
  ManagePapers,
  ManageSupport,
} from "./pages/admin/Admin";
import {
  FinanceDashboard,
  Transactions,
  Audit,
} from "./pages/superadmin/Finance";
function Protected({ role, children }) {
  const { user } = useAuth(),
    location = useLocation();
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role !== role && !(role === "admin" && user.role === "superadmin"))
    return <Navigate to={"/" + user.role} replace />;
  return children;
}
const protect = (role, Component) => (
  <Protected role={role}>
    <Component />
  </Protected>
);
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:id" element={<ExamDetails />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route
            path="/student"
            element={protect("student", StudentDashboard)}
          />
          <Route
            path="/student/results"
            element={protect("student", Results)}
          />
          <Route
            path="/student/rewards"
            element={protect("student", Rewards)}
          />
          <Route
            path="/student/support"
            element={protect("student", Support)}
          />
          <Route path="/take/:id" element={protect("student", Exam)} />
          <Route
            path="/teacher"
            element={protect("teacher", TeacherDashboard)}
          />
          <Route
            path="/teacher/papers"
            element={protect("teacher", PaperBuilder)}
          />
          <Route
            path="/teacher/questions"
            element={protect("teacher", QuestionBank)}
          />
          <Route path="/admin" element={protect("admin", AdminDashboard)} />
          <Route path="/admin/exams" element={protect("admin", ManageExams)} />
          <Route
            path="/admin/students"
            element={protect("admin", ManageStudents)}
          />
          <Route
            path="/admin/papers"
            element={protect("admin", ManagePapers)}
          />
          <Route
            path="/admin/support"
            element={protect("admin", ManageSupport)}
          />
          <Route
            path="/superadmin"
            element={protect("superadmin", FinanceDashboard)}
          />
          <Route
            path="/superadmin/payments"
            element={protect("superadmin", Transactions)}
          />
          <Route
            path="/superadmin/audit"
            element={protect("superadmin", Audit)}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <WhatsAppButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
