
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
} from "react-router-dom";
import Landing from "./pages/common/landing";
import Login from "./pages/auth/login";
import Signup from "./pages/auth/signup";
import ProblemLibrary from "./pages/common/problem";
import ProblemDetail from "./pages/common/problemdetail";
import SubmissionResult from "./pages/common/SubmissionResult";
import Profile from "./pages/profile/profile";
import CodingProfile from "./pages/profile/codingProfile";
import POTDHome from "./pages/potd/POTDHome";
import POTDHistory from "./pages/potd/POTDHistory";
import POTDLeaderboard from "./pages/potd/POTDLeaderboard";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SubmissionProvider } from "./context/SubmissionContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";

import { ContestList, ContestDetail, ContestProblem } from "./pages/contest";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CSVUpload from "./pages/admin/CSVUpload";
import QuestionList from "./pages/admin/QuestionList";
import QuestionEditor from "./pages/admin/QuestionEditor";
import TestCaseManager from "./pages/admin/TestCaseManager";
import AdminPOTDScheduler from "./pages/admin/AdminPOTDScheduler";
import {
  AdminContestList,
  AdminContestEditor,
  AdminContestDetail,
} from "./pages/admin/contests";

function PublicProfileRoute() {
  const { username } = useParams();
  return <Profile username={username} readOnly />;
}

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <SubmissionProvider>
          <Router>
            <Routes>
              {}
              <Route path="/" element={<Landing />} />
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <GuestRoute>
                    <Signup />
                  </GuestRoute>
                }
              />

              {}
              <Route
                path="/problems"
                element={
                  <ProtectedRoute>
                    <ProblemLibrary />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/potd"
                element={
                  <ProtectedRoute>
                    <POTDHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/potd/history"
                element={
                  <ProtectedRoute>
                    <POTDHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/potd/leaderboard"
                element={
                  <ProtectedRoute>
                    <POTDLeaderboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/problems/:id"
                element={
                  <ProtectedRoute>
                    <ProblemDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/submissions/:id"
                element={
                  <ProtectedRoute>
                    <SubmissionResult />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/coding-profile"
                element={
                  <ProtectedRoute>
                    <CodingProfile />
                  </ProtectedRoute>
                }
              />

              {}
              <Route path="/u/:username" element={<PublicProfileRoute />} />

              {}
              <Route path="/contests" element={<ContestList />} />
              <Route
                path="/contests/:contestId"
                element={
                  <ProtectedRoute>
                    <ContestDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contests/:contestId/problems/:problemId"
                element={
                  <ProtectedRoute>
                    <ContestProblem />
                  </ProtectedRoute>
                }
              />

              {}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="upload" element={<CSVUpload />} />
                <Route path="questions" element={<QuestionList />} />
                <Route path="questions/new" element={<QuestionEditor />} />
                <Route path="questions/:id" element={<QuestionEditor />} />
                <Route path="questions/:id/edit" element={<QuestionEditor />} />
                <Route
                  path="questions/:id/test-cases"
                  element={<TestCaseManager />}
                />

                <Route path="potd" element={<AdminPOTDScheduler />} />

                {}
                <Route path="contests" element={<AdminContestList />} />
                <Route path="contests/new" element={<AdminContestEditor />} />
                <Route path="contests/:id" element={<AdminContestDetail />} />
                <Route
                  path="contests/:id/edit"
                  element={<AdminContestEditor />}
                />
              </Route>
            </Routes>
          </Router>
        </SubmissionProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
