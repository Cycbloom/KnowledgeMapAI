import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useStore } from "./store/useStore";
import { LoadingBar, ErrorBoundary } from "./components/common";

// Lazy Load Pages
const Login = lazy(() =>
  import("./pages/Login").then((module) => ({ default: module.Login })),
);
const Register = lazy(() =>
  import("./pages/Register").then((module) => ({ default: module.Register })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const GraphEditor = lazy(() =>
  import("./pages/GraphEditor").then((module) => ({
    default: module.GraphEditor,
  })),
);
const Study = lazy(() =>
  import("./pages/Study").then((module) => ({ default: module.Study })),
);
const LearningMode = lazy(() =>
  import("./pages/LearningMode").then((module) => ({
    default: module.LearningMode,
  })),
);
const StatisticsCenter = lazy(() =>
  import("./pages/StatisticsCenter").then((module) => ({
    default: module.StatisticsCenter,
  })),
);
const Tasks = lazy(() =>
  import("./pages/Tasks").then((module) => ({ default: module.Tasks })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then((module) => ({ default: module.Profile })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((module) => ({ default: module.Settings })),
);
const RecycleBin = lazy(() =>
  import("./pages/RecycleBin").then((module) => ({
    default: module.RecycleBin,
  })),
);
const Templates = lazy(() =>
  import("./pages/Templates").then((module) => ({ default: module.Templates })),
);
const Achievements = lazy(() =>
  import("./pages/Achievements").then((module) => ({
    default: module.Achievements,
  })),
);
const GraphMap = lazy(() =>
  import("./pages/GraphMap").then((module) => ({ default: module.GraphMap })),
);
const CombinedGraphView = lazy(() =>
  import("./pages/CombinedGraphView").then((module) => ({
    default: module.CombinedGraphView,
  })),
);
const Scheduler = lazy(() =>
  import("./pages/Scheduler").then((module) => ({ default: module.Scheduler })),
);
const CurrentTask = lazy(() =>
  import("./pages/CurrentTask").then((module) => ({
    default: module.CurrentTask,
  })),
);
const SchedulerStats = lazy(() =>
  import("./pages/SchedulerStats").then((module) => ({
    default: module.SchedulerStats,
  })),
);
const TaskDetailPage = lazy(() =>
  import("./pages/TaskDetailPage").then((module) => ({
    default: module.default,
  })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage").then((module) => ({
    default: module.CalendarPage,
  })),
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useStore();
  // Simple check. Real app should verify token expiry or fetch user on mount.
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
      <LoadingBar />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            <Route path="graphs" element={<Navigate to="/" replace />} />
            <Route path="graph/:id" element={<GraphEditor />} />
            <Route
              path="combined-graphs/:id1/:id2"
              element={<CombinedGraphView />}
            />
            <Route path="study" element={<Study />} />
            <Route path="learning" element={<LearningMode />} />
            <Route path="statistics" element={<StatisticsCenter />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="trash" element={<RecycleBin />} />
            <Route path="templates" element={<Templates />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="graph-map" element={<GraphMap />} />
            <Route path="scheduler" element={<Scheduler />} />
            <Route path="scheduler/current" element={<CurrentTask />} />
            <Route path="scheduler/stats" element={<SchedulerStats />} />
            <Route path="scheduler/task/:taskId" element={<TaskDetailPage />} />
            <Route path="calendar" element={<CalendarPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
