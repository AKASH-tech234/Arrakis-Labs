// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./pages/landing";
import Login from "./pages/login";
import Signup from "./pages/signup";
import ProblemLibrary from "./pages/problem";
import ProblemDetail from "./pages/problemdetail";
import Profile from "./pages/profile";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CSVUpload from "./pages/admin/CSVUpload";
import QuestionList from "./pages/admin/QuestionList";
import QuestionEditor from "./pages/admin/QuestionEditor";
import TestCaseManager from "./pages/admin/TestCaseManager";

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
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

            {/* Authenticated Routes */}
            <Route
              path="/problems"
              element={
                <ProtectedRoute>
                  <ProblemLibrary />
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
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="upload" element={<CSVUpload />} />
              <Route path="questions" element={<QuestionList />} />
              <Route path="questions/new" element={<QuestionEditor />} />
              <Route path="questions/:id" element={<QuestionEditor />} />
              <Route path="questions/:id/edit" element={<QuestionEditor />} />
              <Route path="questions/:id/test-cases" element={<TestCaseManager />} />
            </Route>
          </Routes>
        </Router>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
