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
import DashboardExplore from "./pages/common/Explore";
import {
  StudentDashboard,
  MyCourses,
  BrowseCourses,
  MyWallet,
  AddMoney,
  WithdrawMoney,
  DepositHistory,
  TransactionHistory,
  StudentProfile,
  Results,
  Rewards,
  Support,
} from "./pages/student/Student";
import {
  TeacherDashboard,
  TeacherCourses,
  TeacherProfile,
  PaperBuilder,
  QuestionBank,
  ImportQuestionBank,
} from "./pages/teacher/Teacher";
import {
  AdminDashboard,
  ManageExams,
  ManageStudents,
  ManagePapers,
  ManageQuestionBanks,
  ManageSupport,
  ManageCourses,
  PlatformConfiguration,
  PrizeManagement,
} from "./pages/admin/Admin";
import {
  FinanceDashboard,
  StudentWalletManagement,
  WithdrawalManagement,
  FinancialReports,
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
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:id" element={<ExamDetails />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />

          {/* Student Routes */}
          <Route path="/student" element={protect("student", StudentDashboard)} />
          <Route path="/student/courses" element={protect("student", MyCourses)} />
          <Route path="/student/browse" element={protect("student", BrowseCourses)} />
          <Route path="/student/wallet" element={protect("student", MyWallet)} />
          <Route path="/student/deposit" element={protect("student", AddMoney)} />
          <Route path="/student/withdraw" element={protect("student", WithdrawMoney)} />
          <Route path="/student/deposits" element={protect("student", DepositHistory)} />
          <Route path="/student/transactions" element={protect("student", TransactionHistory)} />
          <Route path="/student/profile" element={protect("student", StudentProfile)} />
          <Route path="/student/explore" element={protect("student", DashboardExplore)} />
          <Route path="/student/results" element={protect("student", Results)} />
          <Route path="/student/rewards" element={protect("student", MyWallet)} />
          <Route path="/student/support" element={protect("student", Support)} />
          <Route path="/take/:id" element={protect("student", Exam)} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={protect("teacher", TeacherDashboard)} />
          <Route path="/teacher/courses" element={protect("teacher", TeacherCourses)} />
          <Route path="/teacher/profile" element={protect("teacher", TeacherProfile)} />
          <Route path="/teacher/explore" element={protect("teacher", DashboardExplore)} />
          <Route path="/teacher/papers" element={protect("teacher", PaperBuilder)} />
          <Route path="/teacher/questions" element={protect("teacher", QuestionBank)} />
          <Route path="/teacher/import" element={protect("teacher", ImportQuestionBank)} />

          {/* Admin Routes */}
          <Route path="/admin" element={protect("admin", AdminDashboard)} />
          <Route path="/admin/finance" element={protect("admin", FinanceDashboard)} />
          <Route path="/admin/wallets" element={protect("admin", StudentWalletManagement)} />
          <Route path="/admin/withdrawals" element={protect("admin", WithdrawalManagement)} />
          <Route path="/admin/reports" element={protect("admin", FinancialReports)} />
          <Route path="/admin/explore" element={protect("admin", DashboardExplore)} />
          <Route path="/admin/exams" element={protect("admin", ManageExams)} />
          <Route path="/admin/prizes" element={protect("admin", PrizeManagement)} />
          <Route path="/admin/students" element={protect("admin", ManageStudents)} />
          <Route path="/admin/papers" element={protect("admin", ManagePapers)} />
          <Route path="/admin/question-banks" element={protect("admin", ManageQuestionBanks)} />
          <Route path="/admin/import" element={protect("admin", ImportQuestionBank)} />
          <Route path="/admin/support" element={protect("admin", ManageSupport)} />
          <Route path="/admin/courses" element={protect("admin", ManageCourses)} />
          <Route path="/admin/configuration" element={protect("admin", PlatformConfiguration)} />

          {/* Superadmin Routes */}
          <Route path="/superadmin" element={protect("superadmin", FinanceDashboard)} />
          <Route path="/superadmin/wallets" element={protect("superadmin", StudentWalletManagement)} />
          <Route path="/superadmin/withdrawals" element={protect("superadmin", WithdrawalManagement)} />
          <Route path="/superadmin/reports" element={protect("superadmin", FinancialReports)} />
          <Route path="/superadmin/explore" element={protect("superadmin", DashboardExplore)} />
          <Route path="/superadmin/payments" element={protect("superadmin", Transactions)} />
          <Route path="/superadmin/audit" element={protect("superadmin", Audit)} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <WhatsAppButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
