

import { lazy, Suspense } from "react";
import AdminLayout from "../layouts/AdminLayout";
import AdminRoute from "../components/auth/AdminRoute";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-[#1A1814] border-t-[#F59E0B] rounded-full animate-spin" />
      <p
        className="text-[#78716C] text-xs uppercase tracking-wider"
        style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
      >
        Loading...
      </p>
    </div>
  </div>
);

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const ProblemList = lazy(() => import("../pages/admin/problems/ProblemList"));
const AdminPOTDScheduler = lazy(() => import("../pages/admin/AdminPOTDScheduler"));

const withSuspense = (Component) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const PlaceholderPage = ({ title }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <span className="text-[#F59E0B] text-4xl">⬡</span>
    <h1
      className="text-[#E8E4D9] text-lg uppercase tracking-[0.2em]"
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      {title}
    </h1>
    <p
      className="text-[#78716C] text-xs uppercase tracking-wider"
      style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
    >
      This page is under construction
    </p>
  </div>
);

export const adminRoutes = [
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      
      { index: true, element: withSuspense(AdminDashboard) },

      { path: "problems", element: withSuspense(ProblemList) },
      {
        path: "problems/new",
        element: <PlaceholderPage title="Create Problem" />,
      },

      { path: "potd", element: withSuspense(AdminPOTDScheduler) },
      {
        path: "problems/:id/edit",
        element: <PlaceholderPage title="Edit Problem" />,
      },
      {
        path: "problems/:id/testcases",
        element: <PlaceholderPage title="Test Cases" />,
      },

      { path: "contests", element: <PlaceholderPage title="Contests" /> },
      {
        path: "contests/new",
        element: <PlaceholderPage title="Create Contest" />,
      },
      {
        path: "contests/:id/edit",
        element: <PlaceholderPage title="Edit Contest" />,
      },
      {
        path: "contests/:id/problems",
        element: <PlaceholderPage title="Contest Problems" />,
      },
      {
        path: "contests/:id/live",
        element: <PlaceholderPage title="Live Monitor" />,
      },

      {
        path: "execution/config",
        element: <PlaceholderPage title="Judge Configuration" />,
      },
      {
        path: "execution/languages",
        element: <PlaceholderPage title="Language Settings" />,
      },

      { path: "submissions", element: <PlaceholderPage title="Submissions" /> },
      {
        path: "submissions/:id",
        element: <PlaceholderPage title="Submission Detail" />,
      },

      {
        path: "leaderboards",
        element: <PlaceholderPage title="Leaderboards" />,
      },
      {
        path: "leaderboards/:id/config",
        element: <PlaceholderPage title="Leaderboard Config" />,
      },

      {
        path: "plagiarism",
        element: <PlaceholderPage title="Plagiarism Review" />,
      },
      {
        path: "plagiarism/:id",
        element: <PlaceholderPage title="Case Review" />,
      },

      { path: "users", element: <PlaceholderPage title="User Management" /> },
      { path: "users/:id", element: <PlaceholderPage title="User Detail" /> },
      {
        path: "roles",
        element: <PlaceholderPage title="Roles & Permissions" />,
      },

      { path: "system", element: <PlaceholderPage title="System Dashboard" /> },
      {
        path: "system/judges",
        element: <PlaceholderPage title="Judge Workers" />,
      },
      { path: "system/ai", element: <PlaceholderPage title="AI Services" /> },
      {
        path: "system/queues",
        element: <PlaceholderPage title="Queue Monitor" />,
      },
      { path: "system/audit", element: <PlaceholderPage title="Audit Logs" /> },

      { path: "danger", element: <PlaceholderPage title="Danger Zone" /> },
    ],
  },
];

export default adminRoutes;
